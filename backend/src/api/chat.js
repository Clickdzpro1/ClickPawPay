// Chat API - Main endpoint for agent interaction
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const AgentEngine = require('../agent/engine');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * POST /api/chat - Send message to agent
 */
router.post('/', async (req, res) => {
  try {
    const { message } = req.body;
    const { tenantId, userId } = req.user; // From auth middleware

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get tenant's SlickPay key
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant || !tenant.isActive) {
      return res.status(403).json({ error: 'Tenant not active' });
    }

    // Check request limit
    if (tenant.requestCount >= tenant.requestLimit) {
      return res.status(429).json({ 
        error: 'Request limit exceeded',
        limit: tenant.requestLimit,
        resetDate: tenant.resetDate
      });
    }

    // Decrypt SlickPay API key
    const slickpayKey = decrypt(tenant.slickpayKeyEnc);

    // Get or create conversation
    let conversation = await prisma.conversation.findFirst({
      where: { tenantId, userId, isActive: true },
      orderBy: { updatedAt: 'desc' }
    });

    const conversationHistory = conversation?.messages || [];

    // Initialize agent
    const agent = new AgentEngine({
      llmProvider: process.env.LLM_PROVIDER || 'anthropic',
      model: process.env.LLM_MODEL,
      apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY
    });

    // Process message
    const result = await agent.processMessage({
      tenantId,
      userId,
      userMessage: message,
      conversationHistory,
      slickpayKey
    });

    // Save conversation
    if (conversation) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { 
          messages: result.conversationHistory,
          updatedAt: new Date()
        }
      });
    } else {
      conversation = await prisma.conversation.create({
        data: {
          tenantId,
          userId,
          messages: result.conversationHistory
        }
      });
    }

    // Log tool calls as transactions if applicable
    for (const toolCall of result.toolCalls) {
      if (toolCall.tool === 'create_transfer' && toolCall.result.success) {
        await prisma.transaction.create({
          data: {
            tenantId,
            slickpayRef: toolCall.result.reference,
            type: 'TRANSFER',
            amount: toolCall.args.amount,
            toAccount: toolCall.args.toPhone,
            status: 'COMPLETED',
            description: toolCall.args.description
          }
        });
      }
    }

    // Increment request count
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { requestCount: { increment: 1 } }
    });

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'chat_message',
        details: {
          message: message.substring(0, 200),
          toolsUsed: result.toolCalls.map(tc => tc.tool)
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }
    });

    res.json({
      response: result.response,
      conversationId: conversation.id,
      toolCalls: result.toolCalls.map(tc => ({
        tool: tc.tool,
        success: tc.result.success
      }))
    });

  } catch (error) {
    logger.error('Chat API error', { error: error.message, stack: error.stack });
    res.status(500).json({ 
      error: 'Failed to process message',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/chat/conversations - List conversations
 */
router.get('/conversations', async (req, res) => {
  try {
    const { tenantId, userId } = req.user;

    const conversations = await prisma.conversation.findMany({
      where: { tenantId, userId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        messages: true
      }
    });

    res.json({ conversations });

  } catch (error) {
    logger.error('List conversations error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * DELETE /api/chat/conversations/:id - Delete conversation
 */
router.delete('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId, userId } = req.user;

    await prisma.conversation.updateMany({
      where: { id, tenantId, userId },
      data: { isActive: false }
    });

    res.json({ success: true });

  } catch (error) {
    logger.error('Delete conversation error', { error: error.message });
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

module.exports = router;
