const sessionManager = require('../../functions/sessionManager');

describe('sessionManager (single-active-session enforcement)', () => {
  const userId = `test-user-${Date.now()}`;

  afterEach(() => {
    sessionManager.clearSession(userId);
    sessionManager.clearSession(123);
  });

  it('isActive is false and getSessionToken is undefined before any session is set', () => {
    expect(sessionManager.isActive(userId)).toBe(false);
    expect(sessionManager.getSessionToken(userId)).toBeUndefined();
  });

  it('setSession makes isActive true and stores the token', () => {
    sessionManager.setSession(userId, 'token-a');
    expect(sessionManager.isActive(userId)).toBe(true);
    expect(sessionManager.getSessionToken(userId)).toBe('token-a');
  });

  it('isTokenValid is true only for the exact stored token', () => {
    sessionManager.setSession(userId, 'token-a');
    expect(sessionManager.isTokenValid(userId, 'token-a')).toBe(true);
    expect(sessionManager.isTokenValid(userId, 'token-b')).toBe(false);
  });

  it('clearSession removes the session', () => {
    sessionManager.setSession(userId, 'token-a');
    sessionManager.clearSession(userId);
    expect(sessionManager.isActive(userId)).toBe(false);
    expect(sessionManager.isTokenValid(userId, 'token-a')).toBe(false);
  });

  it('setSession overwrites a previous session for the same user (single active session)', () => {
    sessionManager.setSession(userId, 'token-a');
    sessionManager.setSession(userId, 'token-b');
    expect(sessionManager.getSessionToken(userId)).toBe('token-b');
    expect(sessionManager.isTokenValid(userId, 'token-a')).toBe(false);
    expect(sessionManager.isTokenValid(userId, 'token-b')).toBe(true);
  });

  it('keys sessions by String(userId), so numeric and string forms of the same id collide', () => {
    sessionManager.setSession(123, 'token-x');
    expect(sessionManager.isActive('123')).toBe(true);
    expect(sessionManager.isTokenValid('123', 'token-x')).toBe(true);
  });

  describe('null/undefined userId handling', () => {
    it('setSession is a no-op for null/undefined userId', () => {
      expect(() => sessionManager.setSession(null, 'token')).not.toThrow();
      expect(() => sessionManager.setSession(undefined, 'token')).not.toThrow();
      expect(sessionManager.isActive(null)).toBe(false);
      expect(sessionManager.isActive(undefined)).toBe(false);
    });

    it('isActive/isTokenValid/getSessionToken return falsy for null/undefined userId', () => {
      expect(sessionManager.isActive(null)).toBe(false);
      expect(sessionManager.isTokenValid(null, 'anything')).toBe(false);
      expect(sessionManager.getSessionToken(null)).toBeUndefined();
    });

    it('clearSession is a no-op for null/undefined userId (does not throw)', () => {
      expect(() => sessionManager.clearSession(null)).not.toThrow();
      expect(() => sessionManager.clearSession(undefined)).not.toThrow();
    });
  });
});
