const jwt = require('jsonwebtoken');
const verify = require('../../functions/tokenVerification');
const sessionManager = require('../../functions/sessionManager');

// Same secret source the middleware under test uses (functions/secrets.js);
// under NODE_ENV=test both resolve to the fixed test default.
const { JWT_SECRET } = require('../../functions/secrets');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq({ headers = {}, path = '/some/protected/route' } = {}) {
  return { headers, path };
}

// tokenCache (functions/tokenVerification.js) is a module-level singleton
// with a 60s TTL shared across this whole test file - give every test its
// own userId/token payload (via a unique `sub`) so cache entries from one
// test can never be mistaken for another's.
let counter = 0;
function uniqueUserId() {
  counter += 1;
  return `tv-test-user-${Date.now()}-${counter}`;
}

function signToken(payload, options) {
  return jwt.sign(payload, JWT_SECRET, options);
}

describe('functions/tokenVerification.js (verify middleware)', () => {
  const usedUserIds = [];

  afterEach(() => {
    usedUserIds.splice(0).forEach((id) => sessionManager.clearSession(id));
  });

  it('rejects with 401 when no token is present at all', () => {
    const res = mockRes();
    const next = jest.fn();
    verify(mockReq(), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects a malformed/garbage token with 401 "Invalid or expired token"', () => {
    const res = mockRes();
    const next = jest.fn();
    verify(mockReq({ headers: { authorization: 'Bearer not-a-real-jwt' } }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid or expired token' })
    );
  });

  it('rejects an expired token with 401', () => {
    const userId = uniqueUserId();
    usedUserIds.push(userId);
    const token = signToken({ id: userId, username: 'x', designation: 'employee' }, { expiresIn: -10 });

    const res = mockRes();
    const next = jest.fn();
    verify(mockReq({ headers: { authorization: `Bearer ${token}` } }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('accepts a token passed via the x-access-token header (no Authorization header)', () => {
    const userId = uniqueUserId();
    usedUserIds.push(userId);
    const token = signToken({ id: userId, username: 'xatuser', designation: 'employee' });

    const res = mockRes();
    const next = jest.fn();
    const req = mockReq({ headers: { 'x-access-token': token } });
    verify(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: userId, username: 'xatuser' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('accepts the legacy "BearerSplit<token>" Authorization header format', () => {
    const userId = uniqueUserId();
    usedUserIds.push(userId);
    const token = signToken({ id: userId, username: 'legacyuser', designation: 'employee' });

    const res = mockRes();
    const next = jest.fn();
    const req = mockReq({ headers: { authorization: `BearerSplit${token}` } });
    verify(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: userId, username: 'legacyuser' });
  });

  it('establishes a session on first use when none exists yet (e.g. after a server restart)', () => {
    const userId = uniqueUserId();
    usedUserIds.push(userId);
    const token = signToken({ id: userId, username: 'freshuser', designation: 'employee' });

    expect(sessionManager.isActive(userId)).toBe(false);
    const next = jest.fn();
    verify(mockReq({ headers: { authorization: `Bearer ${token}` } }), mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(sessionManager.isTokenValid(userId, token)).toBe(true);
  });

  describe('"logged in elsewhere" - a different, currently-active session for the same user', () => {
    it('rejects on the slow (jwt.verify) path when the token has never been cached before', () => {
      const userId = uniqueUserId();
      usedUserIds.push(userId);
      const activeToken = signToken({ id: userId, username: 'u', designation: 'employee', access: 'A' });
      const otherToken = signToken({ id: userId, username: 'u', designation: 'employee', access: 'B' });
      expect(otherToken).not.toBe(activeToken);

      sessionManager.setSession(userId, activeToken);

      const res = mockRes();
      const next = jest.fn();
      verify(mockReq({ headers: { authorization: `Bearer ${otherToken}` } }), res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'User logged in elsewhere' })
      );
    });

    it('rejects on the fast (cached) path once a different session becomes active after the token was cached', () => {
      const userId = uniqueUserId();
      usedUserIds.push(userId);
      const tokenB = signToken({ id: userId, username: 'u', designation: 'employee' });

      // Establish tokenB as this user's own session and cache it (slow path).
      sessionManager.setSession(userId, tokenB);
      const next1 = jest.fn();
      verify(mockReq({ headers: { authorization: `Bearer ${tokenB}` } }), mockRes(), next1);
      expect(next1).toHaveBeenCalledTimes(1);

      // Someone else logs in as this user elsewhere, replacing the session -
      // tokenB is still cached (fast path) but is no longer the active session.
      const tokenA = signToken({ id: userId, username: 'u', designation: 'employee', access: 'elsewhere' });
      sessionManager.setSession(userId, tokenA);

      const res = mockRes();
      const next2 = jest.fn();
      verify(mockReq({ headers: { authorization: `Bearer ${tokenB}` } }), res, next2);

      expect(next2).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'User logged in elsewhere' })
      );
    });

    // Regression test for the fix: this fast-path branch used to only fire
    // when sToken *differed* from the presented token - when there was
    // simply no session at all (e.g. right after logout), a token cached in
    // the last 60s was let through anyway. See tests/integration/auth.test.js
    // for the same bug demonstrated through the real HTTP logout flow.
    it('rejects on the fast (cached) path once the session is cleared entirely (e.g. logout)', () => {
      const userId = uniqueUserId();
      usedUserIds.push(userId);
      const token = signToken({ id: userId, username: 'u', designation: 'employee' });

      sessionManager.setSession(userId, token);
      const next1 = jest.fn();
      verify(mockReq({ headers: { authorization: `Bearer ${token}` } }), mockRes(), next1);
      expect(next1).toHaveBeenCalledTimes(1);

      // Log out: session cleared, but the token is still warm in tokenCache.
      sessionManager.clearSession(userId);

      const res = mockRes();
      const next2 = jest.fn();
      verify(mockReq({ headers: { authorization: `Bearer ${token}` } }), res, next2);

      expect(next2).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Session expired' })
      );
    });
  });

  describe('isLogoutRoute special-casing (req.path === "/authRoutes/logout")', () => {
    it('still lets logout through on the fast path even with a cleared session, without re-establishing one', () => {
      const userId = uniqueUserId();
      usedUserIds.push(userId);
      const token = signToken({ id: userId, username: 'u', designation: 'employee' });

      sessionManager.setSession(userId, token);
      verify(mockReq({ headers: { authorization: `Bearer ${token}` } }), mockRes(), jest.fn());
      sessionManager.clearSession(userId);

      const res = mockRes();
      const next = jest.fn();
      const req = mockReq({ headers: { authorization: `Bearer ${token}` }, path: '/authRoutes/logout' });
      verify(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toMatchObject({ id: userId });
      expect(sessionManager.isActive(userId)).toBe(false);
    });

    it('lets a well-formed but expired token through on the slow path via unsafe decode, to identify the user for cleanup', () => {
      const userId = uniqueUserId();
      usedUserIds.push(userId);
      const token = signToken({ id: userId, username: 'u', designation: 'employee' }, { expiresIn: -10 });

      const res = mockRes();
      const next = jest.fn();
      const req = mockReq({ headers: { authorization: `Bearer ${token}` }, path: '/authRoutes/logout' });
      verify(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toEqual({ id: userId });
      expect(res.status).not.toHaveBeenCalled();
    });

    it('still rejects with 401 on the logout route when the token is not a JWT at all (nothing to decode)', () => {
      const res = mockRes();
      const next = jest.fn();
      const req = mockReq({ headers: { authorization: 'Bearer complete-garbage' }, path: '/authRoutes/logout' });
      verify(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
