const jwt = require('jsonwebtoken');
const { LRUCache } = require('lru-cache');

const JWT_SECRET =
  process.env.JWT_SECRET ||
  'qwertyuiopasdfghjklzxcvbnmqwertyuiopasdfghjklzxcvbnm';

// Cache decoded tokens (CRITICAL for performance)
const tokenCache = new LRUCache({
  max: 10000,
  ttl: 60 * 1000, // 1 minute
});

function extractToken(req) {
  const header =
    req.headers.authorization ||
    req.headers['x-access-token'];

  if (!header || typeof header !== 'string') return null;

  // ✅ Standard: "Bearer <token>"
  if (header.startsWith('Bearer ')) {
    return header.slice(7);
  }

  // ✅ Your legacy format: "BearerSplit<token>"
  if (header.startsWith('BearerSplit')) {
    return header.slice('BearerSplit'.length);
  }

  // ✅ Raw token fallback
  return header;
}

function verify(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      isLoggedIn: false,
      message: 'Token missing',
    });
  }

  // ✅ FAST PATH — no crypto
  const cachedUser = tokenCache.get(token);
  if (cachedUser) {
    req.user = cachedUser;
    return next();
  }

  try {
    // ✅ Crypto happens ONCE per minute per token
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = {
      id: decoded.id,
      username: decoded.username,
      designation: decoded.designation,
      access: decoded.access,
    };

    tokenCache.set(token, user);
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      isLoggedIn: false,
      message: 'Invalid or expired token',
    });
  }
}

module.exports = verify;