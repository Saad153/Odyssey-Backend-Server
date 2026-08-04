const request = require('supertest');
const app = require('../../index');
const { loginAs, TEST_PREFIX } = require('../helpers/auth');
const { Charges } = require('../../models');
const { Op } = require('sequelize');

// routes/charges/index.js has no requireDesignation gate on any of its
// routes - any authenticated user (any designation) can hit them. Verified
// directly against the route file. This file therefore only checks "some
// valid session" (via loginAs), plus full CRUD happy/error paths.
describe('Charges CRUD - routes/charges/index.js', () => {
  let authHeader;

  beforeAll(async () => {
    ({ authHeader } = await loginAs('employee'));
  });

  afterAll(async () => {
    await Charges.destroy({ where: { name: { [Op.like]: `${TEST_PREFIX}%` } } });
  });

  const makeCharge = (suffix) => ({
    currency: 'PKR',
    name: `${TEST_PREFIX}Charge ${suffix}`,
    short: `T${suffix}`.slice(0, 10),
    calculationType: 'Fixed',
    defaultPaybleParty: 'client',
    defaultRecivableParty: 'client',
    taxApply: 'false',
    taxPerc: '0',
  });

  it('rejects requests with no auth token at all (401)', async () => {
    const res = await request(app).get('/charges/get');
    expect(res.status).toBe(401);
  });

  it('creates a charge, auto-incrementing "code" from the current max', async () => {
    const before = await request(app).post('/charges/create').set('Authorization', authHeader).send({ data: makeCharge(`create_${Date.now()}`) });
    expect(before.status).toBe(200);
    expect(before.body.status).toBe('success');
    expect(before.body.result).toHaveProperty('code');
    expect(before.body.result.code).toBeGreaterThanOrEqual(1);
  });

  it('lists charges via /charges/get', async () => {
    const res = await request(app).get('/charges/get').set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.result)).toBe(true);
  });

  it('edits a charge', async () => {
    const created = await request(app).post('/charges/create').set('Authorization', authHeader).send({ data: makeCharge(`edit_${Date.now()}`) });
    const charge = created.body.result;

    const res = await request(app)
      .post('/charges/edit')
      .set('Authorization', authHeader)
      .send({ data: { ...charge, name: `${TEST_PREFIX}Renamed Charge` } });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.result.name).toBe(`${TEST_PREFIX}Renamed Charge`);
  });

  it('reports status "exists" (still HTTP 200) when editing to a code already used by another charge', async () => {
    const a = (await request(app).post('/charges/create').set('Authorization', authHeader).send({ data: makeCharge(`dupe_a_${Date.now()}`) })).body.result;
    const b = (await request(app).post('/charges/create').set('Authorization', authHeader).send({ data: makeCharge(`dupe_b_${Date.now()}`) })).body.result;

    const res = await request(app)
      .post('/charges/edit')
      .set('Authorization', authHeader)
      .send({ data: { ...b, code: a.code } });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('exists');
  });

  it('toggles status via /charges/status', async () => {
    const created = (await request(app).post('/charges/create').set('Authorization', authHeader).send({ data: makeCharge(`status_${Date.now()}`) })).body.result;
    expect(created.status).toBe(true);

    const res = await request(app).post('/charges/status').set('Authorization', authHeader).send({ id: created.id });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    const list = await request(app).get('/charges/get').set('Authorization', authHeader);
    const updated = list.body.result.find((c) => c.id === created.id);
    expect(updated.status).toBe(false);
  });

  it('deletes a charge that is not referenced by any Charge_Head', async () => {
    const created = (await request(app).post('/charges/create').set('Authorization', authHeader).send({ data: makeCharge(`delete_${Date.now()}`) })).body.result;

    const res = await request(app).post('/charges/delete').set('Authorization', authHeader).send({ id: created.id });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    const stillThere = await Charges.findByPk(created.id);
    expect(stillThere).toBeNull();
  });

  it('rejects creating a charge missing required fields (DB validation error, still HTTP 200 with status:error)', async () => {
    const res = await request(app)
      .post('/charges/create')
      .set('Authorization', authHeader)
      .send({ data: { name: `${TEST_PREFIX}incomplete` } }); // missing currency/short/calculationType/etc.
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('error');
  });

  it('bulkCreate validates each row the same way (status:error on invalid rows)', async () => {
    const res = await request(app)
      .post('/charges/bulkCreate')
      .set('Authorization', authHeader)
      .send([{ name: `${TEST_PREFIX}bulk_incomplete` }]);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('error');
  });

  it('bulkCreate succeeds with fully valid rows', async () => {
    // Unlike /charges/create, /charges/bulkCreate does NOT auto-assign
    // "code" (it just calls Charges.bulkCreate(req.body) directly) - code is
    // allowNull:false on the model, so callers must supply it themselves.
    const suffix = Date.now();
    const maxCode = (await Charges.max('code')) || 0;
    const res = await request(app)
      .post('/charges/bulkCreate')
      .set('Authorization', authHeader)
      .send([
        { ...makeCharge(`bulk1_${suffix}`), code: maxCode + 1 },
        { ...makeCharge(`bulk2_${suffix}`), code: maxCode + 2 },
      ]);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});
