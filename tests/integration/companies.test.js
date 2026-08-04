const request = require('supertest');
const app = require('../../index');
const { loginAs } = require('../helpers/auth');

// routes/companies/index.js only has one route, and '/companies/getAllCompanies'
// is explicitly listed in index.js's PUBLIC_PATHS - it's meant to be reachable
// with no login session at all (the frontend needs the company list before a
// user has logged in, e.g. on the login screen itself).
describe('Companies - routes/companies/index.js', () => {
  it('is reachable with NO auth token at all (public path)', async () => {
    const res = await request(app).get('/companies/getAllCompanies');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.result)).toBe(true);
  });

  it('is also reachable with a valid token (public paths do not reject authenticated callers)', async () => {
    const { authHeader } = await loginAs('employee');
    const res = await request(app).get('/companies/getAllCompanies').set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});
