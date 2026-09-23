/*
 * Registers the MAWB numbers that were hand-typed onto air jobs before the AWB
 * register existed, so the stock list reflects what has actually been used.
 *
 * For every AE/AI job whose BL carries an mbl, this reads the airline off the
 * job and creates a matching Awbl row marked `used` and linked back to that
 * job. Nothing is invented: the number comes from the BL, the airline from the
 * job, the company from the job.
 *
 * Anything it cannot register - or registers but doubts - is written to a CSV
 * for the air operations team to correct by hand.
 *
 *   node scripts/backfillAwbl.js                 # DRY RUN - reports + CSV, writes nothing
 *   node scripts/backfillAwbl.js --commit        # actually registers
 *   node scripts/backfillAwbl.js --company=1     # limit to one company
 *   node scripts/backfillAwbl.js --out=C:/tmp/fix.csv
 *   node scripts/backfillAwbl.js --commit --allow-bad-check
 *
 * SAFETY
 *  - Dry run unless --commit is passed. The CSV is produced either way, so the
 *    correction list can be sent out before anything is written.
 *  - Only ever INSERTs into "Awbls". It never updates or deletes anything in
 *    Bls, SE_Jobs or any other table, so existing typed mbl values are left
 *    exactly as they are - this adds a register alongside them.
 *  - Idempotent: numbers already registered for that company are skipped, so
 *    re-running after a partial run is safe.
 *  - Anything ambiguous is SKIPPED and listed, never guessed. In particular,
 *    when the same number appears on two jobs in one company it skips BOTH -
 *    there is no way to tell which job owns it, and picking one would silently
 *    bless a real double-booking.
 */
const fs = require('fs');
const path = require('path');
const db = require('../models');
const { sequelize } = db;
const { Op } = require('sequelize');
const { Awbl } = require('../functions/Associations/awblAssociations');
const { parseEntry, formatNumber } = require('../functions/awbl');

const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const ALLOW_BAD_CHECK = args.includes('--allow-bad-check');
const argValue = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : null;
};
const ONLY_COMPANY = argValue('company');
const OUT_PATH = argValue('out') ||
  path.join(process.cwd(), `awbl-corrections-${new Date().toISOString().slice(0, 10)}.csv`);

const CHUNK = 500;

const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

// Matches the naming used when job numbers are built in routes/jobRoutes/sea.js
const companyName = (id) => (String(id) === '1' ? 'SNS' : String(id) === '2' ? 'CLS' : 'ACS');

const csvCell = (value) => {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  await sequelize.authenticate();
  // The models module kicks off sync({alter:true}) on require; wait for it so
  // the Awbls table is definitely there before we read or write it.
  await db.syncPromise;

  console.log(COMMIT ? '*** COMMIT MODE - changes will be written ***'
                     : '--- DRY RUN - nothing will be written (pass --commit to apply) ---');

  // Read with a raw query rather than through the Bl/SE_Job models so this
  // stays a plain read and cannot trip any model hook.
  const [rows] = await sequelize.query(`
    SELECT b.id AS "blId", b.mbl, b."createdAt" AS "blCreatedAt",
           j.id AS "jobId", j."jobNo", j.operation, j."companyId", j."airLineId",
           cl.name AS "airlineName", cl.code AS "airlineCode"
      FROM "Bls" b
      JOIN "SE_Jobs" j ON j.id = b."SEJobId"
      LEFT JOIN "Clients" cl ON cl.id = j."airLineId"
     WHERE j.operation IN ('AE','AI')
       AND b.mbl IS NOT NULL AND btrim(b.mbl) <> ''
       ${ONLY_COMPANY ? `AND j."companyId" = ${sequelize.escape(ONLY_COMPANY)}` : ''}
     ORDER BY j."companyId", j."jobNo"
  `);

  console.log(`\nair BLs with a typed MAWB: ${rows.length}`);

  // Every row that needs a human, in the order a person would work through it.
  const corrections = [];
  const addCorrection = (issue, row, detail, typed, suggested) => corrections.push({
    issue,
    jobNo: row.jobNo,
    company: companyName(row.companyId),
    operation: row.operation,
    jobId: row.jobId,
    blId: row.blId,
    mawb: typed !== undefined ? typed : row.mbl,
    airline: row.airlineName ? `${row.airlineName}${row.airlineCode ? ` (${row.airlineCode})` : ''}` : '',
    detail,
    suggested: suggested || '',
  });

  const candidates = [];

  /* ---- pass 1: parse and validate each row on its own ---- */
  for (const row of rows) {
    const digits = digitsOnly(row.mbl);

    if (digits.length !== 11) {
      addCorrection(
        'Invalid MAWB format', row,
        digits.length
          ? `Has ${digits.length} digits, an AWB needs 11 (3-digit airline prefix + 7-digit serial + check digit).`
          : 'Contains no digits at all.'
      );
      continue;
    }
    if (!row.airLineId) {
      addCorrection('No airline on job', row,
        'Set the airline on the job before this number can be registered.');
      continue;
    }

    const parsed = parseEntry(digits.slice(0, 3), digits.slice(3));
    if (!parsed.ok) {
      // The suggestion fixes the LAST digit, which is the common mis-key. It is
      // offered, not applied: if the serial is the wrong part instead, the
      // suggestion is wrong too, which is why operations still check the
      // document and type their answer into 'Corrected MAWB'.
      const serial = digits.slice(3, 10);
      const suggested = `${digits.slice(0, 3)}-${serial}${Number(serial) % 7}`;
      addCorrection('Wrong check digit', row, parsed.error, formatNumber(digits), suggested);
      if (!ALLOW_BAD_CHECK) continue;
    }

    candidates.push({
      key: `${row.companyId}|${digits}`,
      row,
      prefix: digits.slice(0, 3),
      serial: digits.slice(3, 10),
      checkDigit: digits.slice(10),
      awbNumber: digits,
      companyId: String(row.companyId),
      AirlineId: row.airLineId,
      status: 'used',
      SEJobId: row.jobId,
      usedAt: row.blCreatedAt ? new Date(row.blCreatedAt).toISOString() : null,
      remarks: 'Backfilled from typed MAWB',
    });
  }

  /* ---- pass 2: the same number on two jobs in one company ---- */
  const byKey = new Map();
  for (const c of candidates) {
    if (!byKey.has(c.key)) byKey.set(c.key, []);
    byKey.get(c.key).push(c);
  }
  const unique = [];
  for (const group of byKey.values()) {
    if (group.length > 1) {
      const others = group.map((g) => g.row.jobNo).join(', ');
      // Every job in the clash is listed, so whoever picks it up can see the
      // whole set and decide which job keeps the number.
      group.forEach((g) => addCorrection(
        'Duplicate MAWB', g.row,
        `Same number on ${group.length} jobs in ${companyName(g.companyId)}: ${others}. ` +
        `Decide which job keeps it; the others need their own number.`,
        formatNumber(g.awbNumber)
      ));
      continue;
    }
    unique.push(group[0]);
  }

  /* ---- pass 3: drop anything already registered, so re-runs are no-ops ---- */
  const existing = new Set();
  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    const found = await Awbl.findAll({
      where: { awbNumber: { [Op.in]: slice.map((x) => x.awbNumber) } },
      attributes: ['companyId', 'awbNumber'],
    });
    found.forEach((f) => existing.add(`${f.companyId}|${f.awbNumber}`));
  }
  const alreadyCount = unique.filter((x) => existing.has(x.key)).length;
  const toCreate = unique.filter((x) => !existing.has(x.key));

  /* ---- pass 4: prefix / airline disagreement (review, still registered) ----
   * An airline prefix belongs to exactly one airline in reality, so a prefix
   * appearing against several airlines means the job data disagrees with
   * itself. These still register - under whichever airline their own job
   * names, because inventing a correction would be worse - but the minority
   * ones are flagged for review against the airline that dominates the prefix.
   *
   * Impact if left alone is limited: every backfilled row is `used`, so a
   * wrong airline never reaches the unused dropdown. It skews the Setup page's
   * airline filter and reporting by airline, nothing operational.
   */
  const prefixCounts = new Map();
  for (const c of toCreate) {
    if (!prefixCounts.has(c.prefix)) prefixCounts.set(c.prefix, new Map());
    const m = prefixCounts.get(c.prefix);
    m.set(c.AirlineId, (m.get(c.AirlineId) || 0) + 1);
  }
  const dominant = new Map();
  for (const [prefix, m] of prefixCounts) {
    if (m.size < 2) continue;
    const [topId, topN] = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    dominant.set(prefix, { topId, topN });
  }
  let mismatches = 0;
  for (const c of toCreate) {
    const d = dominant.get(c.prefix);
    if (!d || c.AirlineId === d.topId) continue;
    mismatches++;
    const topName = toCreate.find((x) => x.AirlineId === d.topId)?.row.airlineName || `airline #${d.topId}`;
    addCorrection(
      'Airline may be wrong (review)', c.row,
      `Prefix ${c.prefix} is used by ${topName} on ${d.topN} other job(s), but this job names a different airline. ` +
      `Either the airline on the job or the MAWB is wrong.`,
      formatNumber(c.awbNumber)
    );
  }

  /* ----------------------------- report ----------------------------- */
  const byIssue = corrections.reduce((acc, c) => {
    acc[c.issue] = (acc[c.issue] || 0) + 1;
    return acc;
  }, {});
  console.log('\nNeeds manual correction:');
  if (!corrections.length) console.log('   nothing - every number parsed cleanly');
  Object.entries(byIssue)
    .sort((a, b) => b[1] - a[1])
    .forEach(([issue, n]) => console.log(`   ${String(n).padStart(5)}  ${issue}`));

  if (alreadyCount) console.log(`\nalready registered (skipped): ${alreadyCount}`);

  const byCompany = toCreate.reduce((acc, x) => {
    acc[x.companyId] = (acc[x.companyId] || 0) + 1;
    return acc;
  }, {});
  console.log('\nTO REGISTER:', toCreate.length);
  Object.entries(byCompany).forEach(([c, n]) => console.log(`   ${companyName(c)}: ${n}`));
  if (mismatches) {
    console.log(`   (of which ${mismatches} carry an airline worth reviewing - see the CSV)`);
  }

  /* ------------------------------ CSV ------------------------------- */
  // Sorted so the blocking problems come first and each issue type is grouped,
  // which is the order someone working through the list would want.
  const ORDER = [
    'Duplicate MAWB',
    'Wrong check digit',
    'Invalid MAWB format',
    'No airline on job',
    'Airline may be wrong (review)',
  ];
  corrections.sort((a, b) => {
    const d = ORDER.indexOf(a.issue) - ORDER.indexOf(b.issue);
    return d !== 0 ? d : String(a.jobNo).localeCompare(String(b.jobNo));
  });

  // Columns fall into three groups, in this order:
  //   what we found      - Issue .. What To Fix
  //   our suggestion     - Suggested MAWB (check-digit rows only; never assumed
  //                        correct, since the serial may be the wrong part)
  //   operations' answer - Corrected MAWB / Corrected Airline / Notes, left
  //                        blank for them to fill in and send back
  // scripts/applyAwblCorrections.js reads exactly these headers, so renaming a
  // column here means renaming it there too.
  const header = [
    'Issue', 'Job No', 'Company', 'Type', 'MAWB As Entered', 'Airline On Job', 'What To Fix',
    'Suggested MAWB', 'Corrected MAWB', 'Corrected Airline', 'Operations Notes',
    'Job ID', 'BL ID',
  ];
  const lines = [header.join(',')];
  for (const c of corrections) {
    lines.push([
      c.issue, c.jobNo, c.company, c.operation, c.mawb, c.airline, c.detail,
      c.suggested || '', '', '', '',
      c.jobId, c.blId,
    ].map(csvCell).join(','));
  }
  // BOM so Excel opens it as UTF-8 rather than mangling any accented party names.
  fs.writeFileSync(OUT_PATH, '\uFEFF' + lines.join('\r\n') + '\r\n', 'utf8');
  console.log(`\nCorrection list written: ${OUT_PATH}`);
  console.log(`   ${corrections.length} row(s) for the air operations team.`);

  if (!COMMIT) {
    console.log('\nDry run finished - nothing written to the database.');
    console.log('Re-run with --commit to register the numbers above.');
    return;
  }
  if (!toCreate.length) {
    console.log('\nNothing to register.');
    return;
  }

  /* ----------------------------- write ------------------------------ */
  let written = 0;
  for (let i = 0; i < toCreate.length; i += CHUNK) {
    const slice = toCreate.slice(i, i + CHUNK).map(({ key, row, ...rest }) => rest);
    // ignoreDuplicates leans on the (companyId, awbNumber) unique index as a
    // final backstop, so a concurrent run or a re-run cannot double-register.
    const made = await Awbl.bulkCreate(slice, { ignoreDuplicates: true });
    written += made.length;
    console.log(`   written ${Math.min(i + CHUNK, toCreate.length)} / ${toCreate.length}`);
  }

  console.log(`\nDone. Registered ${written} number(s) as used.`);
}

main()
  .catch((err) => { console.error('Backfill failed:', err); process.exitCode = 1; })
  .finally(async () => { await sequelize.close(); });
