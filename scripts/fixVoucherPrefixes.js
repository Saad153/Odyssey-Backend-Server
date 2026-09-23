/*
 * Repairs voucher numbers whose company prefix disagrees with the company the
 * voucher actually belongs to.
 *
 *   node scripts/fixVoucherPrefixes.js            # DRY RUN - reports only
 *   node scripts/fixVoucherPrefixes.js --commit   # apply
 *   node scripts/fixVoucherPrefixes.js --force    # include unverified rows
 *
 * BACKGROUND
 * routes/voucher/index.js /makeTransaction built the prefix with a strict
 * `v.CompanyId === 1`. CompanyId arrives from the frontend as the string "1",
 * so both comparisons failed and it fell through to the "ACS" default. Sea Net
 * (and Cargo Linkers) payments and receipts were therefore numbered ACS-…,
 * which is why ACS voucher numbers appeared in the SNS bank ledger. ACS came
 * out correct only by accident. That line is fixed; this repairs the rows it
 * already produced.
 *
 * ONLY the label is wrong. voucher_No, CompanyId, amounts, accounts and the
 * fiscal year are all correct, so this rewrites voucher_Id and nothing else -
 * keeping the same number, so anything referencing it still lines up.
 *
 * SAFETY
 *  - Dry run unless --commit.
 *  - CompanyId is the authority (it is what the ledger filters on and what the
 *    numbering sequence is drawn from), but each row is INDEPENDENTLY checked
 *    before being touched: the voucher must post to a bank or cash account
 *    whose name carries the company's short code. A voucher that fails that
 *    check is skipped and listed rather than renamed on faith - see --force.
 *  - A rename that would collide with an existing voucher_Id is refused.
 *  - One transaction: the whole batch applies or none of it does.
 */
const db = require('../models');
const { sequelize } = db;

const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const FORCE = args.includes('--force');

const prefixFor = (companyId) =>
  String(companyId) === '1' ? 'SNS' : String(companyId) === '2' ? 'CLS' : 'ACS';

async function main() {
  await sequelize.authenticate();
  await db.syncPromise;

  console.log(COMMIT ? '*** COMMIT MODE - changes will be written ***'
                     : '--- DRY RUN - nothing will be written (pass --commit to apply) ---');

  const [companies] = await sequelize.query(`SELECT id, title, short FROM "Companies"`);
  const shortById = new Map(companies.map((c) => [String(c.id), c.short]));

  // Every voucher whose prefix disagrees with its own CompanyId, together with
  // the bank/cash accounts it posts to - that is the independent evidence of
  // which company it really belongs to.
  const [rows] = await sequelize.query(`
    SELECT v.id, v."voucher_Id", v."voucher_No", v."vType", v.type, v."CompanyId",
           v."createdAt"::date AS "on",
           COALESCE(string_agg(DISTINCT ca.title, ' | ')
                    FILTER (WHERE vh."accountType" ILIKE '%bank%'
                                OR vh."accountType" ILIKE '%cash%'), '') AS "moneyAccounts",
           COALESCE(string_agg(DISTINCT ca.title, ' | '), '') AS "allAccounts"
      FROM "Vouchers" v
      LEFT JOIN "Voucher_Heads" vh ON vh."VoucherId" = v.id
      LEFT JOIN "Child_Accounts" ca ON ca.id = vh."ChildAccountId"
     WHERE v."voucher_Id" ~ '^(SNS|ACS|CLS)-'
       AND left(v."voucher_Id", 3) <> CASE
             WHEN v."CompanyId" = 1 THEN 'SNS'
             WHEN v."CompanyId" = 2 THEN 'CLS'
             ELSE 'ACS' END
     GROUP BY v.id
     ORDER BY v."CompanyId", v."vType", v."voucher_No"
  `);

  console.log(`\nvouchers whose prefix disagrees with their company: ${rows.length}`);
  if (!rows.length) { console.log('Nothing to do.'); return; }

  const planned = [];
  const unverified = [];
  const collisions = [];

  for (const row of rows) {
    const want = prefixFor(row.CompanyId);
    const newId = `${want}${row.voucher_Id.slice(3)}`;

    // Renaming onto an id that already exists would create two vouchers with
    // the same number - worse than the wrong prefix.
    const [[clash]] = await sequelize.query(
      `SELECT id FROM "Vouchers" WHERE "voucher_Id" = ${sequelize.escape(newId)} AND id <> ${row.id} LIMIT 1`
    );
    if (clash) { collisions.push({ row, newId }); continue; }

    // Independent check: does the money actually move through an account
    // belonging to the company the row claims? Account titles carry the short
    // code (e.g. "BANK AL-HABIB SNSL"), which is the only company marker in
    // the chart of accounts - it has no company column of its own.
    const short = shortById.get(String(row.CompanyId)) || '';
    const haystack = `${row.moneyAccounts} ${row.allAccounts}`.toUpperCase();
    const verified = short && haystack.includes(short.toUpperCase());

    if (!verified && !FORCE) { unverified.push({ row, newId }); continue; }
    planned.push({ row, newId, verified });
  }

  const show = (label, list, extra = () => '') => {
    if (!list.length) return;
    console.log(`\n${label}: ${list.length}`);
    // `::date` comes back from pg as a plain 'YYYY-MM-DD' string, not a Date.
    list.slice(0, 30).forEach(({ row, newId }) =>
      console.log(`   ${row.voucher_Id}  ->  ${newId}   [${row.type}/${row.vType}, company ${row.CompanyId}, ${String(row.on).slice(0, 10)}]${extra(row)}`));
    if (list.length > 30) console.log(`   ... and ${list.length - 30} more`);
  };

  show('WILL RENAME', planned, (r) => `  via ${r.moneyAccounts || r.allAccounts || '(no accounts)'}`);
  show('SKIPPED - could not confirm the company from its accounts (use --force to include)', unverified,
    (r) => `  accounts: ${r.allAccounts || '(none)'}`);
  show('SKIPPED - target number already exists', collisions);

  if (!COMMIT) {
    console.log('\nDry run finished - nothing written. Re-run with --commit to apply.');
    return;
  }
  if (!planned.length) { console.log('\nNothing to apply.'); return; }

  const t = await sequelize.transaction();
  try {
    for (const { row, newId } of planned) {
      await sequelize.query(
        `UPDATE "Vouchers" SET "voucher_Id" = :newId, "updatedAt" = now() WHERE id = :id`,
        { replacements: { newId, id: row.id }, transaction: t }
      );
    }
    await t.commit();
    console.log(`\nDone. Renumbered ${planned.length} voucher(s).`);
  } catch (err) {
    await t.rollback().catch(() => {});
    throw err;
  }
}

main()
  .catch((err) => { console.error('Fix failed:', err); process.exitCode = 1; })
  .finally(async () => { await sequelize.close(); });
