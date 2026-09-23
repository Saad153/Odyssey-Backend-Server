/*
 * Renumbers vouchers created in Odyssey during a fiscal year so the sequence
 * restarts each year, as it always did in Climax and as invoice numbering
 * still does.
 *
 *   node scripts/renumberFiscalYearVouchers.js --year=27            # DRY RUN
 *   node scripts/renumberFiscalYearVouchers.js --year=27 --commit
 *
 * WHY
 * None of the voucher numbering lookups scoped by fiscal year, so every
 * voucher created in Odyssey continued from the previous year's maximum.
 * FY27 opened at SNS-BPV-1876 instead of restarting just above the imported
 * Climax range. Those lookups are fixed (functions/voucherNumber.js); this
 * brings the rows they already produced back into sequence.
 *
 * WHAT IT DOES
 * Within each (company, voucher type) group for the given year:
 *   - vouchers IMPORTED from Climax keep their number untouched. They are the
 *     old system's record and are numbered correctly already.
 *   - vouchers CREATED IN ODYSSEY are renumbered consecutively starting just
 *     above the highest imported number, preserving their existing order so
 *     the chronological sequence is unchanged.
 *
 * Imported rows are identified by their zero-padded number (SNS-BPV-00022/27);
 * Odyssey writes them plain (SNS-BPV-1876/27).
 *
 * SAFETY
 *  - Dry run unless --commit, printing every before -> after.
 *  - Writes the complete before-state to backups/ first, so any run can be
 *    reversed row by row without a full restore.
 *  - Renumbering happens in one transaction, via a temporary parking range, so
 *    a number can never briefly collide with one still in use.
 *  - Refuses to run if the target range would overlap an imported voucher.
 *  - Only voucher_No and voucher_Id change. Amounts, accounts, dates, company
 *    and fiscal year are untouched, and every cross-table reference to a
 *    voucher is by integer primary key, so nothing else needs updating.
 */
const fs = require('fs');
const path = require('path');
const db = require('../models');
const { sequelize } = db;

const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const argValue = (n) => {
  const hit = args.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.split('=')[1] : null;
};
const YEAR = argValue('year');

const IMPORTED = `"voucher_Id" ~ '-0[0-9]{4}/'`;

async function main() {
  if (!YEAR) {
    console.error('Usage: node scripts/renumberFiscalYearVouchers.js --year=27 [--commit]');
    process.exit(1);
  }

  await sequelize.authenticate();
  await db.syncPromise;

  console.log(COMMIT ? '*** COMMIT MODE - changes will be written ***'
                     : '--- DRY RUN - nothing will be written (pass --commit to apply) ---');
  console.log(`fiscal year suffix: /${YEAR}\n`);

  const [rows] = await sequelize.query(`
    SELECT id, "voucher_Id", "voucher_No", "vType", "CompanyId", type,
           "createdAt", (${IMPORTED}) AS imported
      FROM "Vouchers"
     WHERE "voucher_Id" LIKE '%/${YEAR}'
     ORDER BY "CompanyId", "vType", "voucher_No", id
  `);

  if (!rows.length) { console.log('No vouchers for that year.'); return; }

  // group -> { imported: [...], created: [...] }
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.CompanyId}|${r.vType}`;
    if (!groups.has(key)) groups.set(key, { imported: [], created: [] });
    groups.get(key)[r.imported ? 'imported' : 'created'].push(r);
  }

  const plan = [];
  const skipped = [];

  for (const [key, { imported, created }] of [...groups.entries()].sort()) {
    const [companyId, vType] = key.split('|');
    if (!created.length) continue;

    const importedHigh = imported.reduce((m, r) => Math.max(m, Number(r.voucher_No)), 0);
    let next = importedHigh + 1;

    // created is already ordered by voucher_No, so relative order is preserved.
    const moves = created
      .map((r) => ({ row: r, from: Number(r.voucher_No), to: next++ }))
      .filter((m) => m.from !== m.to);

    const importedNumbers = new Set(imported.map((r) => Number(r.voucher_No)));
    const overlap = moves.filter((m) => importedNumbers.has(m.to));
    if (overlap.length) {
      skipped.push({ key, reason: `target numbers would collide with imported vouchers (${overlap.length})` });
      continue;
    }

    console.log(`company ${companyId} / ${vType}: ${imported.length} imported (up to ${importedHigh}), ` +
                `${created.length} created in Odyssey -> renumbering to ${importedHigh + 1}..${importedHigh + created.length}`);
    plan.push(...moves);
  }

  if (skipped.length) {
    console.log('\nSKIPPED GROUPS:');
    skipped.forEach((s) => console.log(`   ${s.key}: ${s.reason}`));
  }

  console.log(`\ntotal vouchers to renumber: ${plan.length}`);
  plan.slice(0, 15).forEach(({ row, to }) => {
    const newId = row.voucher_Id.replace(/-(\d+)\/(\d+)$/, `-${to}/$2`);
    console.log(`   ${row.voucher_Id}  ->  ${newId}`);
  });
  if (plan.length > 15) console.log(`   ... and ${plan.length - 15} more`);

  if (!plan.length) { console.log('\nNothing to do.'); return; }

  // Written in both modes: the dry run leaves behind exactly the file needed
  // to reverse the commit that follows it.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = path.join(__dirname, '..', 'backups', `voucher-renumber-before-${YEAR}-${stamp}.csv`);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.writeFileSync(backup,
    'id,old_voucher_Id,old_voucher_No,new_voucher_Id,new_voucher_No\n' +
    plan.map(({ row, to }) =>
      [row.id, row.voucher_Id, row.voucher_No,
       row.voucher_Id.replace(/-(\d+)\/(\d+)$/, `-${to}/$2`), to].join(',')).join('\n') + '\n');
  console.log(`\nbefore/after written to: ${backup}`);

  if (!COMMIT) {
    console.log('\nDry run finished - nothing written. Re-run with --commit to apply.');
    return;
  }

  const t = await sequelize.transaction();
  try {
    // Two passes through a parking range. Renumbering 1876->23 while 23 may
    // itself still be waiting to move would otherwise collide mid-flight; the
    // offset lifts every row clear of both the old and new ranges first.
    const PARK = 1000000;
    for (const { row } of plan) {
      await sequelize.query(
        `UPDATE "Vouchers" SET "voucher_No" = "voucher_No" + ${PARK} WHERE id = :id`,
        { replacements: { id: row.id }, transaction: t }
      );
    }
    for (const { row, to } of plan) {
      const newId = row.voucher_Id.replace(/-(\d+)\/(\d+)$/, `-${to}/$2`);
      await sequelize.query(
        `UPDATE "Vouchers" SET "voucher_No" = :no, "voucher_Id" = :vid, "updatedAt" = now() WHERE id = :id`,
        { replacements: { no: to, vid: newId, id: row.id }, transaction: t }
      );
    }
    await t.commit();
    console.log(`\nDone. Renumbered ${plan.length} voucher(s).`);
  } catch (err) {
    await t.rollback().catch(() => {});
    throw err;
  }
}

main()
  .catch((err) => { console.error('Renumber failed:', err); process.exitCode = 1; })
  .finally(async () => { await sequelize.close(); });
