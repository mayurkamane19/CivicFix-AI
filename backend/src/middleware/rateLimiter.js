/**
 * In-Memory Sliding-Window Rate Limiting Middleware
 * Protects authentication endpoints from automated brute-force and credential-stuffing attacks.
 * 
 * Note: In multi-instance / clustered production deployments, an external centralized
 * store such as Redis is recommended to synchronize rate limits across instances.
 */

export const createRateLimiter = ({
  windowMs = 15 * 60 * 1000,
  maxRequests = 10,
  message = 'Too many requests. Please try again later.'
}) => {
  const store = new Map();

  // Periodic cleanup of expired IP records to prevent memory growth
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of store.entries()) {
      if (now > entry.resetTime) {
        store.delete(ip);
      }
    }
  }, 60 * 1000);

  // Unref interval so it does not block Node process exit
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  const rateLimiterMiddleware = (req, res, next) => {
    // In test environment, skip rate limiting unless explicitly testing rate limits
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const ip =
      req.ip ||
      req.headers['x-forwarded-for'] ||
      req.connection?.remoteAddress ||
      'unknown-ip';

    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || now > entry.resetTime) {
      store.set(ip, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    if (entry.count >= maxRequests) {
      const retryAfterSec = Math.ceil((entry.resetTime - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        success: false,
        message,
        retryAfterSeconds: retryAfterSec
      });
    }

    entry.count += 1;
    return next();
  };

  rateLimiterMiddleware.reset = () => {
    store.clear();
  };

  return rateLimiterMiddleware;
};

// 10 login attempts per 15 minutes per IP
export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: 'Too many login attempts from this IP address. Please try again after 15 minutes.'
});

// 10 citizen registrations per 60 minutes per IP
export const registerRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 10,
  message: 'Registration limit reached for this IP address. Please try again later.'
});

export default {
  createRateLimiter,
  loginRateLimiter,
  registerRateLimiter
};
