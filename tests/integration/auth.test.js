const request = require('supertest');
const app = require('../../index');
const { createEmployee, TEST_PREFIX } = require('../helpers/auth');
const { History } = require('../../models');
const sessionManager = require('../../functions/sessionManager');

// Exercises the REAL /authRoutes/login flow (not the tests/helpers/auth.js
// bypass used everywhere else in this suite), since that's the only place
// the actual password check / single-session enforcement / history logging
// in routes/auth/index.js gets covered.
describe('Real auth flow - routes/auth/index.js', () => {
  const createdEmployeeIds = [];

  afterEach(async () => {
    // login/logout call createHistory(user.id, ...) with a real employee id
    // (unlike most other routes, this isn't something we control via the
    // request body), so every successful login/logout here leaves a History
    // row behind. Clean those up right after each test rather than relying
    // on afterAll ordering between this file and the shared
    // tests/setupTestDb.js afterAll (which deletes these same Employees rows
    // and would hit a FK violation if History rows still referenced them).
    if (createdEmployeeIds.length) {
      await History.destroy({ where: { EmployeeId: createdEmployeeIds } });
    }
    // Belt-and-braces: never leave a session dangling between tests.
    createdEmployeeIds.forEach((id) => sessionManager.clearSession(id));
  });

  describe('POST /authRoutes/login - validation', () => {
    it('rejects with 400 when username is missing', async () => {
      const res = await request(app).post('/authRoutes/login').send({ password: 'x' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/username and password required/i);
    });

    it('rejects with 400 when password is missing', async () => {
      const res = await request(app).post('/authRoutes/login').send({ username: 'x' });
      expect(res.status).toBe(400);
    });

    it('rejects with 400 when both are missing', async () => {
      const res = await request(app).post('/authRoutes/login').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /authRoutes/login - credentials', () => {
    it('rejects with 401 for a username that does not exist', async () => {
      const res = await request(app)
        .post('/authRoutes/login')
        .send({ username: `${TEST_PREFIX}nonexistent_${Date.now()}`, password: 'whatever' });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid credentials');
    });

    it('rejects with 401 for an incorrect password', async () => {
      const employee = await createEmployee({ password: `${TEST_PREFIX}RealPass123` });
      createdEmployeeIds.push(employee.id);
      const res = await request(app)
        .post('/authRoutes/login')
        .send({ username: employee.username, password: 'totally-wrong' });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid credentials');
    });

    it('logs in successfully with the correct password', async () => {
      const employee = await createEmployee({ password: `${TEST_PREFIX}RealPass123` });
      createdEmployeeIds.push(employee.id);
      const res = await request(app)
        .post('/authRoutes/login')
        .send({ username: employee.username, password: `${TEST_PREFIX}RealPass123` });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Success');
      expect(res.body.token).toMatch(/^BearerSplit/);
      expect(res.body.forceLogin).toBe(false);

      sessionManager.clearSession(employee.id);
    });
  });

  describe('password storage - legacy plaintext compatibility + bcrypt migration', () => {
    // FIXED: routes/auth/index.js used to do `if (password !== user.password)`,
    // a plaintext comparison, with bcrypt.compare() commented out - employee
    // passwords were stored AND checked in cleartext. functions/password.js
    // now verifies either a bcrypt hash or (for rows created before this
    // fix) legacy plaintext, and opportunistically re-hashes a legacy
    // password to bcrypt the first time it's used successfully - no bulk
    // migration needed. tests/helpers/auth.js's createEmployee still writes
    // a raw plaintext value directly (bypassing the route entirely, the way
    // a pre-fix database row would look), which is exactly what lets this
    // test exercise the legacy fallback + auto-upgrade path.
    it('accepts a legacy plaintext-stored password and upgrades it to a bcrypt hash on successful login', async () => {
      const employee = await createEmployee({ password: `${TEST_PREFIX}LegacyPass1` });
      createdEmployeeIds.push(employee.id);

      const res = await request(app)
        .post('/authRoutes/login')
        .send({ username: employee.username, password: `${TEST_PREFIX}LegacyPass1` });
      expect(res.status).toBe(200);
      sessionManager.clearSession(employee.id);

      await employee.reload();
      expect(employee.password).not.toBe(`${TEST_PREFIX}LegacyPass1`);
      expect(employee.password).toMatch(/^\$2[aby]\$/);

      // The now-hashed password must still work exactly the same on a second login.
      const second = await request(app)
        .post('/authRoutes/login')
        .send({ username: employee.username, password: `${TEST_PREFIX}LegacyPass1` });
      expect(second.status).toBe(200);
      sessionManager.clearSession(employee.id);
    });

    it('rejects the old plaintext value once a password has already been hashed', async () => {
      const employee = await createEmployee({ password: `${TEST_PREFIX}LegacyPass2` });
      createdEmployeeIds.push(employee.id);

      await request(app)
        .post('/authRoutes/login')
        .send({ username: employee.username, password: `${TEST_PREFIX}LegacyPass2` });
      sessionManager.clearSession(employee.id);
      await employee.reload();
      expect(employee.password).toMatch(/^\$2[aby]\$/);

      // Sanity: a wrong password against an already-hashed value still fails cleanly.
      const res = await request(app)
        .post('/authRoutes/login')
        .send({ username: employee.username, password: 'not-the-password' });
      expect(res.status).toBe(401);
    });
  });

  describe('single active session enforcement', () => {
    it('blocks a second login with 409 unless force is set, and force clears the previous session', async () => {
      const employee = await createEmployee({ password: `${TEST_PREFIX}Pass1` });
      createdEmployeeIds.push(employee.id);
      const creds = { username: employee.username, password: `${TEST_PREFIX}Pass1` };

      const first = await request(app).post('/authRoutes/login').send(creds);
      expect(first.status).toBe(200);
      const firstToken = first.body.token.replace('BearerSplit', '');
      expect(sessionManager.isTokenValid(employee.id, firstToken)).toBe(true);

      const second = await request(app).post('/authRoutes/login').send(creds);
      expect(second.status).toBe(409);
      expect(second.body.message).toBe('User already logged in');
      // The original session must still be the active one after a blocked attempt.
      expect(sessionManager.isTokenValid(employee.id, firstToken)).toBe(true);

      // jwt.sign's `iat` has 1-second granularity, and the JWT payload is
      // otherwise identical between these two logins - without crossing a
      // second boundary, the forced login would produce a byte-for-byte
      // identical (and thus indistinguishable) token to the first one,
      // which would make this test flaky rather than actually verifying
      // "the old session was replaced".
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const forced = await request(app)
        .post('/authRoutes/login')
        .send({ ...creds, force: true });
      expect(forced.status).toBe(200);
      expect(forced.body.forceLogin).toBe(true);
      const forcedToken = forced.body.token.replace('BearerSplit', '');
      expect(forcedToken).not.toBe(firstToken);

      expect(sessionManager.isTokenValid(employee.id, firstToken)).toBe(false);
      expect(sessionManager.isTokenValid(employee.id, forcedToken)).toBe(true);

      sessionManager.clearSession(employee.id);
    });
  });

  describe('GET /authRoutes/verifyLogin', () => {
    // FIXED: '/authRoutes/verifyLogin' used to be listed in index.js's
    // PUBLIC_PATHS, so the global auth middleware never ran for it and
    // req.user was never populated - it unconditionally reported
    // isLoggedIn:true even with no token at all. It's no longer public, so
    // the global `verify` middleware now gates it like every other route.
    it('rejects with 401 when no Authorization header is sent', async () => {
      const res = await request(app).get('/authRoutes/verifyLogin');
      expect(res.status).toBe(401);
    });

    it('reports isLoggedIn:true and the real username with a valid token', async () => {
      const employee = await createEmployee({ password: `${TEST_PREFIX}Pass2` });
      createdEmployeeIds.push(employee.id);
      const login = await request(app)
        .post('/authRoutes/login')
        .send({ username: employee.username, password: `${TEST_PREFIX}Pass2` });
      const token = login.body.token.replace('BearerSplit', '');

      const res = await request(app).get('/authRoutes/verifyLogin').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ isLoggedIn: true, username: employee.name });

      sessionManager.clearSession(employee.id);
    });
  });

  describe('POST /authRoutes/logout', () => {
    it('rejects with 401 when not authenticated', async () => {
      const res = await request(app).post('/authRoutes/logout');
      expect(res.status).toBe(401);
    });

    it('clears the session and returns a confirmation message when authenticated', async () => {
      const employee = await createEmployee({ password: `${TEST_PREFIX}Pass3` });
      createdEmployeeIds.push(employee.id);
      const login = await request(app)
        .post('/authRoutes/login')
        .send({ username: employee.username, password: `${TEST_PREFIX}Pass3` });
      const token = login.body.token.replace('BearerSplit', '');

      const res = await request(app).post('/authRoutes/logout').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out');
      expect(sessionManager.isActive(employee.id)).toBe(false);
    });

    // FIXED: logging out used to not actually invalidate the JWT for
    // requests served from the 1-minute tokenCache fast path in
    // functions/tokenVerification.js - that fast path only rejected a
    // cached token when the stored session token *differed* from the one
    // presented, so a simply-absent session (right after logout) fell
    // through and was granted access anyway. The fast path now rejects
    // whenever the session token doesn't exactly match, including "no
    // session at all". Demonstrated below: reusing the token immediately
    // after logout is now correctly rejected.
    it('invalidates the token - reusing it right after logout is rejected with 401', async () => {
      const employee = await createEmployee({ password: `${TEST_PREFIX}Pass4` });
      createdEmployeeIds.push(employee.id);
      const login = await request(app)
        .post('/authRoutes/login')
        .send({ username: employee.username, password: `${TEST_PREFIX}Pass4` });
      const token = login.body.token.replace('BearerSplit', '');

      const logout = await request(app).post('/authRoutes/logout').set('Authorization', `Bearer ${token}`);
      expect(logout.status).toBe(200);
      expect(sessionManager.isActive(employee.id)).toBe(false);

      // getManagers is authenticated but not designation-gated - a clean probe.
      const res = await request(app)
        .get('/employeeRoutes/getManagers')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(sessionManager.isActive(employee.id)).toBe(false);
    });
  });
});
