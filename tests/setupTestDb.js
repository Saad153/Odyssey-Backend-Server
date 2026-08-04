// Shared per-test-file setup: verifies we're pointed at the isolated test
// database (never the real dev/prod one), waits for the schema sync that
// happens as a side effect of requiring ../models, and wipes any rows this
// test file seeded (marked with TEST_PREFIX) when it's done.
//
// Runs once per test file (Jest gives each test file its own module
// registry), which is why jest.config.js pins maxWorkers to 1 - all test
// files share the same odyssey-test database, so they must run sequentially
// to avoid racing each other's setup/teardown against shared tables.

if (process.env.NODE_ENV !== 'test') {
  throw new Error(
    'Refusing to run: NODE_ENV must be "test". Run tests via `npm test`, which sets this for you.'
  );
}

const config = require('../config/config.json').test;
if (!/test/i.test(config.database)) {
  throw new Error(
    `Refusing to run against database "${config.database}" - it doesn't look like a test database. ` +
    'Check config/config.json\'s "test" block before running tests.'
  );
}

const db = require('../models');
const { Op } = require('sequelize');

const TEST_PREFIX = '__test__';

beforeAll(async () => {
  await db.syncPromise;
});

afterAll(async () => {
  const like = { [Op.like]: `${TEST_PREFIX}%` };
  await db.Clients.destroy({ where: { name: like } });
  await db.Employees.destroy({ where: { username: like } });
  await db.sequelize.close();
});

module.exports = { db, TEST_PREFIX };
