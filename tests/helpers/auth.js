// Test-only helper for getting an authenticated request identity without
// going through the real /authRoutes/login flow (which enforces a single
// active session per user via sessionManager - annoying across many tests).
// tokenVerification.js accepts a freshly-signed token for a user with no
// recorded session and just adopts it as that user's session on first use,
// so signing directly here is equivalent to a real login as far as every
// downstream route/middleware is concerned.

const jwt = require('jsonwebtoken');
const { Employees } = require('../../models');

// Same secret source the app uses (functions/secrets.js). Under NODE_ENV=test
// that resolves to a fixed test default, so tokens signed here verify in
// tokenVerification.js without any env setup.
const { JWT_SECRET } = require('../../functions/secrets');

const TEST_PREFIX = '__test__';
let seq = 0;

async function createEmployee({ designation = 'employee', name, username, password = 'password123' } = {}) {
  seq += 1;
  const uniq = `${TEST_PREFIX}${Date.now()}_${seq}`;
  return Employees.create({
    name: name || uniq,
    username: username || uniq,
    password,
    designation,
    active: 'true',
  });
}

function signTokenFor(employee) {
  return jwt.sign(
    {
      id: employee.id,
      username: employee.name,
      designation: employee.designation,
      access: '',
      defaultCompanyId: employee.defaultCompanyId || null,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// Convenience: create + sign in one call. Returns { employee, token, authHeader }.
async function loginAs(designation) {
  const employee = await createEmployee({ designation });
  const token = signTokenFor(employee);
  return { employee, token, authHeader: `Bearer ${token}` };
}

module.exports = { TEST_PREFIX, createEmployee, signTokenFor, loginAs };
