// ClickPawPay Backend Server - Simplified
require('dotenv').config();
const crypto = require('crypto');

// ── Auto-generate secrets if missing (for easy local/VPS deployment) ────────
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('[WARN] JWT_SECRET auto-generated. Set it in .env for persistence.');
}

if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  console.warn('[WARN] ENCRYPTION_KEY auto-generated. Set it in .env for persistence.');
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('[WARN] ANTHROPIC_API_KEY not set. AI chat features will be disabled.');
}
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const logger  = require('./src/utils/logger');
const prisma  = require('./src/utils/prisma');

// Import routes
const authRoutes        = require('./src/api/auth');
const tenantRoutes      = require('./src/api/tenants');
const chatRoutes        = require('./src/api/chat');
const transactionRoutes = require('./src/api/transactions');
const balanceRoutes     = require('./src/api/balance');
const settingsRoutes    = require('./src/api/settings');

// Import middleware
const tenantScopeMiddleware = require('./src/middleware/tenantScope');
const authMiddleware        = require('./src/middleware/auth');
const { chatLimiter, authLimiter } = require('./src/middleware/rateLimit');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security middleware ──────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", process.env.SLICKPAY_API_URL || 'https://api.slick-pay.com'],
      fontSrc:    ["'self'"],
      objectSrc:  ["'none'"],
      frameSrc:   ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false
}));

// ── CORS - Allow all *.clickpawpay.com subdomains + localhost ────────────────
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (server-to-server, curl, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Allow localhost and 127.0.0.1 for development
    if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) {
      return callback(null, true);
    }
    
    // Allow any *.clickpawpay.com subdomain (http or https)
    if (origin.match(/^https?:\/\/[a-z0-9-]+\.clickpawpay\.com$/)) {
      return callback(null, true);
    }
    
    // Allow clickpawpay.com itself
    if (origin === 'http://clickpawpay.com' || origin === 'https://clickpawpay.com') {
      return callback(null, true);
    }
    
    // Allow IP-based origins (common for VPS deployments before domain setup)
    if (origin.match(/^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/)) {
      return callback(null, true);
    }

    // Check custom ALLOWED_ORIGINS env var if set
    const customOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    if (customOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Reject all others
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'ClickPawPay API'
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'ClickPawPay API',
      error: 'Database connection failed'
    });
  }
});

// Public routes (no auth required)
// Use authLimiter for auth routes (5 attempts / 15 min)
app.use('/api/auth', authLimiter, authRoutes);

// Protected routes (require authentication and tenant scope)
app.use('/api/tenants',      authMiddleware, tenantRoutes);
app.use('/api/chat',         authMiddleware, tenantScopeMiddleware, chatLimiter, chatRoutes);
app.use('/api/transactions', authMiddleware, tenantScopeMiddleware, transactionRoutes);
app.use('/api/balance',      authMiddleware, tenantScopeMiddleware, balanceRoutes);
app.use('/api/settings',     authMiddleware, tenantScopeMiddleware, settingsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, _next) => {
  // Handle CORS errors specifically
  if (err.message && err.message.includes('not allowed by CORS')) {
    logger.warn('CORS blocked', { origin: req.get('origin'), path: req.path });
    return res.status(403).json({ error: 'CORS: Origin not allowed' });
  }

  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path
  });

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Start server
app.listen(PORT, () => {
  logger.info(`ClickPawPay API running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
