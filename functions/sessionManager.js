const { LRUCache } = require('lru-cache');

// Session TTL matches token expiry (12 hours)
const SESSION_TTL = 12 * 60 * 60 * 1000;

const sessionCache = new LRUCache({
  max: 10000,
  ttl: SESSION_TTL,
});

module.exports = {
  setSession(userId, token) {
    if (userId == null) return;
    sessionCache.set(String(userId), token);
  },
  clearSession(userId) {
    if (userId == null) return;
    sessionCache.delete(String(userId));
  },
  getSessionToken(userId) {
    if (userId == null) return undefined;
    return sessionCache.get(String(userId));
  },
  isTokenValid(userId, token) {
    if (userId == null) return false;
    const t = sessionCache.get(String(userId));
    return Boolean(t && t === token);
  },
  isActive(userId) {
    if (userId == null) return false;
    return sessionCache.has(String(userId));
  },
};
