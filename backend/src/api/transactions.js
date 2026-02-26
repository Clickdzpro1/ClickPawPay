// Transactions API — view and export payment history
const express = require('express');
const router  = express.Router();
const prisma       = require('../utils/prisma');
const logger  = require('../utils/logger');


/**
 * GET /api/transactions/export
 * Export transactions as CSV. MUST be registered before /:id.
 * Query: status?, startDate?, endDate?
 */
router.get('/export', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { status, startDate, endDate } = req.query;

    const where = { tenantId };

    if (status) where.status = status.toUpperCase();
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate)   where.createdAt.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    const txns = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000 // safety cap
    });

    // Build CSV
    const header = 'id,type,amount,currency,status,fromAccount,toAccount,slickpayRef,description,createdAt';
    const rows = txns.map(t =>
      [
        t.id,
        t.type,
        t.amount,
        t.currency,
        t.status,
        t.fromAccount || '',
        t.toAccount   || '',
        t.slickpayRef || '',
        (t.description || '').replace(/,/g, ';'),
        t.createdAt.toISOString()
      ].join(',')
    );

    const csv = [header, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="transactions-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    logger.error('GET /transactions/export error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/transactions
 * List transactions for the current tenant with filters and pagination.
 * Query: page (default 1), limit (default 10), status?, startDate?, endDate?, search?
 * Returns: { transactions, total, page, limit, stats }
 */
router.get('/', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const {
      page      = 1,
      limit     = 10,
      status,
      startDate,
      endDate,
      search
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip     = (pageNum - 1) * limitNum;

    // Build where clause
    const where = { tenantId };

    if (status) {
      where.status = status.toUpperCase();
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate)   where.createdAt.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    if (search) {
      where.OR = [
        { slickpayRef: { contains: search, mode: 'insensitive' } },
        { toAccount:   { contains: search, mode: 'insensitive' } },
        { fromAccount: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Fetch transactions + total count in parallel
    const [txns, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take:    limitNum,
        select: {
          id:          true,
          type:        true,
          amount:      true,
          currency:    true,
          status:      true,
          fromAccount: true,
          toAccount:   true,
          slickpayRef: true,
          description: true,
          createdAt:   true,
          updatedAt:   true
        }
      }),
      prisma.transaction.count({ where })
    ]);

    // Stats — counts regardless of current filters
    const now     = new Date();
    const todayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayCount, monthCount, totalCount] = await Promise.all([
      prisma.transaction.count({ where: { tenantId, createdAt: { gte: todayStart } } }),
      prisma.transaction.count({ where: { tenantId, createdAt: { gte: monthStart } } }),
      prisma.transaction.count({ where: { tenantId } })
    ]);

    res.json({
      transactions: txns,
      total,
      page:  pageNum,
      limit: limitNum,
      stats: {
        today: todayCount,
        month: monthCount,
        total: totalCount
      }
    });
  } catch (err) {
    logger.error('GET /transactions error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/transactions/:id
 * Get a single transaction by ID (must belong to the tenant).
 */
router.get('/:id', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id }       = req.params;

    const txn = await prisma.transaction.findFirst({
      where: { id, tenantId }
    });

    if (!txn) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(txn);
  } catch (err) {
    logger.error('GET /transactions/:id error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
