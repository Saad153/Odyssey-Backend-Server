/*
 * Makes AWB numbers unique across ALL companies, and clears the duplicates
 * that the old per-company rule allowed in.
 *
 *   node scripts/enforceGlobalAwblUniqueness.js            # DRY RUN
 *   node scripts/enforceGlobalAwblUniqueness.js --commit
 *
 * WHY
 * An air waybill number is unique worldwide - the airline prefix plus serial
 * identifies one shipment, globally. The register was originally keyed on
 * (companyId, awbNumber) back when stock was thought to be per company, which let
 * the same number be registered under two companies at once. Ownership stays
 * per company; uniqueness becomes global.
 *
 * WHAT IT DOES
 * Per duplicated number:
 *   - exactly one row is `used` -> the unused copies are deleted. A number
 *     consumed by a real job is the true owner; an unused copy elsewhere is
 *     stock that was registered by mistake and has never been issued.
 *   - all rows unused        -> the earliest registration is kept, the rest
 *     deleted. Nothing has been issued either way.
 *   - two or more rows `used` -> LEFT ALONE and reported. Two real jobs are
 *     carrying the same number; only operations can say which is right, and
 *     deleting either would detach it from a shipment that exists.
 *
 * Then, once no duplicates remain, it swaps the per-company unique index for a
 * global one so the database enforces this from here on.
 *
 * SAFETY
 *  - Dry run unless --commit; prints every row it would delete.
 *  - Writes the full before-state to backups/ first.
 *  - Never deletes a `used` row - only stock that has never been issued.
 *  - The index is only created once the table is genuinely clean; if any
 *    unresolved duplicate remains, the index step is skipped and reported.
 */
const fs = require('fs');
const path = require('path');
const db = require('../models');
const { sequelize } = db;

const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');

const OLD_INDEX = 'awbls_company_id_awb_number';
const NEW_INDEX = 'awbls_awb_number_unique';

async function main() {
  await sequelize.authenticate();
  await db.syncPromise;

  console.log(COMMIT ? '*** COMMIT MODE - changes will be written ***'
                     : '--- DRY RUN - nothing will be written (pass --commit to apply) ---');

  const [dupes] = await sequelize.query(`
    SELECT a.id, a."awbNumber", a.status, a."SEJobId", a."createdAt",
           j."companyId" AS "jobCompany",
           j."jobNo", cl.name AS airline
      FROM "Awbls" a
      LEFT JOIN "SE_Jobs" j ON j.id = a."SEJobId"
      LEFT JOIN "Clients" cl ON cl.id = a."AirlineId"
     WHERE a."awbNumber" IN (
             SELECT "awbNumber" FROM "Awbls" GROUP BY 1 HAVING count(*) > 1
           )
     ORDER BY a."awbNumber", a.status DESC, a.id
  `);

  const groups = new Map();
  for (const r of dupes) {
    if (!groups.has(r.awbNumber)) groups.set(r.awbNumber, []);
    groups.get(r.awbNumber).push(r);
  }
  console.log(`\nnumbers registered more than once: ${groups.size}`);

  const toDelete = [];
  const conflicts = [];

  for (const [number, rows] of groups) {
    const used = rows.filter((r) => r.status === 'used');

    if (used.length > 1) {
      conflicts.push({ number, rows: used });
      continue;
    }

    // Keep the used row if there is one, otherwise the earliest registration.
    const keep = used[0] || rows.slice().sort((a, b) => a.id - b.id)[0];
    rows.filter((r) => r.id !== keep.id).forEach((r) => toDelete.push({ row: r, keep, number }));
  }

  if (toDelete.length) {
    console.log(`\nWILL DELETE ${toDelete.length} unused duplicate registration(s):`);
    toDelete.slice(0, 30).forEach(({ row, keep, number }) =>
      console.log(`   ${number}  drop id=${row.id} (${row.status})` +
                  `  keeping id=${keep.id} (${keep.status}${keep.jobNo ? `, job ${keep.jobNo}` : ''})`));
    if (toDelete.length > 30) console.log(`   ... and ${toDelete.length - 30} more`);
  }

  if (conflicts.length) {
    console.log(`\nCONFLICTS - same number used by two real jobs, needs a human decision: ${conflicts.length}`);
    conflicts.forEach(({ number, rows }) => {
      console.log(`   ${number}:`);
      rows.forEach((r) => console.log(`      job ${r.jobNo || r.SEJobId} (company ${r.jobCompany || '?'}), airline ${r.airline || '-'}`));
    });
    console.log('   These are left untouched. Decide which job keeps the number, correct the');
    console.log('   other job\'s MAWB, then re-run this script to add the unique index.');
  }

  if (toDelete.length || conflicts.length) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const out = path.join(__dirname, '..', 'backups', `awbl-duplicates-${stamp}.csv`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out,
      'action,awbNumber,id,companyId,status,SEJobId,jobNo,airline\n' +
      toDelete.map(({ row }) => ['delete', row.awbNumber, row.id, row.status, row.SEJobId || '', row.jobNo || '', row.jobCompany || '', row.airline || ''].join(',')).join('\n') +
      (toDelete.length && conflicts.length ? '\n' : '') +
      conflicts.flatMap(({ rows }) => rows.map((r) =>
        ['conflict', r.awbNumber, r.id, r.status, r.SEJobId || '', r.jobNo || '', r.jobCompany || '', r.airline || ''].join(','))).join('\n') + '\n');
    console.log(`\nbefore-state written to: ${out}`);
  }

  if (!COMMIT) {
    console.log('\nDry run finished - nothing written.');
    console.log('Re-run with --commit to delete the unused duplicates and add the global unique index.');
    return;
  }

  const t = await sequelize.transaction();
  try {
    for (const { row } of toDelete) {
      await sequelize.query(`DELETE FROM "Awbls" WHERE id = :id AND status <> 'used'`,
        { replacements: { id: row.id }, transaction: t });
    }
    await t.commit();
    console.log(`\nDeleted ${toDelete.length} duplicate registration(s).`);
  } catch (err) {
    await t.rollback().catch(() => {});
    throw err;
  }

  const [[still]] = await sequelize.query(
    `SELECT count(*)::int AS n FROM (SELECT "awbNumber" FROM "Awbls" GROUP BY 1 HAVING count(*) > 1) z`
  );
  if (still.n) {
    console.log(`\n${still.n} duplicate number(s) remain (the conflicts above).`);
    console.log('Global unique index NOT created - resolve those first, then re-run.');
    return;
  }

  // Swap the per-company index for the global one. Done here rather than left
  // to sync({alter:true}) because that sync currently aborts partway on an
  // unrelated Office_Vouchers column, so it cannot be relied on to apply it.
  await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS "${NEW_INDEX}" ON "Awbls" ("awbNumber")`);
  await sequelize.query(`DROP INDEX IF EXISTS "${OLD_INDEX}"`);
  console.log(`\nIndex ${NEW_INDEX} created and ${OLD_INDEX} dropped - AWB numbers are now globally unique.`);
  console.log('\n>>> NOW UPDATE models/Awbl.js: replace');
  console.log('        { fields: ["awbNumber"] },');
  console.log('    with');
  console.log(`        { name: "${NEW_INDEX}", unique: true, fields: ["awbNumber"] },`);
  console.log('    so sync() matches the database. Until then the model and schema disagree,');
  console.log('    and a future sync would try to re-add the old composite index.');
}

main()
  .catch((err) => { console.error('Failed:', err); process.exitCode = 1; })
  .finally(async () => { await sequelize.close(); });
