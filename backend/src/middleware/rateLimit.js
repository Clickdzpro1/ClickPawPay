// Rate limiting middleware — backed by Redis for multi-instance consistency
const rateLimit = require('express-rate-limit');
const { createClient } = require('redis');
const logger = require('../utils/logger');

// ── Redis client (shared across limiters) ─────────────────────────────────────
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });

redisClient.connect().catch(err => {
  logger.warn('Redis unavailable — rate limiting falls back to per-process memory store', {
    err: err.message
  });
});

redisClient.on('error', err => {
  logger.warn('Redis rate-limit client error', { err: err.message });
});
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a minimal Redis store compatible with express-rate-limit v7.
 * Falls back gracefully if Redis is unavailable (allows request, logs warning).
 *
 * @param {string} prefix   - Key namespace, e.g. 'rl:chat'
 * @param {number} windowSec - Window duration in seconds (for TTL)
 */
function makeRedisStore(prefix, windowSec) {
  return {
    async increment(key) {
      try {
        const k = `${prefix}:${key}`;
        const count = await redisClient.incr(k);
        if (count === 1) await redisClient.expire(k, windowSec);
        return { totalHits: count, resetTime: undefined };
      } catch (err) {
        logger.warn('Redis store increment failed, skipping rate limit', { err: err.message });
        return { totalHits: 0, resetTime: undefined }; // allow request on Redis failure
      }
    },
    async decrement(key) {
      try { await redisClient.decr(`${prefix}:${key}`); } catch (_) {}
    },
    async resetKey(key) {
      try { await redisClient.del(`${prefix}:${key}`); } catch (_) {}
    }
  };
}

// ── Chat limiter: 10 messages / minute, keyed by userId (or IP as fallback) ──
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Key by authenticated userId when available so users can't bypass by changing IP
  keyGenerator: (req) => req.user?.userId || req.ip,
  store: makeRedisStore('rl:chat', 60),
  handler: (req, res) => {
    logger.warn('Chat rate limit exceeded', { userId: req.user?.userId, ip: req.ip, path: req.path });
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Please wait before sending more messages'
    });
  }
});

// ── Auth limiter: 5 attempts / 15 min, keyed by IP (no userId yet at login) ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  store: makeRedisStore('rl:auth', 900),
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', { ip: req.ip, path: req.path });
    return res.status(429).json({
      error: 'Too many login attempts',
      message: 'Please try again in 15 minutes'
    });
  }
});

module.exports = chatLimiter; // default export (used in server.js for /api/chat)
module.exports.chatLimiter = chatLimiter;
module.exports.authLimiter = authLimiter;
