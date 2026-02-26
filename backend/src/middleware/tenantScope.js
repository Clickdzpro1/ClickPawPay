// Tenant Scope Middleware
// Validates that the authenticated user's tenant exists and is active.
// Must run after authMiddleware (which sets req.user).
// Attaches req.tenant for use in downstream route handlers.

const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

module.exports = async (req, res, next) => {
  try {
    const { tenantId } = req.user;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subdomain: true,
        plan: true,
        slickpayKeyEnc: true,
        isActive: true,
        requestCount: true,
        requestLimit: true,
        resetDate: true,
        createdAt: true,
      },
    });

    if (!tenant) {
      return res.status(403).json({ error: 'Tenant not found' });
    }

    if (!tenant.isActive) {
      return res.status(403).json({ error: 'Tenant account is inactive' });
    }

    req.tenant = tenant;
    next();
  } catch (err) {
    logger.error('tenantScope middleware error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
  }
};
