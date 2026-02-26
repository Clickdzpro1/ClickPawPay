// Tenants API — tenant profile management
const express  = require('express');
const router   = express.Router();
const { PrismaClient } = require('@prisma/client');
const { encrypt } = require('../utils/encryption');
const logger   = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * GET /api/tenants/me
 * Returns the current tenant's profile and usage stats.
 * Protected by authMiddleware (req.user is set).
 */
router.get('/me', async (req, res) => {
  try {
    const { tenantId } = req.user;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id:           true,
        name:         true,
        subdomain:    true,
        plan:         true,
        isActive:     true,
        requestCount: true,
        requestLimit: true,
        resetDate:    true,
        createdAt:    true,
        _count: {
          select: { users: true, transactions: true }
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json({
      id:           tenant.id,
      name:         tenant.name,
      subdomain:    tenant.subdomain,
      plan:         tenant.plan,
      isActive:     tenant.isActive,
      requestCount: tenant.requestCount,
      requestLimit: tenant.requestLimit,
      resetDate:    tenant.resetDate,
      createdAt:    tenant.createdAt,
      userCount:    tenant._count.users,
      transactionCount: tenant._count.transactions
    });
  } catch (err) {
    logger.error('GET /tenants/me error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/tenants/me
 * Update the current tenant's name and/or SlickPay key.
 * Body: { name?, slickpayKey? }
 */
router.patch('/me', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { name, slickpayKey } = req.body;

    if (!name && !slickpayKey) {
      return res.status(400).json({ error: 'Provide at least one field to update: name or slickpayKey' });
    }

    const updateData = {};

    if (name) {
      if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
        return res.status(400).json({ error: 'name must be between 2 and 100 characters' });
      }
      updateData.name = name.trim();
    }

    if (slickpayKey) {
      if (typeof slickpayKey !== 'string' || slickpayKey.trim().length < 10) {
        return res.status(400).json({ error: 'slickpayKey appears invalid (too short)' });
      }
      updateData.slickpayKeyEnc = encrypt(slickpayKey.trim());
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data:  updateData,
      select: {
        id:        true,
        name:      true,
        subdomain: true,
        plan:      true,
        isActive:  true,
        updatedAt: true
      }
    });

    logger.info('Tenant updated', { tenantId, fields: Object.keys(updateData) });
    res.json({ message: 'Tenant updated successfully', tenant: updated });
  } catch (err) {
    logger.error('PATCH /tenants/me error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
