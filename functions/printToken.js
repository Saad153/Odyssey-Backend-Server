const jwt = require('jsonwebtoken');

// Set PRINT_TOKEN_SECRET to keep this fully separate from the login JWT_SECRET
// (recommended, so a leaked print token can never double as a login session
// token). Falls back to JWT_SECRET only so this works out of the box.
const PRINT_TOKEN_SECRET = process.env.PRINT_TOKEN_SECRET || process.env.JWT_SECRET;

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
