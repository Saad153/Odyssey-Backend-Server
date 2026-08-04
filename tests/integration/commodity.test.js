const request = require('supertest');
const app = require('../../index');
const { loginAs, TEST_PREFIX } = require('../helpers/auth');
const { Commodity } = require('../../models');
const { Op } = require('sequelize');

// routes/commodity/index.js has no requireDesignation gate - any
// authenticated user can hit these. This file covers basic CRUD smoke
// coverage per the task brief.
describe('Commodity CRUD - routes/commodity/index.js', () => {
  let authHeader;

  beforeAll(async () => {
    ({ authHeader } = await loginAs('employee'));
  });

  afterAll(async () => {
    await Commodity.destroy({ where: { name: { [Op.like]: `${TEST_PREFIX}%` } } });
  });

  it('rejects requests with no auth token at all (401)', async () => {
    const res = await request(app).get('/commodity/get');
    expect(res.status).toBe(401);
  });

  it('creates a commodity, coercing isHazmat (array-like) to 1/0', async () => {
    const res = await request(app)
      .post('/commodity/create')
      .set('Authorization', authHeader)
      .send({
        data: {
          name: `${TEST_PREFIX}Commodity ${Date.now()}`,
          hs: '1234.56',
          cargoType: 'GL',
          commodityGroup: 'General',
          isHazmat: ['yes'], // route does `.length > 0 ? 1 : 0`
          packageGroup: '',
          hazmatCode: '',
          hazmatClass: '',
          chemicalName: '',
          unoCode: '',
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    // isHazmat is a STRING column on the model, so the coerced 1/0 comes
    // back as "1"/"0", not a number.
    expect(res.body.result.isHazmat).toBe('1');
  });

  it('creates a non-hazmat commodity when isHazmat is an empty array', async () => {
    const res = await request(app)
      .post('/commodity/create')
      .set('Authorization', authHeader)
      .send({ data: { name: `${TEST_PREFIX}NonHazmat ${Date.now()}`, isHazmat: [] } });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.result.isHazmat).toBe('0');
  });

  // FIXED: `req.body.data.isHazmat.length` used to be read before the
  // try/catch block in both /create and /edit - a missing/non-array
  // isHazmat threw synchronously outside the catch, which Express 4 doesn't
  // catch for an async handler, so the request hung with no response at
  // all. It's now read inside the try block with an Array.isArray guard,
  // so this returns a clean error response instead.
  it('responds with a clean error (not a hang) when isHazmat is missing entirely', async () => {
    const res = await request(app)
      .post('/commodity/create')
      .set('Authorization', authHeader)
      .send({ data: { name: `${TEST_PREFIX}NoHazmatField ${Date.now()}` } }); // isHazmat omitted
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.result.isHazmat).toBe('0');
  });

  it('responds with a clean error (not a hang) when isHazmat is not array-like', async () => {
    const res = await request(app)
      .post('/commodity/create')
      .set('Authorization', authHeader)
      .send({ data: { name: `${TEST_PREFIX}BadHazmat ${Date.now()}`, isHazmat: 'not-an-array' } });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.result.isHazmat).toBe('0');
  });

  it('lists commodities with pagination metadata via /commodity/get', async () => {
    const res = await request(app)
      .get('/commodity/get')
      .set('Authorization', authHeader)
      .query({ page: 1, limit: 5 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.result)).toBe(true);
    expect(res.body.pagination).toMatchObject({ currentPage: 1, pageSize: 5 });
  });

  it('filters via the search query param (matches our seeded name)', async () => {
    const uniqueName = `${TEST_PREFIX}Searchable ${Date.now()}`;
    await request(app).post('/commodity/create').set('Authorization', authHeader).send({ data: { name: uniqueName, isHazmat: [] } });

    const res = await request(app)
      .get('/commodity/get')
      .set('Authorization', authHeader)
      .query({ search: uniqueName });
    expect(res.status).toBe(200);
    expect(res.body.result.some((c) => c.name === uniqueName)).toBe(true);
  });

  it('edits a commodity', async () => {
    const created = (
      await request(app).post('/commodity/create').set('Authorization', authHeader).send({ data: { name: `${TEST_PREFIX}ToEdit ${Date.now()}`, isHazmat: [] } })
    ).body.result;

    const res = await request(app)
      .post('/commodity/edit')
      .set('Authorization', authHeader)
      .send({ data: { ...created, name: `${TEST_PREFIX}Edited`, isHazmat: ['x'] } });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.result.name).toBe(`${TEST_PREFIX}Edited`);
    // isHazmat is a STRING column on the model, so the coerced 1/0 comes
    // back as "1"/"0", not a number.
    expect(res.body.result.isHazmat).toBe('1');
  });

  it('/edit responds with a clean error (not a hang) when isHazmat is missing entirely', async () => {
    const created = (
      await request(app).post('/commodity/create').set('Authorization', authHeader).send({ data: { name: `${TEST_PREFIX}EditNoHazmat ${Date.now()}`, isHazmat: [] } })
    ).body.result;

    const { isHazmat, ...withoutHazmat } = created;
    const res = await request(app)
      .post('/commodity/edit')
      .set('Authorization', authHeader)
      .send({ data: withoutHazmat }); // isHazmat omitted entirely
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.result.isHazmat).toBe('0');
  });

  it('bulk-imports commodities via /commodity/uploadCommodities (legacy Climax import shape)', async () => {
    const res = await request(app)
      .post('/commodity/uploadCommodities')
      .set('Authorization', authHeader)
      .send({
        Commodities: [
          {
            CommodityName: `${TEST_PREFIX}Imported ${Date.now()}`,
            HSCode: '0000.00',
            IsHazmatProduct: '',
            HazmatCode: '',
            CommonChemicalName: '',
            UNOCode: '',
            Id: 999001,
          },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  it('updates climaxId by commodity name via /commodity/updateCommodity', async () => {
    const name = `${TEST_PREFIX}ForClimaxLink ${Date.now()}`;
    await request(app).post('/commodity/create').set('Authorization', authHeader).send({ data: { name, isHazmat: [] } });

    const res = await request(app)
      .post('/commodity/updateCommodity')
      .set('Authorization', authHeader)
      .send({ Id: 424242, CommodityName: name });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.result).toBe(1); // number of rows affected

    const updated = await Commodity.findOne({ where: { name } });
    expect(updated.climaxId).toBe(424242);
  });
});
