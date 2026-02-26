// Rate limiting middleware
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Create different limiters for different endpoints
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per IP
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({ 
      error: 'Too many requests',
      message: 'Please wait before sending more messages'
    });
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: { error: 'Too many login attempts' },
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({ 
      error: 'Too many login attempts',
      message: 'Please try again in 15 minutes'
    });
  }
});

module.exports = chatLimiter; // Default export
module.exports.chatLimiter = chatLimiter;
module.exports.authLimiter = authLimiter;
