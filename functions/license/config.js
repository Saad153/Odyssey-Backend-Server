// Licensing / kill-switch configuration.
//
// This whole folder is compiled into the sealed executable (see build
// pipeline). The PUBLIC key below is safe to ship - it can only *verify*
// license blobs, never mint them. The matching PRIVATE key lives ONLY on
// your cloud license server.
//
// Per-install values (LICENSE_SERVER_URL, INSTALL_ID) are baked in at build
// time via env for each customer, so one customer's binary can't be pointed
// at another install's identity.

const path = require('path');

// Ed25519 public key. Regenerate the pair only if the private key is ever
// exposed - doing so invalidates every deployed build.
const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAjxu3xde97d9p4ymEUGuMVYIM1p3uldyYPyKSUuQx0GY=
-----END PUBLIC KEY-----`;

module.exports = {
  LICENSE_PUBLIC_KEY,

  // Your cloud license server. Baked per-install at build time.
  LICENSE_SERVER_URL:
    process.env.LICENSE_SERVER_URL || 'https://license.seanetpk.com',

  // Unique id for THIS customer install. Baked per-install at build time.
  INSTALL_ID: process.env.INSTALL_ID || 'odyssey-dev-local',

  // Where the last signed license is cached so blips in connectivity to the
  // cloud never stop the app. Defaults next to the running executable.
  LICENSE_CACHE_PATH:
    process.env.LICENSE_CACHE_PATH ||
    path.join(
      path.dirname(process.execPath || process.cwd()),
      'odyssey-license.dat'
    ),

  // How often to phone home for a fresh signed license.
  HEARTBEAT_INTERVAL_MS: 3 * 60 * 60 * 1000, // 3 hours

  // First-ever boot with no cached license and no reachable server: stay
  // fully usable this long before falling back to read-only, so a bad first
  // install day never bricks the customer.
  BOOTSTRAP_GRACE_MS: 7 * 24 * 60 * 60 * 1000, // 7 days

  // Clock-skew tolerance when detecting a rolled-back system clock.
  CLOCK_SKEW_MS: 10 * 60 * 1000, // 10 minutes

  // Owner / self-hosted exemption. When true, the licensing subsystem is a
  // no-op: always 'active', no heartbeat, nothing ever goes read-only. Use this
  // for the company that owns the software (it doesn't licence itself) so it can
  // never lock itself out. Set LICENSE_EXEMPT=true in that install's .env.
  LICENSE_EXEMPT: process.env.LICENSE_EXEMPT === 'true',

  // Writes are blocked in this mode. Reads and invoice printing stay alive.
  MODES: { ACTIVE: 'active', WARN: 'warn', READONLY: 'readonly' },
};
