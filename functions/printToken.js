const jwt = require('jsonwebtoken');

// PRINT_TOKEN_SECRET keeps this fully separate from the login JWT_SECRET
// (recommended, so a leaked print token can never double as a login session
// token). Resolved centrally in functions/secrets.js, which falls back to
// JWT_SECRET when PRINT_TOKEN_SECRET is unset.
const { PRINT_TOKEN_SECRET } = require('./secrets');

function signPrintToken(invoiceId) {
  return jwt.sign(
    { invoiceId: String(invoiceId), purpose: 'invoice-print' },
    PRINT_TOKEN_SECRET,
    { expiresIn: '5m' }
  );
}

function verifyPrintToken(token, invoiceId) {
  const decoded = jwt.verify(token, PRINT_TOKEN_SECRET);
  if (decoded.purpose !== 'invoice-print' || String(decoded.invoiceId) !== String(invoiceId)) {
    throw new Error('Print token does not match this invoice.');
  }
  return decoded;
}

module.exports = { signPrintToken, verifyPrintToken };
