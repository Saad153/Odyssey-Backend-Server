const request = require('supertest');
const app = require('../../index');
const { loginAs, TEST_PREFIX } = require('../helpers/auth');

// Mirrors tests/integration/partyAccessControl.test.js's pattern for
// routes/employees/index.js: createEmployee/editEmployee/getEmployees are
// gated to CEO/CFO/admin via requireDesignation; getEmployeesIdAndName,
// getRepresentativeEmployees and getManagers are intentionally left ungated
// (they're used to populate dropdowns elsewhere in the app for any logged-in
// user). Verified directly against routes/employees/index.js.
describe('Employees access control - CEO/CFO/admin only for create/edit/list', () => {
  const restrictedDesignations = ['employee', 'manager', 'accountant'];
  const allowedDesignations = ['CEO', 'CFO', 'admin'];

  const makeEmployeePayload = (suffix) => ({
    values: {
      code: `${TEST_PREFIX}code_${suffix}`,
      userName: `${TEST_PREFIX}user_${suffix}`,
      empName: `${TEST_PREFIX}Employee ${suffix}`,
      fatherName: 'Father Name',
      email: `${TEST_PREFIX}${suffix}@example.com`,
      pass: 'irrelevant-plaintext-pass',
      phone: '0300-0000000',
      address: 'Test Address',
      cnic: '00000-0000000-0',
      selectDesignation: 'employee',
      selectDepart: 'Operations',
      selectManager: '',
      date: '2024-01-01',
      bank: '',
      accountNo: '',
      represent: '',
      defaultCompanyId: null,
      accessLevels: [],
    },
    // employeeId / createdBy intentionally omitted - createHistory() then
    // fails its own not-null validation internally and silently no-ops
    // (same pattern already relied on by partyAccessControl.test.js), so
    // this doesn't leave a History row behind that we'd need to clean up.
  });

  describe.each(restrictedDesignations)('as a non-privileged "%s"', (designation) => {
    let authHeader;

    beforeAll(async () => {
      ({ authHeader } = await loginAs(designation));
    });

    it('is blocked (403) from listing employees via /employeeRoutes/getEmployees', async () => {
      const res = await request(app)
        .get('/employeeRoutes/getEmployees')
        .set('Authorization', authHeader);
      expect(res.status).toBe(403);
    });

    it('is blocked (403) from creating an employee via /employeeRoutes/createEmployee', async () => {
      const res = await request(app)
        .post('/employeeRoutes/createEmployee')
        .set('Authorization', authHeader)
        .send(makeEmployeePayload(`${Date.now()}_blocked`));
      expect(res.status).toBe(403);
    });

    it('is blocked (403) from editing an employee via /employeeRoutes/editEmployee', async () => {
      const res = await request(app)
        .post('/employeeRoutes/editEmployee')
        .set('Authorization', authHeader)
        .send({ values: { id: '00000000-0000-0000-0000-000000000000', accessLevels: [] } });
      expect(res.status).toBe(403);
    });

    it('can still hit /employeeRoutes/getEmployeesIdAndName (ungated on purpose)', async () => {
      const res = await request(app)
        .get('/employeeRoutes/getEmployeesIdAndName')
        .set('Authorization', authHeader);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.result)).toBe(true);
    });

    it('can still hit /employeeRoutes/getRepresentativeEmployees (ungated on purpose)', async () => {
      const res = await request(app)
        .get('/employeeRoutes/getRepresentativeEmployees')
        .set('Authorization', authHeader);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.result).toHaveProperty('Sr');
      expect(res.body.result).toHaveProperty('Dr');
      expect(res.body.result).toHaveProperty('Ar');
    });

    it('can still hit /employeeRoutes/getManagers (ungated on purpose)', async () => {
      const res = await request(app)
        .get('/employeeRoutes/getManagers')
        .set('Authorization', authHeader);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.result)).toBe(true);
    });
  });

  describe.each(allowedDesignations)('as a privileged "%s"', (designation) => {
    let authHeader;

    beforeAll(async () => {
      ({ authHeader } = await loginAs(designation));
    });

    it('can list employees via /employeeRoutes/getEmployees', async () => {
      const res = await request(app)
        .get('/employeeRoutes/getEmployees')
        .set('Authorization', authHeader);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.result)).toBe(true);
    });

    it('can create an employee via /employeeRoutes/createEmployee', async () => {
      const suffix = `${Date.now()}_${designation}`;
      const res = await request(app)
        .post('/employeeRoutes/createEmployee')
        .set('Authorization', authHeader)
        .send(makeEmployeePayload(suffix));
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.result).toHaveProperty('id');
      expect(res.body.result.username).toBe(`${TEST_PREFIX}user_${suffix}`);
    });

    it('reports status "exists" (still HTTP 200) when code or username is already taken', async () => {
      const suffix = `${Date.now()}_${designation}_dupe`;
      const payload = makeEmployeePayload(suffix);
      const first = await request(app)
        .post('/employeeRoutes/createEmployee')
        .set('Authorization', authHeader)
        .send(payload);
      expect(first.status).toBe(200);
      expect(first.body.status).toBe('success');

      const second = await request(app)
        .post('/employeeRoutes/createEmployee')
        .set('Authorization', authHeader)
        .send(payload);
      expect(second.status).toBe(200);
      expect(second.body.status).toBe('exists');
    });

    it('can edit an employee via /employeeRoutes/editEmployee', async () => {
      const suffix = `${Date.now()}_${designation}_edit`;
      const created = await request(app)
        .post('/employeeRoutes/createEmployee')
        .set('Authorization', authHeader)
        .send(makeEmployeePayload(suffix));
      expect(created.body.status).toBe('success');
      const id = created.body.result.id;

      const payload = makeEmployeePayload(suffix);
      payload.values.id = id;
      payload.values.empName = `${TEST_PREFIX}Renamed ${suffix}`;

      const res = await request(app)
        .post('/employeeRoutes/editEmployee')
        .set('Authorization', authHeader)
        .send(payload);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });

  it('rejects requests with no auth token at all (401, before the designation check ever runs)', async () => {
    const res = await request(app).get('/employeeRoutes/getEmployees');
    expect(res.status).toBe(401);
  });
});
