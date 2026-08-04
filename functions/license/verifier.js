// Verifies license blobs signed by the cloud license server's Ed25519 private
// key. A blob is the exact JSON string the server signed, plus a base64
// signature over those exact bytes. If either is tampered with, verification
// fails and the caller treats the license as absent.

const crypto = require('crypto');
const { LICENSE_PUBLIC_KEY } = require('./config');

/**
 * @param {string} licenseJson  Exact JSON string that was signed (do not re-stringify a parsed object - byte-for-byte matters).
 * @param {string} signatureB64 Base64 Ed25519 signature.
 * @returns {object|null} Parsed license object if the signature is valid, else null.
 */
function verifyLicense(licenseJson, signatureB64) {
  if (typeof licenseJson !== 'string' || typeof signatureB64 !== 'string') {
    return null;
  }
  try {
    const ok = crypto.verify(
      null, // Ed25519 ignores the hash algorithm argument
      Buffer.from(licenseJson, 'utf8'),
      LICENSE_PUBLIC_KEY,
      Buffer.from(signatureB64, 'base64')
    );
    if (!ok) return null;
    return JSON.parse(licenseJson);
  } catch (_) {
    return null;
  }
}

module.exports = { verifyLicense };
