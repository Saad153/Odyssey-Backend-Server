// Express enforcement for the licensing kill-switch.
//
// In READONLY mode every state-changing request (POST/PUT/PATCH/DELETE) is
// rejected with 423 Locked, EXCEPT a small allow-list that must keep working
// so users can still log in, log out, read their data and print invoices.
// Reads (GET/HEAD/OPTIONS) are never blocked. WARN mode blocks nothing - it
// only drives the banner via /license/status.

const client = require('./client');
const { MODES } = require('./config');

// Paths that stay writable even in read-only mode. Matched against req.path.
const READONLY_WRITE_ALLOWLIST = [
  '/authRoutes/login',
  '/authRoutes/logout',
];

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function enforceLicense(req, res, next) {
  const { mode } = client.computeState();

  if (mode !== MODES.READONLY) return next();
  if (SAFE_METHODS.has(req.method)) return next();
  if (READONLY_WRITE_ALLOWLIST.includes(req.path)) return next();

  const state = client.getState();
  return res.status(423).json({
    error: 'read_only',
    readOnly: true,
    message:
      state.message ||
      'The system is currently read-only. Changes cannot be saved. Please contact your provider.',
  });
}

module.exports = { enforceLicense };
