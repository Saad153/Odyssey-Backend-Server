// Standalone script (not a Jest test) that seeds stable, known e2e fixtures
// into the odyssey-test database for Playwright tests to drive through the
// real UI: two login users, plus the reference data the Jobs/Charges/
// Invoice/Ledger flow needs to exist before it'll work at all (a Company, an
// unlocked FiscalYear covering "today", a Client typed "Shipper", a
// Commodity, and a master Charge). Idempotent (findOrCreate keyed on a
// unique field per row) so it can be re-run freely.
// Run with: cross-env NODE_ENV=test node tests/e2e/seedE2eUsers.js

if (process.env.NODE_ENV !== 'test') {
  throw new Error('Refusing to run: NODE_ENV must be "test" (this seeds the odyssey-test database only).');
}

const config = require('../../config/config.json').test;
if (!/test/i.test(config.database)) {
  throw new Error(`Refusing to run against database "${config.database}" - it doesn't look like a test database.`);
}

const db = require('../../models');
const { Employees, Access_Levels, Company, FiscalYears, Clients, Commodity, Charges, Child_Account, Client_Associations } = db;

const E2E_PASSWORD = 'E2ePass123!';

// `designation` and `access` are two independent permission axes: the
// Parties/Employees screens gate on designation, while a lot of the app
// (including the invoice Approve checkbox, via
// functions/checkEmployeeAccess.js) gates on the JWT's `access` string,
// which is built from this user's Access_Levels rows at login. The admin
// fixture needs both to drive the full job -> invoice -> ledger flow.
const USERS = [
  { username: '__e2e__admin', name: '__e2e__ Admin', designation: 'admin', accessLevels: ['admin'] },
  { username: '__e2e__employee', name: '__e2e__ Employee', designation: 'employee', accessLevels: [] },
];

// Fixed, predictable names/codes so Playwright tests can find these by
// typing a known search string into antd's client-side-filtered dropdowns,
// without needing to share generated ids between the two repos.
const COMPANY_TITLE = '__e2e__ Test Company';
const FISCAL_YEAR_LABEL = '__e2e__ FY';
const CLIENT_NAME = '__e2e__ Test Shipper Client';
const COMMODITY_NAME = '__e2e__ Test Commodity';
const CHARGE_NAME = '__e2e__ Test Freight Charge';

async function seed() {
  await db.syncPromise;

  for (const u of USERS) {
    const [employee, created] = await Employees.findOrCreate({
      where: { username: u.username },
      defaults: { name: u.name, password: E2E_PASSWORD, designation: u.designation, active: 'true' },
    });
    if (!created) {
      // Keep credentials/designation in sync on re-runs in case the seed definition changes.
      await employee.update({ name: u.name, password: E2E_PASSWORD, designation: u.designation, active: 'true' });
    }
    await Access_Levels.destroy({ where: { EmployeeId: employee.id } });
    if (u.accessLevels.length) {
      await Access_Levels.bulkCreate(u.accessLevels.map((access_name) => ({ access_name, EmployeeId: employee.id })));
    }
    console.log(`${created ? 'created' : 'updated'}: ${u.username} (${u.designation}, access: ${u.accessLevels.join(',') || 'none'})`);
  }

  // Job creation reads `companyId` from a global cookie set at login from
  // the JWT's defaultCompanyId (see Components/Layouts/Login.js) - every
  // company-scoped page in the app depends on this being set, so both e2e
  // users need it, not just the one that happens to create jobs in a given
  // test.
  //
  // Company id 1/2/3 is effectively hardcoded across the app (the job-number
  // and voucher-id prefixes SNS/CLS/ACS, and the Ledger report's Company
  // radio group only offers those three), so a freshly created company with
  // some higher autoincrement id would produce vouchers the Ledger screen
  // can never display. Reuse company 1 when it exists so the fixtures behave
  // like production; only create a standalone one as a fallback.
  // Pinned to id 1 explicitly (rather than letting the sequence assign one)
  // so it maps to the "SEA NET SHIPPING & LOGISTICS" option and the SNS
  // prefix. Writing an explicit id doesn't advance the sequence, so later
  // auto-assigned company rows are unaffected.
  let [company] = await Company.findOrCreate({
    where: { id: 1 },
    defaults: { id: 1, title: COMPANY_TITLE, short: 'SNS' },
  });
  console.log(`company ready: ${company.title} (id ${company.id})`);
  await Employees.update(
    { defaultCompanyId: String(company.id) },
    { where: { username: USERS.map((u) => u.username) } }
  );

  // Wide, static date range so this never needs re-seeding as "today"
  // drifts - functions/Associations/fiscalYearAssociations requires every
  // job/charge/invoice create to resolve to a real, unlocked fiscal year.
  await FiscalYears.findOrCreate({
    where: { label: FISCAL_YEAR_LABEL },
    defaults: { label: FISCAL_YEAR_LABEL, suffix: 'E2E', startDate: '2020-01-01', endDate: '2099-12-31', isLocked: false },
  });
  console.log(`fiscal year ready: ${FISCAL_YEAR_LABEL}`);

  // types:'Shipper' + active:true + nongl:'0' makes this row appear in BOTH
  // the job's "Client" dropdown (routes/jobRoutes/sea.js getValues:
  // nongl!='1') and its "Shipper" dropdown (types includes 'Shipper') - one
  // seeded party covers both required fields.
  const [client] = await Clients.findOrCreate({
    where: { name: CLIENT_NAME },
    defaults: { name: CLIENT_NAME, code: 'E2E1', types: 'Shipper', active: true, nongl: '0' },
  });
  console.log(`client ready: ${CLIENT_NAME}`);

  // Invoicing resolves the party's ledger account through
  // Client_Associations -> Child_Account (routes/invoice/index.js
  // createInvoices reads `account.ChildAccountId`), and approving an
  // invoice posts the double entry against it. A bare Clients row has no
  // such account, which makes invoice creation fail outright - the real app
  // creates this via /clientRoutes/createClient, so the seed has to mirror
  // it.
  const [clientAccount] = await Child_Account.findOrCreate({
    where: { title: CLIENT_NAME },
    defaults: { title: CLIENT_NAME, subCategory: 'Customer', editable: false, code: '90001' },
  });
  await Client_Associations.findOrCreate({
    where: { ClientId: client.id },
    defaults: { ClientId: client.id, ChildAccountId: clientAccount.id },
  });
  console.log(`client ledger account ready: Child_Account #${clientAccount.id}`);

  // Approving an invoice also posts the contra side to a freight
  // income/expense account looked up BY EXACT TITLE, chosen from the job's
  // subType (FCL/LCL/AIR - see routes/invoice/index.js /approve). A new sea
  // job defaults to subType 'FCL', so those two titles must exist or
  // approval throws.
  for (const title of ['FCL FREIGHT INCOME', 'FCL FREIGHT EXPENSE']) {
    await Child_Account.findOrCreate({
      where: { title },
      defaults: { title, subCategory: 'Revenue', editable: false, code: title.includes('INCOME') ? '90002' : '90003' },
    });
    console.log(`account ready: ${title}`);
  }

  await Commodity.findOrCreate({
    where: { name: COMMODITY_NAME },
    defaults: { name: COMMODITY_NAME },
  });
  console.log(`commodity ready: ${COMMODITY_NAME}`);

  // defaultRecivableParty:'Client' makes Charges.js auto-resolve this
  // charge's party to the job's own ClientId when added on the Receivable
  // tab (see the `switch(partyType){ case "Client": ... }` in
  // ChargesComp/Charges.js) - avoids needing to drive the manual two-click
  // PartySearch picker in the happy-path e2e flow.
  await Charges.findOrCreate({
    where: { name: CHARGE_NAME },
    defaults: {
      name: CHARGE_NAME,
      code: 90001,
      short: 'E2EFRT',
      currency: 'USD',
      calculationType: 'Flat',
      defaultRecivableParty: 'Client',
      defaultPaybleParty: 'Client',
      taxApply: 'No',
      taxPerc: '0',
      status: true,
    },
  });
  console.log(`charge ready: ${CHARGE_NAME}`);

  console.log('E2E seed fixtures ready. Password for both users:', E2E_PASSWORD);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
