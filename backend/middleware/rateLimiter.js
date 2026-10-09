/**
 * Lightweight, zero-dependency in-memory sliding window rate limiter
 * Protects login, registration, and OTP verification/resend endpoints against brute-force attacks.
 */

const clientWindows = new Map();

// Periodic cleanup of expired rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of clientWindows.entries()) {
    if (now > data.resetTime) {
      clientWindows.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Creates a rate-limiting middleware for express
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.maxRequests - Maximum requests permitted in window
 * @param {string} options.message - Error message when limit is exceeded
 * @param {Function} [options.keyGenerator] - Optional custom key generator
 */
export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  maxRequests = 10,
  message = 'Too many requests. Please try again later.',
  keyGenerator = null,
}) {
  return (req, res, next) => {
    // Determine client identifier: IP + endpoint, or custom key
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket?.remoteAddress || 'unknown';
    const key = keyGenerator ? keyGenerator(req) : `${ip}:${req.baseUrl}${req.path}`;

    const now = Date.now();
    let record = clientWindows.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      clientWindows.set(key, record);
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - 1);
      return next();
    }

    record.count += 1;
    const remaining = Math.max(0, maxRequests - record.count);
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > maxRequests) {
      const retryAfterSecs = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
      res.setHeader('Retry-After', retryAfterSecs);
      return res.status(429).json({
        success: false,
        message,
        retryAfter: retryAfterSecs,
      });
    }

    next();
  };
}

// Pre-configured rate limiters for auth
export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // Max 10 login attempts per 15 mins per IP
  message: 'Too many login attempts. Please wait 15 minutes before trying again.',
});

export const otpVerifyRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxRequests: 15,
  message: 'Too many verification attempts. Please wait 10 minutes or request a new code.',
});

export const otpResendRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 5,
  message: 'Too many OTP resend requests. Please wait a few minutes before trying again.',
});

export const registerRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 20,
  message: 'Registration limit reached for this IP. Please try again later.',
});
