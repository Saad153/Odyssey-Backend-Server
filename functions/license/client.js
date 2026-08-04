// License client: phones the cloud server for a fresh signed license on an
// interval, and computes the current enforcement MODE from whatever signed
// license is cached (works fully offline off the last good one).
//
// The server is authoritative for the timeline. On suspend it signs a license
// with mode 'warn' and a grace_ends_at 15 days out, then 'readonly' after. The
// client only ever ENFORCES those signed deadlines against a monotonic clock -
// it never invents leniency the server didn't grant.

const {
  LICENSE_SERVER_URL,
  INSTALL_ID,
  HEARTBEAT_INTERVAL_MS,
  BOOTSTRAP_GRACE_MS,
  LICENSE_EXEMPT,
  MODES,
} = require('./config');
const { verifyLicense } = require('./verifier');
const store = require('./store');

let lastComputed = { mode: MODES.ACTIVE, message: '', graceEndsAt: null, source: 'init' };
let appVersion = 'unknown';

// computeState() sits in the per-request enforcement path on a high-throughput
// server. The result only changes on a heartbeat (every few hours) or when a
// signed deadline is crossed, so recomputing (an Ed25519 verify) on every
// request is wasteful. Memoize for a few seconds - deadlines are day-scale, so
// a few seconds of latency on a mode flip is irrelevant.
const RECOMPUTE_TTL_MS = 5000;
let lastComputedAt = 0;

function setAppVersion(v) {
  appVersion = v || 'unknown';
}

/** Parse + verify the cached signed license, or null if absent/invalid. */
function readValidLicense() {
  const { licenseJson, signature } = store.getSavedLicense();
  if (!licenseJson || !signature) return null;
  const lic = verifyLicense(licenseJson, signature);
  if (!lic) return null;
  // A license is only for THIS install - reject a blob copied from elsewhere.
  if (lic.install_id !== INSTALL_ID) return null;
  return lic;
}

/**
 * Effective enforcement state, memoized for RECOMPUTE_TTL_MS so the per-request
 * enforcement path doesn't verify a signature every call. Use recompute() to
 * force a fresh evaluation (e.g. right after a heartbeat updates the licence).
 */
function computeState() {
  const now = Date.now();
  if (now - lastComputedAt < RECOMPUTE_TTL_MS) {
    return lastComputed;
  }
  lastComputedAt = now;
  return computeStateFresh();
}

/** Force a fresh evaluation, bypassing the memo. */
function recompute() {
  lastComputedAt = Date.now();
  return computeStateFresh();
}

function computeStateFresh() {
  // Owner / self-hosted exemption: never gate this install.
  if (LICENSE_EXEMPT) {
    lastComputed = {
      mode: MODES.ACTIVE,
      message: '',
      graceEndsAt: null,
      paidThrough: null,
      source: 'exempt',
    };
    return lastComputed;
  }

  const now = store.guardedNow();
  const lic = readValidLicense();

  if (!lic) {
    // Never got a valid license yet. Stay fully usable during the bootstrap
    // window, then fall back to read-only rather than bricking outright.
    const age = now - store.getFirstBootAt();
    if (age <= BOOTSTRAP_GRACE_MS) {
      const daysLeft = Math.ceil((BOOTSTRAP_GRACE_MS - age) / 86400000);
      lastComputed = {
        mode: MODES.ACTIVE,
        message:
          `Activating licence… awaiting first contact with the licence server ` +
          `(${daysLeft} day${daysLeft === 1 ? '' : 's'} left).`,
        graceEndsAt: store.getFirstBootAt() + BOOTSTRAP_GRACE_MS,
        source: 'bootstrap',
      };
    } else {
      lastComputed = {
        mode: MODES.READONLY,
        message:
          'This installation could not be activated with the licence server. ' +
          'The system is read-only. Please contact your provider.',
        graceEndsAt: null,
        source: 'bootstrap-expired',
      };
    }
    return lastComputed;
  }

  // We have a valid signed license. hard_expiry is the outer bound: too long
  // since a fresh signed license (e.g. kept offline to dodge the switch) ->
  // read-only regardless of the mode the last license carried.
  if (Number.isFinite(lic.hard_expiry) && now > lic.hard_expiry) {
    lastComputed = {
      mode: MODES.READONLY,
      message:
        'The licence for this installation is stale and must be re-validated ' +
        'online. The system is read-only until it reconnects.',
      graceEndsAt: null,
      source: 'hard-expiry',
    };
    return lastComputed;
  }

  let mode = lic.mode || (lic.status === 'active' ? MODES.ACTIVE : MODES.READONLY);

  // Enforce the signed grace deadline even while offline: once past it, warn
  // becomes read-only without needing the server to say so again.
  if (mode === MODES.WARN && Number.isFinite(lic.grace_ends_at) && now > lic.grace_ends_at) {
    mode = MODES.READONLY;
  }

  lastComputed = {
    mode,
    message: lic.message || defaultMessage(mode, lic.grace_ends_at, now),
    graceEndsAt: lic.grace_ends_at || null,
    paidThrough: lic.paid_through || null,
    source: 'license',
  };
  return lastComputed;
}

function defaultMessage(mode, graceEndsAt, now) {
  if (mode === MODES.WARN && Number.isFinite(graceEndsAt)) {
    const days = Math.max(0, Math.ceil((graceEndsAt - now) / 86400000));
    return (
      `Your subscription requires attention. The system becomes read-only in ` +
      `${days} day${days === 1 ? '' : 's'}. Please contact your provider.`
    );
  }
  if (mode === MODES.READONLY) {
    return 'Your subscription is inactive. The system is read-only. Please contact your provider.';
  }
  return '';
}

/** Current state without recomputing (for hot paths that just ran compute). */
function getState() {
  return lastComputed;
}

/** One heartbeat round-trip. Persists a fresh signed license on success. */
async function heartbeatOnce() {
  const body = {
    install_id: INSTALL_ID,
    fingerprint: store.getFingerprint(),
    app_version: appVersion,
    current_mode: lastComputed.mode,
  };
  try {
    const res = await fetch(`${LICENSE_SERVER_URL}/api/heartbeat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      // Undici global dispatcher is already tuned in index.js.
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error('[license] heartbeat HTTP', res.status);
      return computeState();
    }
    const data = await res.json();
    const lic = verifyLicense(data.license, data.signature);
    if (!lic || lic.install_id !== INSTALL_ID) {
      console.error('[license] heartbeat returned an invalid/mismatched license');
      return computeState();
    }
    store.observeServerTime(lic.issued_at);
    store.saveLicense(data.license, data.signature);
  } catch (err) {
    // Offline / DNS / timeout: keep running off the cached license.
    console.error('[license] heartbeat failed:', err.message);
  }
  // A fresh licence may have just been saved - evaluate it now, don't wait out
  // the memo window.
  return recompute();
}

let timer = null;

/** Load cache, do the first heartbeat, then poll on an interval. */
async function start() {
  // Exempt install: no phone-home, no timer, always active.
  if (LICENSE_EXEMPT) {
    console.log('[license] LICENSE_EXEMPT=true — enforcement disabled (owner install)');
    return recompute();
  }
  store.load();
  await heartbeatOnce();
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    heartbeatOnce().catch(() => {});
  }, HEARTBEAT_INTERVAL_MS);
  if (timer.unref) timer.unref(); // don't keep the process alive on its own
  const s = getState();
  console.log(`[license] install=${INSTALL_ID} mode=${s.mode} (${s.source})`);
  return s;
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = {
  start,
  stop,
  computeState,
  recompute,
  getState,
  heartbeatOnce,
  setAppVersion,
  MODES,
};
