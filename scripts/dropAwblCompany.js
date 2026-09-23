/*
 * Removes the company connection from the AWB register.
 *
 *   node scripts/dropAwblCompany.js            # DRY RUN
 *   node scripts/dropAwblCompany.js --commit
 *
 * WHY
 * AWB stock belongs to the GROUP. Airlines allocate numbers to Sea Net / Air
 * Cargo jointly and either company can use any of them, so there is one pool,
 * not one per company. Holding a companyId on each number implied ownership
 * that does not exist - and, because registration was checked within a company,
 * it let the same number be registered twice (25 of those were cleared by
 * scripts/enforceGlobalAwblUniqueness.js).
 *
 * Which company actually consumed a number is still answerable: the row links
 * to the job, and the job carries the company. Nothing is lost that cannot be
 * derived - except for unused stock, which has no job and by definition belongs
 * to nobody in particular now.
 *
 * SAFETY
 *  - Dry run unless --commit.
 *  - Every existing companyId value is written to backups/ first, so the column
 *    can be reconstructed row by row if this turns out to be wrong.
 *  - Drops the old per-company unique index with the column (Postgres would
 *    otherwise refuse, since the index depends on it).
 *  - Column drop is irreversible in the sense that a plain re-add loses the
 *    values - hence the backup above.
 */
const fs = require('fs');
const path = require('path');
const db = require('../models');
const { sequelize } = db;

const COMMIT = process.argv.slice(2).includes('--commit');
const OLD_INDEX = 'awbls_company_id_awb_number';

async function main() {
  await sequelize.authenticate();
  await db.syncPromise;

  console.log(COMMIT ? '*** COMMIT MODE - changes will be written ***'
                     : '--- DRY RUN - nothing will be written (pass --commit to apply) ---');

  const [[col]] = await sequelize.query(`
    SELECT count(*)::int AS n FROM information_schema.columns
     WHERE table_name = 'Awbls' AND column_name = 'companyId'`);

  if (!col.n) {
    console.log('\ncompanyId is already gone from "Awbls". Nothing to do.');
    return;
  }

  const [rows] = await sequelize.query(`
    SELECT a.id, a."awbNumber", a."companyId", a.status, a."SEJobId", j."jobNo",
           j."companyId" AS "jobCompany"
      FROM "Awbls" a
      LEFT JOIN "SE_Jobs" j ON j.id = a."SEJobId"
     ORDER BY a.id`);

  const byCompany = rows.reduce((acc, r) => {
    acc[r.companyId] = (acc[r.companyId] || 0) + 1;
    return acc;
  }, {});
  console.log(`\nrows: ${rows.length}`);
  Object.entries(byCompany).forEach(([k, v]) => console.log(`   companyId ${k}: ${v}`));

  // Worth surfacing: where a number IS linked to a job, does the recorded
  // company agree with that job's? Any mismatch is a sign the column was not
  // reliable anyway, which makes dropping it easier to justify.
  const linked = rows.filter((r) => r.SEJobId);
  const disagree = linked.filter((r) => String(r.companyId) !== String(r.jobCompany));
  console.log(`\nlinked to a job: ${linked.length}, of which the stored company ` +
              `disagrees with the job's: ${disagree.length}`);
  disagree.slice(0, 10).forEach((r) =>
    console.log(`   ${r.awbNumber}: stored ${r.companyId}, job ${r.jobNo} is ${r.jobCompany}`));

  const unlinked = rows.filter((r) => !r.SEJobId);
  console.log(`unused stock with no job (company becomes meaningless): ${unlinked.length}`);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join(__dirname, '..', 'backups', `awbl-companyId-before-drop-${stamp}.csv`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out,
    'id,awbNumber,companyId,status,SEJobId,jobNo,jobCompany\n' +
    rows.map((r) => [r.id, r.awbNumber, r.companyId, r.status, r.SEJobId || '', r.jobNo || '', r.jobCompany || ''].join(',')).join('\n') + '\n');
  console.log(`\ncompanyId values saved to: ${out}`);

  if (!COMMIT) {
    console.log('\nDry run finished - nothing written. Re-run with --commit to drop the column.');
    return;
  }

  // The unique index is on (companyId, awbNumber), so it has to go first -
  // Postgres will not drop a column an index depends on.
  await sequelize.query(`DROP INDEX IF EXISTS "${OLD_INDEX}"`);
  await sequelize.query(`ALTER TABLE "Awbls" DROP COLUMN IF EXISTS "companyId"`);
  console.log(`\nDropped index ${OLD_INDEX} and column "companyId". AWB stock is now group-wide.`);

  const [[dupes]] = await sequelize.query(
    `SELECT count(*)::int AS n FROM (SELECT "awbNumber" FROM "Awbls" GROUP BY 1 HAVING count(*) > 1) z`);
  if (dupes.n) {
    console.log(`\n${dupes.n} duplicate number(s) still present - the unique index cannot be added yet.`);
    console.log('Resolve them, then run: node scripts/enforceGlobalAwblUniqueness.js --commit');
  } else {
    console.log('\nNo duplicates remain - run scripts/enforceGlobalAwblUniqueness.js --commit to add the unique index.');
  }
}

main()
  .catch((err) => { console.error('Failed:', err); process.exitCode = 1; })
  .finally(async () => { await sequelize.close(); });
