const request = require('supertest');
const app = require('../../index');
const { loginAs, TEST_PREFIX } = require('../helpers/auth');
const { Office_Vouchers, Vouchers, Company } = require('../../models');
const { Op } = require('sequelize');

// routes/voucher/index.js has no requireDesignation gates. Full voucher
// creation through the route (/voucherCreation, /createVoucher,
// /makeTransaction, etc.) needs a resolved FiscalYear + real Child_Account
// chart-of-accounts rows, which is a lot of unrelated setup for "basic CRUD
// smoke coverage" - this file exercises the Office_Vouchers sub-resource for
// a real create/read/update path instead, plus smoke coverage (auth +
// non-throwing) on the read-only Vouchers endpoints.
//
// Office_Vouchers.EmployeeId and Office_Vouchers.VoucherId are both
// allowNull:false (see functions/Associations/voucherAssociations), and
// Vouchers.CompanyId is also allowNull:false (see the same file) - so even
// this "simple" sub-resource needs one real Company + one real Vouchers row
// as FK prerequisites. Those are seeded directly via the models (bypassing
// the fiscal-year-resolution beforeCreate hook with
// `{ fiscalYearCheck: false }`, the same escape hatch legacy-import routes
// use) rather than through the API, since creating them "for real" would
// pull in the fiscal year flow this file is deliberately avoiding.
describe('Voucher - routes/voucher/index.js (smoke coverage)', () => {
  let authHeader;
  let employee;
  let company;
  let prereqVoucher;

  beforeAll(async () => {
    ({ authHeader, employee } = await loginAs('employee'));
    company = await Company.create({ title: `${TEST_PREFIX}Company ${Date.now()}`, short: 'TST' });
    prereqVoucher = await Vouchers.create(
      {
        voucher_No: 1,
        voucher_Id: `${TEST_PREFIX}V-${Date.now()}`,
        type: 'Office',
        vType: 'OV',
        CompanyId: company.id,
      },
      { fiscalYearCheck: false }
    );
  });

  afterAll(async () => {
    await Office_Vouchers.destroy({ where: { EmployeeId: employee.id } });
    await Vouchers.destroy({ where: { id: prereqVoucher.id }, fiscalYearCheck: false });
    await Company.destroy({ where: { id: company.id } });
  });

  it('rejects requests with no auth token at all (401)', async () => {
    const res = await request(app).get('/voucher/getAllVouchers');
    expect(res.status).toBe(401);
  });

  describe('Office_Vouchers CRUD', () => {
    it('creates an office voucher via /voucher/OfficeVoucherUpsert', async () => {
      const res = await request(app)
        .post('/voucher/OfficeVoucherUpsert')
        .set('Authorization', authHeader)
        .send({
          requestedBy: `${TEST_PREFIX}Someone`,
          preparedBy: `${TEST_PREFIX}Preparer`,
          amount: '1000',
          approved: false,
          EmployeeId: employee.id,
          VoucherId: prereqVoucher.id,
        });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.result[0]).toHaveProperty('id');
    });

    it('reads it back via /voucher/OfficeVoucherById', async () => {
      const created = (
        await request(app)
          .post('/voucher/OfficeVoucherUpsert')
          .set('Authorization', authHeader)
          .send({ requestedBy: `${TEST_PREFIX}ReadBack`, amount: '500', EmployeeId: employee.id, VoucherId: prereqVoucher.id })
      ).body.result[0];

      const res = await request(app)
        .get('/voucher/OfficeVoucherById')
        .set('Authorization', authHeader)
        .set('id', String(created.id));
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.result.id).toBe(created.id);
    });

    it('approves an office voucher via /voucher/ApproveOfficeVoucher', async () => {
      const created = (
        await request(app)
          .post('/voucher/OfficeVoucherUpsert')
          .set('Authorization', authHeader)
          .send({ requestedBy: `${TEST_PREFIX}ToApprove`, amount: '250', approved: false, EmployeeId: employee.id, VoucherId: prereqVoucher.id })
      ).body.result[0];

      const res = await request(app)
        .post('/voucher/ApproveOfficeVoucher')
        .set('Authorization', authHeader)
        .send({ id: created.id, approved: true, VoucherId: prereqVoucher.id });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');

      const updated = await Office_Vouchers.findByPk(created.id);
      expect(updated.approved).toBe(true);
    });

    // FIXED: models/Office_Vouchers.js used to declare
    // `CompanyId: { type: DataTypes.BOOLEAN }` - clearly wrong, since every
    // other route in this codebase treats company ids as small integers
    // (e.g. routes/voucher's own "SNS"/"CLS"/"ACS" mapping). Postgres used
    // to accept "1"/"0" as boolean literals (so id 1 "worked" by
    // coincidence) but threw a real type-cast error for any other id, e.g.
    // "4". It's now DataTypes.INTEGER, so arbitrary company ids work.
    it('/voucher/OfficeAllVouchers succeeds for a real (non-boolean-like) company id like "4"', async () => {
      const res = await request(app)
        .get('/voucher/OfficeAllVouchers')
        .set('Authorization', authHeader)
        .set('companyid', '4');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.result)).toBe(true);
    });

    it('also succeeds for company id "1" (previously only worked by boolean-cast coincidence)', async () => {
      const res = await request(app)
        .get('/voucher/OfficeAllVouchers')
        .set('Authorization', authHeader)
        .set('companyid', '1');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.result)).toBe(true);
    });
  });

  describe('Read-only Vouchers endpoints (smoke: authenticated + does not throw)', () => {
    it('GET /voucher/getAllVouchers', async () => {
      const res = await request(app).get('/voucher/getAllVouchers').set('Authorization', authHeader).set('id', String(company.id));
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.result)).toBe(true);
    });

    it('GET /voucher/testgetAll', async () => {
      const res = await request(app).get('/voucher/testgetAll').set('Authorization', authHeader).set('id', String(company.id));
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    it('GET /voucher/getVoucherById returns the seeded voucher for a real id', async () => {
      const res = await request(app)
        .get('/voucher/getVoucherById')
        .set('Authorization', authHeader)
        .set('id', String(prereqVoucher.id));
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.result.id).toBe(prereqVoucher.id);
    });

    it('GET /voucher/getVoucherById returns a null result (not an error) for an unknown-but-valid-shaped id', async () => {
      // Vouchers.id is an auto-incrementing INTEGER, not a UUID - a
      // non-existent large integer is the right "doesn't exist" probe here
      // (a UUID string would fail Postgres integer parsing and hit the
      // catch block instead, which is a different thing than "not found").
      const res = await request(app)
        .get('/voucher/getVoucherById')
        .set('Authorization', authHeader)
        .set('id', '999999999');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.result).toBeNull();
    });

    it('GET /voucher/getVouchersByEmployeeId', async () => {
      const res = await request(app)
        .get('/voucher/getVouchersByEmployeeId')
        .set('Authorization', authHeader)
        .set('id', employee.id);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.result)).toBe(true);
    });

    it('GET /voucher/getAllJobPayRecVouchers (paginated)', async () => {
      const res = await request(app)
        .get('/voucher/getAllJobPayRecVouchers')
        .set('Authorization', authHeader)
        .query({ page: 1, limit: 10, companyid: String(company.id) });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.result)).toBe(true);
    });
  });
});
