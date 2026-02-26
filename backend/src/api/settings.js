// Settings API — manage tenant settings and test integrations
const express        = require('express');
const router         = express.Router();
const prisma          = require('../utils/prisma');
const { encrypt, decrypt } = require('../utils/encryption');
const SlickPayClient = require('../utils/slickpayClient');
const logger         = require('../utils/logger');


/**
 * GET /api/settings
 * Returns tenant settings with the SlickPay key masked.
 */
router.get('/', async (req, res) => {
  try {
    const { tenantId } = req.user;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id:             true,
        name:           true,
        subdomain:      true,
        plan:           true,
        slickpayKeyEnc: true,
        isActive:       true,
        requestCount:   true,
        requestLimit:   true,
        resetDate:      true,
        createdAt:      true,
        updatedAt:      true
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Mask SlickPay key — show only last 4 chars
    let slickpayKeyMasked = null;
    try {
      const raw = decrypt(tenant.slickpayKeyEnc);
      slickpayKeyMasked = `****${raw.slice(-4)}`;
    } catch {
      slickpayKeyMasked = '****';
    }

    res.json({
      id:               tenant.id,
      name:             tenant.name,
      subdomain:        tenant.subdomain,
      plan:             tenant.plan,
      isActive:         tenant.isActive,
      requestCount:     tenant.requestCount,
      requestLimit:     tenant.requestLimit,
      resetDate:        tenant.resetDate,
      createdAt:        tenant.createdAt,
      updatedAt:        tenant.updatedAt,
      slickpayKeyMasked
    });
  } catch (err) {
    logger.error('GET /settings error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/settings
 * Update tenant name and/or SlickPay key.
 * Body: { name?, slickpayKey? }
 */
router.put('/', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { name, slickpayKey } = req.body;

    if (!name && !slickpayKey) {
      return res.status(400).json({ error: 'Provide at least one field: name or slickpayKey' });
    }

    const updateData = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
        return res.status(400).json({ error: 'name must be 2–100 characters' });
      }
      updateData.name = name.trim();
    }

    if (slickpayKey !== undefined) {
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
        updatedAt: true
      }
    });

    logger.info('Settings updated', { tenantId, fields: Object.keys(updateData) });
    res.json({ message: 'Settings updated successfully', tenant: updated });
  } catch (err) {
    logger.error('PUT /settings error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/settings/test
 * Test a specific integration.
 * Body: { provider: 'slickpay' }
 */
router.post('/test', async (req, res) => {
  try {
    const { provider } = req.body;

    if (!provider) {
      return res.status(400).json({ error: 'provider is required' });
    }

    if (provider === 'slickpay') {
      const { slickpayKeyEnc } = req.tenant;

      let slickpayKey;
      try {
        slickpayKey = decrypt(slickpayKeyEnc);
      } catch {
        return res.json({ success: false, message: 'Could not decrypt SlickPay key' });
      }

      const client = new SlickPayClient(slickpayKey);
      try {
        const response = await client.get('/api/v2/users/balance');
        const balance  = response.data.balance;
        const currency = response.data.currency || 'DZD';
        return res.json({
          success: true,
          message: `SlickPay connected. Balance: ${balance} ${currency}`
        });
      } catch (slickErr) {
        const msg = slickErr.response?.data?.message || slickErr.message;
        return res.json({ success: false, message: `SlickPay connection failed: ${msg}` });
      }
    }

    res.status(400).json({ error: `Unknown provider: ${provider}. Supported: slickpay` });
  } catch (err) {
    logger.error('POST /settings/test error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
