const jwt = require('jsonwebtoken');
const { LRUCache } = require('lru-cache');

const { JWT_SECRET } = require('./secrets');

// Cache decoded tokens (CRITICAL for performance)
const tokenCache = new LRUCache({
  max: 10000,
  ttl: 60 * 1000, // 1 minute
});

const sessionManager = require('./sessionManager');

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

// function verify(req, res, next) {
//   const token = extractToken(req);

//   if (!token) {
//     return res.status(401).json({
//       isLoggedIn: false,
//       message: 'Token missing',
//     });
//   }

//   // ✅ FAST PATH — no crypto
//   const cachedUser = tokenCache.get(token);
//   if (cachedUser) {
//     // Ensure the cached token still matches the session for this user
//     const sToken = sessionManager.getSessionToken(cachedUser.id);
//     if (sToken && sToken !== token) {
//       return res.status(401).json({
//         isLoggedIn: false,
//         message: 'User logged in elsewhere',
//       });
//     }
//     req.user = cachedUser;
//     return next();
//   }

//   try {
//     // ✅ Crypto happens ONCE per minute per token
//     const decoded = jwt.verify(token, JWT_SECRET);

//     const user = {
//       id: decoded.id,
//       username: decoded.username,
//       designation: decoded.designation,
//       access: decoded.access,
//     };

//     // Enforce single active-session per user
//     const existingSession = sessionManager.getSessionToken(user.id);
//     if (existingSession) {
//       // If existing session token differs from presented token, block access
//       if (existingSession !== token) {
//         return res.status(401).json({
//           isLoggedIn: false,
//           message: 'User logged in elsewhere',
//         });
//       }
//       // else token matches stored session — continue
//     } else {
//       // No session recorded (e.g. server restart) — restore session for this token
//       sessionManager.setSession(user.id, token);
//     }

//     tokenCache.set(token, user);
//     req.user = user;
//     next();
//   } catch (err) {
//     return res.status(401).json({
//       isLoggedIn: false,
//       message: 'Invalid or expired token',
//     });
//   }
// }

function verify(req, res, next) {
  const token = extractToken(req);
  const isLogoutRoute = req.path === '/authRoutes/logout';

  if (!token) {
    return res.status(401).json({
      isLoggedIn: false,
      message: 'Token missing',
    });
  }

  // ✅ FAST PATH — no crypto
  const cachedUser = tokenCache.get(token);
  if (cachedUser) {
    // Ensure the cached token still matches the current session for this
    // user. This must reject when sToken is falsy too (not just when it
    // differs from `token`) - a falsy sToken means the session was cleared
    // (e.g. logout), and letting that through was a real bug: a token used
    // at least once in the last 60s stayed valid via this cache even after
    // logout, since the old check only fired on a *mismatched* session.
    const sToken = sessionManager.getSessionToken(cachedUser.id);
    if (sToken !== token) {
      if (isLogoutRoute) {
        // Stale/cleared session but token decodes fine — still let logout through
        req.user = cachedUser;
        return next();
      }
      return res.status(401).json({
        isLoggedIn: false,
        message: sToken ? 'User logged in elsewhere' : 'Session expired',
      });
    }
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

    // Enforce single active-session per user
    const existingSession = sessionManager.getSessionToken(user.id);
    if (existingSession) {
      // If existing session token differs from presented token, block access
      if (existingSession !== token) {
        if (isLogoutRoute) {
          // Allow logout through even on a session mismatch
          req.user = user;
          return next();
        }
        return res.status(401).json({
          isLoggedIn: false,
          message: 'User logged in elsewhere',
        });
      }
      // else token matches stored session — continue
    } else {
      // No session recorded (e.g. server restart) — restore session for this token
      sessionManager.setSession(user.id, token);
    }

    tokenCache.set(token, user);
    req.user = user;
    next();
  } catch (err) {
    if (isLogoutRoute) {
      // Token expired/invalid signature — still try to decode (unsafe) so we
      // can identify the user and clear their server-side session anyway.
      try {
        const decodedUnsafe = jwt.decode(token);
        if (decodedUnsafe && decodedUnsafe.id) {
          req.user = { id: decodedUnsafe.id };
          return next();
        }
      } catch (_) {
        // fall through to 401 below
      }
    }
    return res.status(401).json({
      isLoggedIn: false,
      message: 'Invalid or expired token',
    });
  }
}

module.exports = verify;