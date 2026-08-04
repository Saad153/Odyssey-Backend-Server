// functions/history.js also exports createHistory, which pulls in
// ../models at module load time - and requiring ../models (models/index.js)
// unconditionally kicks off a real sequelize.sync() against Postgres as a
// side effect, even though nothing in this file needs a DB. Mock it out so
// this stays a true zero-DB unit test (matching the "unit" Jest project's
// contract) instead of silently opening a real connection in the
// background that then errors after Jest tears the test file down.
jest.mock('../../models', () => ({
  sequelize: { transaction: jest.fn() },
  History: { create: jest.fn() },
}));

const { getClientIp } = require('../../functions/history');

describe('getClientIp', () => {
  it('prefers X-Forwarded-For header, taking only the first IP in the list', () => {
    const req = { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }, socket: {} };
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('trims whitespace around the first X-Forwarded-For entry', () => {
    const req = { headers: { 'x-forwarded-for': '  1.2.3.4  , 5.6.7.8' }, socket: {} };
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('falls back to socket.remoteAddress when there is no X-Forwarded-For header', () => {
    const req = { headers: {}, socket: { remoteAddress: '10.0.0.5' } };
    expect(getClientIp(req)).toBe('10.0.0.5');
  });

  it('strips the IPv4-mapped IPv6 prefix from socket.remoteAddress', () => {
    const req = { headers: {}, socket: { remoteAddress: '::ffff:192.168.1.23' } };
    expect(getClientIp(req)).toBe('192.168.1.23');
  });

  it('falls back to req.ip when socket.remoteAddress is missing', () => {
    const req = { headers: {}, socket: {}, ip: '172.16.0.1' };
    expect(getClientIp(req)).toBe('172.16.0.1');
  });

  it('returns "unknown" when no IP information is available at all', () => {
    const req = { headers: {}, socket: {} };
    expect(getClientIp(req)).toBe('unknown');
  });
});
