// ClickPawPay Backend Server
require('dotenv').config();

// ── Fail-fast: crash immediately if required secrets are missing ──────────────
const REQUIRED_ENV = ['JWT_SECRET', 'ENCRYPTION_KEY', 'DATABASE_URL', 'ANTHROPIC_API_KEY'];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length > 0) {
  console.error(`\nFATAL: Missing required environment variables: ${missingEnv.join(', ')}`);
  console.error('Copy backend/.env.example to backend/.env and fill in all values.\n');
  process.exit(1);
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

// ── CORS — never allow credentials with wildcard origin ──────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost', 'http://127.0.0.1'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (server-to-server, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
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
