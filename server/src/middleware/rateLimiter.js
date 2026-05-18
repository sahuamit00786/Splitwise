// /server/src/middleware/rateLimiter.js
import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for authentication routes
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: {
    success: false,
    message: 'Too many attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * General API rate limiter
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    success: false,
    message: 'Too many requests, please slow down'
  },
  standardHeaders: true,
  legacyHeaders: false
});
