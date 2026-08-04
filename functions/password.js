const bcrypt = require('bcryptjs');

// Historically Employees.password was stored and compared in plaintext
// (see routes/auth/index.js's git history). Existing rows in the real
// database still hold plaintext values, so a hard cutover to bcrypt-only
// would lock every current user out. These helpers instead support both
// formats side by side: bcrypt hashes are recognized by their standard
// `$2a$`/`$2b$`/`$2y$` prefix, anything else is treated as legacy plaintext.
// Callers (routes/auth/index.js's /login) are expected to opportunistically
// re-hash and persist a legacy password the first time it's verified
// successfully, so accounts migrate to bcrypt automatically over time
// without any bulk migration step.
const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$/;

function isBcryptHash(value) {
  return typeof value === 'string' && BCRYPT_HASH_RE.test(value);
}

async function hashPassword(plain) {
  return bcrypt.hash(String(plain ?? ''), 10);
}

// Returns true if `plain` matches `stored`, whether `stored` is a bcrypt
// hash or a legacy plaintext value.
async function verifyPassword(plain, stored) {
  if (typeof stored !== 'string' || !stored) return false;
  if (isBcryptHash(stored)) {
    return bcrypt.compare(String(plain ?? ''), stored);
  }
  return plain === stored;
}

module.exports = { isBcryptHash, hashPassword, verifyPassword };
