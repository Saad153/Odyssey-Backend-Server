/*
 * Applies the corrections air operations wrote back into the sheet produced by
 * scripts/backfillAwbl.js, so nobody has to open 167 jobs by hand.
 *
 *   node scripts/applyAwblCorrections.js --file=awbl-corrections-2026-08-28.csv
 *   node scripts/applyAwblCorrections.js --file=... --commit
 *
 * It reads two columns operations fill in, and ignores every row where both
 * are blank:
 *
 *   Corrected MAWB     - the number that job should carry. Writes Bls.mbl.
 *   Corrected Airline  - the airline that job should name. Writes
 *                        SE_Jobs."airLineId". Matched by name or code.
 *
 * Blank means "leave this alone", which is what makes the duplicate rows work:
 * fill in the job(s) that should change and leave the one keeping the number
 * empty.
 *
 * THIS IS THE ONE SCRIPT HERE THAT EDITS EXISTING RECORDS, so it is deliberately
 * suspicious of its own input:
 *
 *  - Dry run unless --commit. The dry run prints every before -> after.
 *  - A row is skipped unless the job's CURRENT mbl still equals the sheet's
 *    'MAWB As Entered'. If somebody edited the job while the sheet was out
 *    with operations, this refuses to overwrite their work rather than
 *    silently reverting it.
 *  - Corrected numbers are validated the same way registration validates them,
 *    so a corrected number cannot itself be invalid.
 *  - A corrected number that collides with another job in the same company, or
 *    with an already registered AWB, is refused - fixing one duplicate by
 *    creating another would be worse than leaving it.
 *  - Everything runs in one transaction: either the whole sheet applies or
 *    none of it does.
 *  - Rejected rows are written to a CSV to send back to operations.
 */
const fs = require('fs');
const path = require('path');
const db = require('../models');
const { sequelize } = db;
const { parseEntry, formatNumber } = require('../functions/awbl');

const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const argValue = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : null;
};
const FILE = argValue('file');
const OUT_PATH = argValue('out') ||
  path.join(process.cwd(), `awbl-corrections-rejected-${new Date().toISOString().slice(0, 10)}.csv`);

const digitsOnly = (v) => String(v ?? '').replace(/\D/g, '');
const norm = (v) => String(v ?? '').trim().toLowerCase();
const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Minimal RFC4180 reader. Written here rather than pulled in as a dependency:
// the sheet comes back from Excel, so it must cope with quoted fields holding
// commas, escaped quotes and newlines - but nothing more exotic than that.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // strip BOM

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.some((c) => String(c).trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

async function main() {
  if (!FILE) {
    console.error('Usage: node scripts/applyAwblCorrections.js --file=<sheet.csv> [--commit]');
    process.exit(1);
  }
  if (!fs.existsSync(FILE)) {
    console.error(`File not found: ${FILE}`);
    process.exit(1);
  }

  await sequelize.authenticate();
  await db.syncPromise;

  console.log(COMMIT ? '*** COMMIT MODE - changes will be written ***'
                     : '--- DRY RUN - nothing will be written (pass --commit to apply) ---');

  const sheet = parseCsv(fs.readFileSync(FILE, 'utf8'));
  console.log(`\nrows in sheet: ${sheet.length}`);

  const required = ['Job ID', 'BL ID', 'MAWB As Entered', 'Corrected MAWB', 'Corrected Airline'];
  const missing = required.filter((c) => !(c in (sheet[0] || {})));
  if (missing.length) {
    console.error(`\nSheet is missing column(s): ${missing.join(', ')}`);
    console.error('Use the sheet produced by scripts/backfillAwbl.js without renaming its columns.');
    process.exit(1);
  }

  // Airlines are parties whose `types` contains 'Air Line' - the same set the
  // job's airline picker offers.
  const [airlines] = await sequelize.query(
    `SELECT id, name, code FROM "Clients" WHERE types ILIKE '%Air Line%'`
  );
  const airlineByKey = new Map();
  for (const a of airlines) {
    for (const key of [norm(a.name), norm(a.code), norm(`${a.name} (${a.code})`)]) {
      if (!key) continue;
      // A key matching two different airlines is ambiguous, so it is poisoned
      // rather than resolved to whichever was seen first.
      airlineByKey.set(key, airlineByKey.has(key) && airlineByKey.get(key)?.id !== a.id ? null : a);
    }
  }

  const planned = [];
  const rejected = [];
  const reject = (row, reason) => rejected.push({ ...row, Rejected: reason });

  // Two numbers typed into the sheet that clash with each other must both be
  // refused; catching that needs a pass over the whole sheet, not row by row.
  const proposedByCompanyNumber = new Map();
  for (const row of sheet) {
    const digits = digitsOnly(row['Corrected MAWB']);
    if (digits.length !== 11) continue;
    const key = `${row['Company']}|${digits}`;
    proposedByCompanyNumber.set(key, (proposedByCompanyNumber.get(key) || 0) + 1);
  }

  for (const row of sheet) {
    const newMawbRaw = row['Corrected MAWB'];
    const newAirlineRaw = row['Corrected Airline'];
    if (!String(newMawbRaw).trim() && !String(newAirlineRaw).trim()) continue; // left blank on purpose

    const blId = Number(row['BL ID']);
    const jobId = Number(row['Job ID']);
    if (!blId || !jobId) { reject(row, 'Job ID / BL ID missing or not a number.'); continue; }

    const [[current]] = await sequelize.query(`
      SELECT b.id AS "blId", b.mbl, j.id AS "jobId", j."jobNo", j."companyId", j."airLineId"
        FROM "Bls" b JOIN "SE_Jobs" j ON j.id = b."SEJobId"
       WHERE b.id = ${sequelize.escape(blId)} AND j.id = ${sequelize.escape(jobId)}`);

    if (!current) { reject(row, 'That job/BL no longer exists.'); continue; }

    // The sheet is a snapshot. If the live value has moved on, somebody edited
    // the job after the sheet went out and applying would revert them.
    if (digitsOnly(current.mbl) !== digitsOnly(row['MAWB As Entered'])) {
      reject(row, `Changed since the sheet was produced - job now reads "${current.mbl}". Re-export and re-check this one.`);
      continue;
    }

    const change = { row, blId, jobId, jobNo: current.jobNo, companyId: String(current.companyId) };

    /* ---------------------------- MAWB ---------------------------- */
    if (String(newMawbRaw).trim()) {
      const digits = digitsOnly(newMawbRaw);
      if (digits.length !== 11) {
        reject(row, `Corrected MAWB has ${digits.length} digits, needs 11 (3-digit prefix + 7-digit serial + check digit).`);
        continue;
      }
      const parsed = parseEntry(digits.slice(0, 3), digits.slice(3));
      if (!parsed.ok) { reject(row, `Corrected MAWB is not valid. ${parsed.error}`); continue; }

      if (proposedByCompanyNumber.get(`${row['Company']}|${digits}`) > 1) {
        reject(row, `${formatNumber(digits)} was written against more than one job in this sheet. Each job needs its own number.`);
        continue;
      }

      // Collides with a different job that already carries this number?
      const [clash] = await sequelize.query(`
        SELECT j."jobNo" FROM "Bls" b JOIN "SE_Jobs" j ON j.id = b."SEJobId"
         WHERE j.operation IN ('AE','AI') AND j."companyId" = ${sequelize.escape(current.companyId)}
           AND b.id <> ${sequelize.escape(blId)}
           AND regexp_replace(COALESCE(b.mbl,''),'[^0-9]','','g') = ${sequelize.escape(digits)}
         LIMIT 1`);
      if (clash.length) {
        reject(row, `${formatNumber(digits)} is already on job ${clash[0].jobNo}. Pick a different number.`);
        continue;
      }

      // ...or with something already in the register under another job?
      const [registered] = await sequelize.query(`
        SELECT "SEJobId", status FROM "Awbls"
         WHERE "companyId" = ${sequelize.escape(String(current.companyId))}
           AND "awbNumber" = ${sequelize.escape(digits)} LIMIT 1`);
      if (registered.length && registered[0].SEJobId && Number(registered[0].SEJobId) !== jobId) {
        reject(row, `${formatNumber(digits)} is already registered against another job.`);
        continue;
      }

      change.mbl = { from: current.mbl, to: formatNumber(digits) };
    }

    /* --------------------------- airline -------------------------- */
    if (String(newAirlineRaw).trim()) {
      const key = norm(newAirlineRaw);
      const match = airlineByKey.has(key) ? airlineByKey.get(key) : undefined;
      if (match === undefined) {
        reject(row, `Airline "${newAirlineRaw}" not found. Use the airline's exact name or its code as it appears in Parties.`);
        continue;
      }
      if (match === null) {
        reject(row, `Airline "${newAirlineRaw}" matches more than one party. Use the code instead.`);
        continue;
      }
      if (Number(match.id) !== Number(current.airLineId)) {
        change.airline = { from: current.airLineId, to: match.id, name: `${match.name} (${match.code})` };
      }
    }

    if (change.mbl || change.airline) planned.push(change);
    else reject(row, 'Nothing to change - the values given already match the job.');
  }

  /* ---------------------------- report ---------------------------- */
  console.log(`\nplanned changes: ${planned.length}`);
  for (const c of planned) {
    const bits = [];
    if (c.mbl) bits.push(`MAWB ${c.mbl.from || '(blank)'} -> ${c.mbl.to}`);
    if (c.airline) bits.push(`airline -> ${c.airline.name}`);
    console.log(`   ${c.jobNo}: ${bits.join('; ')}`);
  }

  if (rejected.length) {
    console.log(`\nREJECTED: ${rejected.length}`);
    rejected.slice(0, 15).forEach((r) => console.log(`   ${r['Job No']}: ${r.Rejected}`));
    if (rejected.length > 15) console.log(`   ... and ${rejected.length - 15} more`);

    const cols = [...Object.keys(rejected[0])];
    const lines = [cols.join(',')];
    rejected.forEach((r) => lines.push(cols.map((c) => csvCell(r[c])).join(',')));
    fs.writeFileSync(OUT_PATH, '﻿' + lines.join('\r\n') + '\r\n', 'utf8');
    console.log(`\n   rejected rows written to: ${OUT_PATH}`);
  }

  if (!COMMIT) {
    console.log('\nDry run finished - nothing written. Re-run with --commit to apply.');
    return;
  }
  if (!planned.length) { console.log('\nNothing to apply.'); return; }

  /* ----------------------------- apply ---------------------------- */
  // One transaction for the whole sheet: a half-applied correction run would
  // be far harder to reason about than one that simply did not happen.
  const t = await sequelize.transaction();
  try {
    for (const c of planned) {
      if (c.mbl) {
        await sequelize.query(
          `UPDATE "Bls" SET mbl = :mbl, "updatedAt" = now() WHERE id = :id`,
          { replacements: { mbl: c.mbl.to, id: c.blId }, transaction: t }
        );
      }
      if (c.airline) {
        await sequelize.query(
          `UPDATE "SE_Jobs" SET "airLineId" = :airline, "updatedAt" = now() WHERE id = :id`,
          { replacements: { airline: c.airline.to, id: c.jobId }, transaction: t }
        );
      }
    }
    await t.commit();
    console.log(`\nDone. Applied ${planned.length} correction(s).`);
    console.log('Now re-run: node scripts/backfillAwbl.js   (dry run) to see the list shrink.');
  } catch (err) {
    await t.rollback().catch(() => {});
    throw err;
  }
}

main()
  .catch((err) => { console.error('Apply failed:', err); process.exitCode = 1; })
  .finally(async () => { await sequelize.close(); });
