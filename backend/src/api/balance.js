// Balance API — fetch SlickPay account balance for the current tenant
const express       = require('express');
const router        = express.Router();
const { decrypt }   = require('../utils/encryption');
const SlickPayClient = require('../utils/slickpayClient');
const logger        = require('../utils/logger');

/**
 * GET /api/balance
 * Decrypts tenant's SlickPay key and fetches live account balance.
 * Protected by authMiddleware + tenantScopeMiddleware (req.tenant is set).
 */
router.get('/', async (req, res) => {
  try {
    const { slickpayKeyEnc } = req.tenant;

    let slickpayKey;
    try {
      slickpayKey = decrypt(slickpayKeyEnc);
    } catch (decryptErr) {
      logger.error('Failed to decrypt SlickPay key', { tenantId: req.tenant.id });
      return res.status(500).json({ error: 'Failed to access payment credentials' });
    }

    const client = new SlickPayClient(slickpayKey);

    const response = await client.get('/api/v2/users/balance');
    const data     = response.data;

    res.json({
      balance:   data.balance,
      currency:  data.currency || 'DZD',
      accountId: data.account_id || data.id || null
    });
  } catch (err) {
    const status  = err.response?.status;
    const message = err.response?.data?.message || err.message;

    logger.error('GET /balance error', { error: message, status });

    if (status === 401 || status === 403) {
      return res.status(502).json({ error: 'Invalid SlickPay credentials. Please update your API key in Settings.' });
    }

    res.status(502).json({ error: 'Could not fetch balance from SlickPay. Please try again.' });
  }
});

module.exports = router;
