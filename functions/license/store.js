// Local persistence for the licensing subsystem.
//
// Holds two things on disk next to the executable:
//   - the last valid SIGNED license (blob + signature) so the app keeps
//     working through internet outages, and
//   - a monotonic high-water clock mark, so setting the system clock backwards
//     can't be used to dodge the grace deadline or the offline hard-expiry.
//
// The file is tamper-evident by design: the license half is signed, so editing
// it just makes verification fail (-> treated as no license). The clock mark is
// only ever moved FORWARD in memory, so deleting the file can't rewind time
// within a running process.

const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { LICENSE_CACHE_PATH, CLOCK_SKEW_MS } = require('./config');

let cache = {
  firstBootAt: null, // epoch ms of the very first boot on this machine
  clockHighWater: 0, // highest trusted epoch ms ever observed
  licenseJson: null, // exact signed string
  signature: null, // base64 signature over licenseJson
};
let loaded = false;

// The clock high-water mark advances on essentially every request as real time
// passes. Persisting it to disk that often would be a synchronous write per
// request on a high-throughput server, so we only flush it periodically - a
// minute of un-persisted advance is harmless (on restart firstBootAt re-anchors
// it). Licence saves / server-time observations flush immediately.
const HIGHWATER_FLUSH_MS = 60 * 1000;
let lastFlushedAt = 0;

function load() {
  if (loaded) return cache;
  try {
    const raw = fs.readFileSync(LICENSE_CACHE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    cache = {
      firstBootAt: parsed.firstBootAt || null,
      clockHighWater: Number(parsed.clockHighWater) || 0,
      licenseJson: typeof parsed.licenseJson === 'string' ? parsed.licenseJson : null,
      signature: typeof parsed.signature === 'string' ? parsed.signature : null,
    };
  } catch (_) {
    // Missing/corrupt file - start fresh.
    cache = { firstBootAt: null, clockHighWater: 0, licenseJson: null, signature: null };
  }
  if (!cache.firstBootAt) {
    cache.firstBootAt = Date.now();
  }
  // Persisted first boot is also a clock anchor.
  cache.clockHighWater = Math.max(cache.clockHighWater, cache.firstBootAt);
  loaded = true;
  persist();
  return cache;
}

function persist() {
  try {
    fs.writeFileSync(LICENSE_CACHE_PATH, JSON.stringify(cache), 'utf8');
    lastFlushedAt = Date.now();
  } catch (err) {
    // Non-fatal: we keep the in-memory copy. Log once, quietly.
    console.error('[license] could not persist cache:', err.message);
  }
}

/**
 * A clock that never runs backwards. Returns max(system now, high-water mark).
 * If the system clock is behind the high-water mark by more than the allowed
 * skew, the clock was rolled back - we ignore it and use the high-water mark,
 * so signed grace/expiry deadlines can't be escaped.
 */
function guardedNow() {
  load();
  const sys = Date.now();
  if (sys > cache.clockHighWater) {
    cache.clockHighWater = sys;
    // Throttled flush - see HIGHWATER_FLUSH_MS. Keep the mark in memory always.
    if (sys - lastFlushedAt > HIGHWATER_FLUSH_MS) {
      lastFlushedAt = sys;
      persist();
    }
    return sys;
  }
  // sys <= high water: only trust the system clock if it's within skew.
  if (cache.clockHighWater - sys > CLOCK_SKEW_MS) {
    return cache.clockHighWater; // rolled back - pin to last trusted time
  }
  return cache.clockHighWater;
}

/** Fold a server-provided epoch (issued_at) into the high-water mark. */
function observeServerTime(epochMs) {
  load();
  if (Number.isFinite(epochMs) && epochMs > cache.clockHighWater) {
    cache.clockHighWater = epochMs;
    persist();
  }
}

function saveLicense(licenseJson, signature) {
  load();
  cache.licenseJson = licenseJson;
  cache.signature = signature;
  persist();
}

function getSavedLicense() {
  load();
  return { licenseJson: cache.licenseJson, signature: cache.signature };
}

function getFirstBootAt() {
  load();
  return cache.firstBootAt;
}

// Stable-ish machine fingerprint so the license server can detect a build
// copied to a different box. Best-effort: hostname + platform + first
// non-internal MAC. Not a security boundary on its own.
function getFingerprint() {
  const parts = [os.hostname(), os.platform(), os.arch()];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const ni of ifaces[name] || []) {
      if (!ni.internal && ni.mac && ni.mac !== '00:00:00:00:00:00') {
        parts.push(ni.mac);
        break;
      }
    }
  }
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

module.exports = {
  load,
  guardedNow,
  observeServerTime,
  saveLicense,
  getSavedLicense,
  getFirstBootAt,
  getFingerprint,
};
