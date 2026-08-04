// First-load seeding: make a brand-new install immediately usable by creating
// a default admin account, but ONLY when there are no employees at all yet.
//
// Gating on an empty table (rather than "is there a user called admin?") means:
//   - a fresh DB gets a ready-to-use admin, and
//   - an install that already has users is never touched, and
//   - deleting the default admin later does NOT resurrect it with a known
//     password on the next boot.
//
// Username/password default to admin / abc.123 (as requested) but can be set
// per-install via ADMIN_SEED_USERNAME / ADMIN_SEED_PASSWORD. The password is
// stored as a bcrypt hash. Change it after first login.

const db = require('../models');
const { hashPassword } = require('./password');

const SEED_USERNAME = process.env.ADMIN_SEED_USERNAME || 'admin';
const SEED_PASSWORD = process.env.ADMIN_SEED_PASSWORD || 'abc.123';

async function seedAdminUser() {
  // Ensure the schema exists before we query/insert (models/index.js runs
  // sequelize.sync and exposes the promise so we don't race it).
  await db.syncPromise;
  const { Employees } = db;

  const existingCount = await Employees.count();
  if (existingCount > 0) {
    return { created: false, reason: 'users-exist' };
  }

  await Employees.create({
    name: 'Administrator',
    username: SEED_USERNAME,
    password: await hashPassword(SEED_PASSWORD),
    designation: 'admin', // lowercase - unlocks the Config tab + admin routes
    active: 'true',
  });

  return { created: true, username: SEED_USERNAME };
}

module.exports = { seedAdminUser };
