// Read-only status endpoint the frontend polls to drive the licence banner.
// Behind the global auth gate (only logged-in users see it), and it's a GET so
// it stays reachable even in read-only mode.

const routes = require('express').Router();
const client = require('../functions/license/client');
const requireDesignation = require('../functions/requireDesignation');
const { INSTALL_ID, LICENSE_SERVER_URL } = require('../functions/license/config');

let appVersion = 'unknown';
try {
  appVersion = require('../package.json').version;
} catch (_) {
  /* ignore */
}

routes.get('/status', (req, res) => {
  const s = client.computeState();
  const now = Date.now();
  const daysRemaining =
    s.graceEndsAt && s.graceEndsAt > now
      ? Math.ceil((s.graceEndsAt - now) / 86400000)
      : null;

  res.json({
    mode: s.mode, // 'active' | 'warn' | 'readonly'
    readOnly: s.mode === 'readonly',
    warn: s.mode === 'warn',
    message: s.message,
    graceEndsAt: s.graceEndsAt,
    daysRemaining,
  });
});

// Admin-only install/licence detail for the Config page. Enforced server-side
// (requireDesignation) so hiding the sidebar tab is not the only gate - a
// non-admin hitting this route directly still gets 403.
routes.get('/info', requireDesignation(['admin']), (req, res) => {
  const s = client.computeState();
  const now = Date.now();
  const paidThrough = s.paidThrough || null;
  res.json({
    installId: INSTALL_ID,
    licenseServerUrl: LICENSE_SERVER_URL,
    appVersion,
    mode: s.mode,
    message: s.message,
    source: s.source,
    graceEndsAt: s.graceEndsAt,
    daysRemaining: // days until read-only (warn window)
      s.graceEndsAt && s.graceEndsAt > now
        ? Math.ceil((s.graceEndsAt - now) / 86400000)
        : null,
    paidThrough, // epoch ms the subscription is paid up to (null if unset)
    daysUntilExpiry: // days until the subscription lapses (active accounts)
      paidThrough && paidThrough > now
        ? Math.ceil((paidThrough - now) / 86400000)
        : null,
    serverTime: new Date(now).toISOString(),
  });
});

module.exports = routes;
