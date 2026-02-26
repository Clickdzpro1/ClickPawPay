// Chat API - Main endpoint for agent interaction
const express = require('express');
const router  = express.Router();
const { PrismaClient } = require('@prisma/client');
const AgentEngine = require('../agent/engine');
const { decrypt }  = require('../utils/encryption');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// ── AgentEngine singleton — created once at module load, reused per request ──
const agent = new AgentEngine({
  llmProvider: process.env.LLM_PROVIDER || 'anthropic',
  model:       process.env.LLM_MODEL    || 'claude-3-5-sonnet-20241022',
  apiKey:      process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY
});
// ─────────────────────────────────────────────────────────────────────────────

// Maximum allowed message length (configurable via env)
const MAX_MESSAGE_LENGTH = parseInt(process.env.MAX_MESSAGE_LENGTH || '4000', 10);

/**
 * POST /api/chat - Send message to agent
 */
router.post('/', async (req, res) => {
  try {
    const { message } = req.body;
    const { tenantId, userId } = req.user; // set by authMiddleware

    // ── Input validation ───────────────────────────────────────────────────
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`
      });
    }
    // ───────────────────────────────────────────────────────────────────────

    // ── Atomic check-and-increment of request counter ─────────────────────
    // Uses a Prisma transaction to prevent race conditions where two concurrent
    // requests both pass the limit check before either increments the counter.
    const tenant = await prisma.$transaction(async (tx) => {
      const t = await tx.tenant.findUnique({ where: { id: tenantId } });

      if (!t) return null;
      if (!t.isActive) return { __inactive: true };
      if (t.requestCount >= t.requestLimit) {
        return { __limitExceeded: true, requestLimit: t.requestLimit, resetDate: t.resetDate };
      }

      return tx.tenant.update({
        where: { id: tenantId },
        data:  { requestCount: { increment: 1 } }
      });
    });

    if (!tenant)               return res.status(403).json({ error: 'Tenant not found' });
    if (tenant.__inactive)     return res.status(403).json({ error: 'Tenant not active' });
    if (tenant.__limitExceeded) {
      return res.status(429).json({
        error:     'Request limit exceeded',
        limit:     tenant.requestLimit,
        resetDate: tenant.resetDate
      });
    }
    // ───────────────────────────────────────────────────────────────────────

    // Decrypt SlickPay API key for this tenant
    const slickpayKey = decrypt(tenant.slickpayKeyEnc);

    // Get or create the active conversation for this user
    let conversation = await prisma.conversation.findFirst({
      where:   { tenantId, userId, isActive: true },
      orderBy: { updatedAt: 'desc' }
    });

    const conversationHistory = conversation?.messages || [];

    // Process message through the AI agent loop
    const result = await agent.processMessage({
      tenantId,
      userId,
      userMessage: message,
      conversationHistory,
      slickpayKey
    });

    // Persist updated conversation history
    if (conversation) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data:  { messages: result.conversationHistory, updatedAt: new Date() }
      });
    } else {
      conversation = await prisma.conversation.create({
        data: { tenantId, userId, messages: result.conversationHistory }
      });
    }

    // Record financial transactions in the database
    for (const toolCall of result.toolCalls) {
      if (toolCall.tool === 'create_transfer' && toolCall.result.success) {
        await prisma.transaction.create({
          data: {
            tenantId,
            slickpayRef: toolCall.result.reference,
            type:        'TRANSFER',
            amount:      String(toolCall.args.amount), // String preserves Decimal precision
            toAccount:   toolCall.args.toPhone,
            status:      'COMPLETED',
            description: toolCall.args.description
          }
        });
      }

      if (toolCall.tool === 'create_invoice' && toolCall.result.success) {
        await prisma.transaction.create({
          data: {
            tenantId,
            slickpayRef: toolCall.result.invoiceId,
            type:        'INVOICE',
            amount:      String(toolCall.args.amount),
            status:      'PENDING',
            description: toolCall.args.description
          }
        });
      }
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action:    'chat_message',
        details:   {
          message:   message.substring(0, 200), // truncate for storage
          toolsUsed: result.toolCalls.map(tc => tc.tool)
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }
    });

    return res.json({
      response:       result.response,
      conversationId: conversation.id,
      toolCalls: result.toolCalls.map(tc => ({
        tool:    tc.tool,
        success: tc.result.success
      }))
    });

  } catch (error) {
    logger.error('Chat API error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      error:   'Failed to process message',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/chat/conversations - List conversations for the current user
 */
router.get('/conversations', async (req, res) => {
  try {
    const { tenantId, userId } = req.user;

    const conversations = await prisma.conversation.findMany({
      where:   { tenantId, userId, isActive: true },
      orderBy: { updatedAt: 'desc' },
      take:    20,
      select:  { id: true, createdAt: true, updatedAt: true, messages: true }
    });

    return res.json({ conversations });

  } catch (error) {
    logger.error('List conversations error', { error: error.message });
    return res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * DELETE /api/chat/conversations/:id - Soft-delete a conversation
 */
router.delete('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId, userId } = req.user;

    const result = await prisma.conversation.updateMany({
      where: { id, tenantId, userId },
      data:  { isActive: false }
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    return res.json({ success: true });

  } catch (error) {
    logger.error('Delete conversation error', { error: error.message });
    return res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

module.exports = router;
