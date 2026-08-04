const request = require('supertest');
const app = require('../../index');
const { loginAs, TEST_PREFIX } = require('../helpers/auth');

describe('Party (Clients) access control - CEO/CFO/admin only', () => {
  const restrictedDesignations = ['employee', 'manager', 'accountant'];
  const allowedDesignations = ['CEO', 'CFO', 'admin'];

  describe.each(restrictedDesignations)('as a non-privileged "%s"', (designation) => {
    let authHeader;

    beforeAll(async () => {
      ({ authHeader } = await loginAs(designation));
    });

    it('is blocked (403) from listing clients via /clientRoutes/getClients', async () => {
      const res = await request(app)
        .get('/clientRoutes/getClients')
        .set('Authorization', authHeader);
      expect(res.status).toBe(403);
    });

    it('is blocked (403) from creating a client via /clientRoutes/addClient', async () => {
      const res = await request(app)
        .post('/clientRoutes/addClient')
        .set('Authorization', authHeader)
        .send({ name: `${TEST_PREFIX}blocked_client` });
      expect(res.status).toBe(403);
    });

    it('is blocked (403) from reading a single client via /clientRoutes/getClientById', async () => {
      const res = await request(app)
        .get('/clientRoutes/getClientById')
        .set('Authorization', authHeader)
        .set('id', '00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(403);
    });

    it('is blocked (403) from deleting a client via /clientRoutes/deleteClient', async () => {
      const res = await request(app)
        .post('/clientRoutes/deleteClient')
        .set('Authorization', authHeader)
        .send({ id: '00000000-0000-0000-0000-000000000000' });
      expect(res.status).toBe(403);
    });

    it('can still list parties for the charges picker via /clientRoutes/getClientsForSelect (ungated on purpose)', async () => {
      const res = await request(app)
        .get('/clientRoutes/getClientsForSelect')
        .set('Authorization', authHeader);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.result)).toBe(true);
    });

    it('is blocked (403) from the Non-GL parties list via /nonGlParties/getParties', async () => {
      const res = await request(app)
        .get('/nonGlParties/getParties')
        .set('Authorization', authHeader);
      expect(res.status).toBe(403);
    });

    it('is blocked (403) from creating a Non-GL party via /nonGlParties/createNonGlParty', async () => {
      const res = await request(app)
        .post('/nonGlParties/createNonGlParty')
        .set('Authorization', authHeader)
        .send({ name: `${TEST_PREFIX}blocked_nongl`, operations: [], types: [] });
      expect(res.status).toBe(403);
    });
  });

  describe.each(allowedDesignations)('as a privileged "%s"', (designation) => {
    let authHeader;

    beforeAll(async () => {
      ({ authHeader } = await loginAs(designation));
    });

    it('can list clients via /clientRoutes/getClients', async () => {
      const res = await request(app)
        .get('/clientRoutes/getClients')
        .set('Authorization', authHeader);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    it('can create a client via /clientRoutes/addClient', async () => {
      const res = await request(app)
        .post('/clientRoutes/addClient')
        .set('Authorization', authHeader)
        .send({ name: `${TEST_PREFIX}${designation}_client_${Date.now()}` });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.result).toHaveProperty('id');
    });

    it('can list Non-GL parties via /nonGlParties/getParties', async () => {
      const res = await request(app)
        .get('/nonGlParties/getParties')
        .set('Authorization', authHeader);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });

  it('rejects requests with no auth token at all (401, before the designation check ever runs)', async () => {
    const res = await request(app).get('/clientRoutes/getClients');
    expect(res.status).toBe(401);
  });
});
