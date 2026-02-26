// ClickClawPay Backend Server
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const logger = require('./src/utils/logger');

// Import routes
const authRoutes = require('./src/api/auth');
const tenantRoutes = require('./src/api/tenants');
const chatRoutes = require('./src/api/chat');
const transactionRoutes = require('./src/api/transactions');

// Import middleware
const tenantScopeMiddleware = require('./src/middleware/tenantScope');
const authMiddleware = require('./src/middleware/auth');
const rateLimitMiddleware = require('./src/middleware/rateLimit');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
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
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'ClickClawPay API'
  });
});

// Public routes (no auth required)
app.use('/api/auth', rateLimitMiddleware, authRoutes);

// Protected routes (require authentication and tenant scope)
app.use('/api/tenants', authMiddleware, tenantRoutes);
app.use('/api/chat', authMiddleware, tenantScopeMiddleware, rateLimitMiddleware, chatRoutes);
app.use('/api/transactions', authMiddleware, tenantScopeMiddleware, transactionRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
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
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 ClickClawPay API running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
