// Single source of truth for token-signing secrets.
//
// There is deliberately NO shared hardcoded fallback for JWT_SECRET. On a
// leased on-prem build every install must supply its own unique JWT_SECRET via
// environment (.env), so a login token minted on one customer's install can
// never validate on another's. Booting without one is a hard failure - the
// sealed build runs with NODE_ENV unset, so requiring the secret in every
// non-test environment is what forces per-install provisioning.
//
// The test environment (NODE_ENV=test) gets a fixed default so the suite needs
// no setup and every module that signs/verifies agrees on the same value.

const isTest = process.env.NODE_ENV === 'test';

// Fixed, obviously-not-secret value used ONLY under NODE_ENV=test.
const TEST_JWT_SECRET = 'odyssey-test-jwt-secret-not-for-production';

function requireSecret(name) {
  const val = process.env[name];
  if (val && val.trim()) return val;
  if (isTest) return TEST_JWT_SECRET;
  throw new Error(
    `[config] ${name} is not set. Every install must define a unique ${name} ` +
    `in its environment (.env). Refusing to start with an insecure shared ` +
    `default - see BUILD-AND-LICENSING.md §7.`
  );
}

const JWT_SECRET = requireSecret('JWT_SECRET');

// Print token: prefer its own secret so a leaked short-lived print token can
// never double as a login token; fall back to JWT_SECRET if unset.
const PRINT_TOKEN_SECRET =
  (process.env.PRINT_TOKEN_SECRET && process.env.PRINT_TOKEN_SECRET.trim()) ||
  JWT_SECRET;

module.exports = { JWT_SECRET, PRINT_TOKEN_SECRET, TEST_JWT_SECRET };
