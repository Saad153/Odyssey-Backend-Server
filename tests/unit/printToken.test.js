// functions/printToken.js reads PRINT_TOKEN_SECRET (falling back to
// JWT_SECRET) once, at require time - neither is guaranteed to be set in a
// pure unit-test process (dotenv is only loaded when index.js is required,
// which unit tests deliberately never do), so we set it ourselves before the
// first require below to mirror how it's configured in every real
// environment (.env sets PRINT_TOKEN_SECRET).
process.env.PRINT_TOKEN_SECRET = 'unit-test-print-secret';

const jwt = require('jsonwebtoken');
const { signPrintToken, verifyPrintToken } = require('../../functions/printToken');

describe('printToken', () => {
  it('signs a token that verifies successfully for the same invoiceId', () => {
    const token = signPrintToken('inv-123');
    const decoded = verifyPrintToken(token, 'inv-123');
    expect(decoded.invoiceId).toBe('inv-123');
    expect(decoded.purpose).toBe('invoice-print');
  });

  it('coerces invoiceId to a string on both sign and verify (numeric vs string match)', () => {
    const token = signPrintToken(123);
    expect(() => verifyPrintToken(token, '123')).not.toThrow();
    expect(() => verifyPrintToken(token, 123)).not.toThrow();
  });

  it('throws when the invoiceId does not match the token', () => {
    const token = signPrintToken('inv-123');
    expect(() => verifyPrintToken(token, 'inv-999')).toThrow(
      'Print token does not match this invoice.'
    );
  });

  it('throws for a token signed with a different purpose', () => {
    const token = jwt.sign(
      { invoiceId: 'inv-123', purpose: 'something-else' },
      process.env.PRINT_TOKEN_SECRET,
      { expiresIn: '5m' }
    );
    expect(() => verifyPrintToken(token, 'inv-123')).toThrow(
      'Print token does not match this invoice.'
    );
  });

  it('throws for an expired token', () => {
    const expired = jwt.sign(
      { invoiceId: 'inv-123', purpose: 'invoice-print' },
      process.env.PRINT_TOKEN_SECRET,
      { expiresIn: -10 }
    );
    expect(() => verifyPrintToken(expired, 'inv-123')).toThrow();
  });

  it('throws for a token signed with the wrong secret', () => {
    const token = jwt.sign(
      { invoiceId: 'inv-123', purpose: 'invoice-print' },
      'a-completely-different-secret',
      { expiresIn: '5m' }
    );
    expect(() => verifyPrintToken(token, 'inv-123')).toThrow();
  });

  it('throws for a garbage token string', () => {
    expect(() => verifyPrintToken('not-a-real-token', 'inv-123')).toThrow();
  });
});
