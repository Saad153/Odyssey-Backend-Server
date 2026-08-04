const request = require('supertest');
const app = require('../../index');
const { loginAs, TEST_PREFIX } = require('../helpers/auth');
const { Vessel, Voyage } = require('../../models');
const { Op } = require('sequelize');

// routes/vessel/index.js has no requireDesignation gate - any authenticated
// user can hit these. Basic CRUD smoke coverage per the task brief.
describe('Vessel/Voyage CRUD - routes/vessel/index.js', () => {
  let authHeader;

  beforeAll(async () => {
    ({ authHeader } = await loginAs('employee'));
  });

  afterAll(async () => {
    // Voyage.VesselId has a real FK to Vessel - delete voyages before vessels.
    const vessels = await Vessel.findAll({ where: { name: { [Op.like]: `${TEST_PREFIX}%` } } });
    const vesselIds = vessels.map((v) => v.id);
    if (vesselIds.length) {
      await Voyage.destroy({ where: { VesselId: { [Op.in]: vesselIds } } });
    }
    await Vessel.destroy({ where: { name: { [Op.like]: `${TEST_PREFIX}%` } } });
  });

  it('rejects requests with no auth token at all (401)', async () => {
    const res = await request(app).get('/vessel/getVessels');
    expect(res.status).toBe(401);
  });

  it('creates a vessel, auto-incrementing "code" from the current max', async () => {
    const res = await request(app)
      .post('/vessel/create')
      .set('Authorization', authHeader)
      .send({ data: { name: `${TEST_PREFIX}Vessel ${Date.now()}`, type: 'Both' } });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.result).toHaveProperty('code');
  });

  it('lists vessels via /vessel/getVessels and /vessel/get', async () => {
    const res1 = await request(app).get('/vessel/getVessels').set('Authorization', authHeader);
    expect(res1.status).toBe(200);
    expect(res1.body.status).toBe('success');
    expect(Array.isArray(res1.body.result)).toBe(true);

    const res2 = await request(app).get('/vessel/get').set('Authorization', authHeader);
    expect(res2.status).toBe(200);
    expect(res2.body.status).toBe('success');
  });

  it('edits a vessel', async () => {
    const created = (
      await request(app).post('/vessel/create').set('Authorization', authHeader).send({ data: { name: `${TEST_PREFIX}ToEdit ${Date.now()}`, type: 'Both' } })
    ).body.result;

    const res = await request(app)
      .post('/vessel/edit')
      .set('Authorization', authHeader)
      .send({ data: { ...created, name: `${TEST_PREFIX}Edited ${Date.now()}` } });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  // BUG (documented, not fixed): the "name already exists" branch of
  // POST /vessel/edit references an undefined variable `result` (only
  // `exists` is in scope there - `result` is declared inside the *other*
  // branch of the if/else). That throws a ReferenceError, which the
  // surrounding try/catch swallows and reports as a generic
  // {status:'error'} instead of the intended {status:'exists', result:exists}.
  // Practical effect: the frontend never gets a chance to show a friendly
  // "a vessel with that name already exists" message - it just sees a
  // generic error.
  // FIXED: this branch used to reference an undefined variable `result`
  // (only `exists` was in scope) inside createHistory(...), throwing a
  // ReferenceError that the outer catch silently swallowed - callers got
  // status:"error" instead of the intended status:"exists".
  it('reports status:"exists" (not "error") when renaming to another vessel\'s existing name', async () => {
    const suffix = Date.now();
    const a = (
      await request(app).post('/vessel/create').set('Authorization', authHeader).send({ data: { name: `${TEST_PREFIX}DupeA ${suffix}`, type: 'Both' } })
    ).body.result;
    const b = (
      await request(app).post('/vessel/create').set('Authorization', authHeader).send({ data: { name: `${TEST_PREFIX}DupeB ${suffix}`, type: 'Both' } })
    ).body.result;

    const res = await request(app)
      .post('/vessel/edit')
      .set('Authorization', authHeader)
      .send({ data: { ...b, name: a.name } }); // rename b to a's existing name
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('exists');
    expect(res.body.result.id).toBe(a.id);
  });

  it('creates and lists a voyage for a vessel', async () => {
    const vessel = (
      await request(app).post('/vessel/create').set('Authorization', authHeader).send({ data: { name: `${TEST_PREFIX}WithVoyage ${Date.now()}`, type: 'Export' } })
    ).body.result;

    const created = await request(app)
      .post('/vessel/createVoyage')
      .set('Authorization', authHeader)
      .send({ voyage: `${TEST_PREFIX}VOY-${Date.now()}`, VesselId: vessel.id, type: 'Export' });
    expect(created.status).toBe(200);
    expect(created.body.status).toBe('success');

    const list = await request(app)
      .post('/vessel/findVoyages')
      .set('Authorization', authHeader)
      .send({ id: vessel.id });
    expect(list.status).toBe(200);
    expect(list.body.status).toBe('success');
    expect(list.body.result.length).toBeGreaterThanOrEqual(1);
  });

  it('edits a voyage', async () => {
    const vessel = (
      await request(app).post('/vessel/create').set('Authorization', authHeader).send({ data: { name: `${TEST_PREFIX}WithVoyageEdit ${Date.now()}`, type: 'Export' } })
    ).body.result;
    const voyage = (
      await request(app)
        .post('/vessel/createVoyage')
        .set('Authorization', authHeader)
        .send({ voyage: `${TEST_PREFIX}VOY-EDIT-${Date.now()}`, VesselId: vessel.id, type: 'Export' })
    ).body.result;

    const res = await request(app)
      .post('/vessel/editVoyage')
      .set('Authorization', authHeader)
      .send({ id: voyage.id, voyage: `${TEST_PREFIX}VOY-RENAMED-${Date.now()}` });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});
