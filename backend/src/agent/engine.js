// Agent Engine - The core AI loop (OpenClaw-inspired)
const axios  = require('axios');
const logger = require('../utils/logger');
const PromptBuilder = require('./promptBuilder');
const ToolExecutor  = require('./toolExecutor');

// Maximum messages sent to the LLM per turn (prevents token-limit errors).
// Full history is still persisted to the database.
const MAX_HISTORY = parseInt(process.env.MAX_CONVERSATION_HISTORY || '20', 10);

// Timeout for each LLM API call (ms)
const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || '60000', 10);

class AgentEngine {
  constructor(config = {}) {
    this.llmProvider   = config.llmProvider || 'anthropic';
    this.model         = config.model       || 'claude-3-5-sonnet-20241022';
    this.apiKey        = config.apiKey      || process.env.ANTHROPIC_API_KEY;
    this.maxIterations = config.maxIterations || 10;
  }

  /**
   * Prune message history to MAX_HISTORY entries before sending to the LLM.
   * Keeps the first message (current user turn anchor) and the most recent tail.
   * The full messages array is still returned for DB persistence.
   */
  pruneMessages(messages) {
    if (messages.length <= MAX_HISTORY) return messages;
    return [messages[0], ...messages.slice(-(MAX_HISTORY - 1))];
  }

  /**
   * Main agent loop: Observe → Think → Act
   * @param {Object} params - {tenantId, userId, userMessage, conversationHistory, slickpayKey}
   * @returns {Object}      - {response, toolCalls, conversationHistory}
   */
  async processMessage(params) {
    const { tenantId, userId, userMessage, conversationHistory = [], slickpayKey } = params;

    logger.info('Agent processing message', { tenantId, userId });

    // Build the system prompt with available skills
    const systemPrompt = PromptBuilder.buildSystemPrompt({
      tenantId,
      skills: ToolExecutor.getAvailableSkills()
    });

    // Append the new user message to the full history
    const messages = [
      ...conversationHistory,
      { role: 'user', content: userMessage, timestamp: new Date().toISOString() }
    ];

    let iteration = 0;
    let finalResponse = '';
    const toolCallsExecuted = [];

    // ── Agent loop ────────────────────────────────────────────────────────────
    while (iteration < this.maxIterations) {
      iteration++;

      try {
        // Prune before each LLM call to stay within context limits
        const prunedMessages = this.pruneMessages(messages);

        const llmResponse = await this.callLLM(systemPrompt, prunedMessages);

        // ── Tool use branch ───────────────────────────────────────────────────
        if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
          logger.info('Agent requesting tool execution', {
            tools: llmResponse.toolCalls.map(tc => tc.name)
          });

          // 1. Store the assistant turn with the full raw content array.
          //    This preserves the tool_use blocks the Anthropic API requires.
          messages.push({
            role:    'assistant',
            content: llmResponse.rawContent,  // full content array from API
            timestamp: new Date().toISOString()
          });

          // 2. Execute all tool calls and collect results into a single user turn.
          const toolResultContents = [];

          for (const toolCall of llmResponse.toolCalls) {
            const toolResult = await ToolExecutor.executeTool({
              toolName:  toolCall.name,
              arguments: toolCall.arguments,
              tenantId,
              slickpayKey
            });

            toolCallsExecuted.push({
              tool:      toolCall.name,
              args:      toolCall.arguments,
              result:    toolResult,
              timestamp: new Date().toISOString()
            });

            // Anthropic requires tool_result blocks keyed by tool_use_id
            toolResultContents.push({
              type:        'tool_result',
              tool_use_id: toolCall.id,
              content:     JSON.stringify(toolResult)
            });
          }

          // 3. Push a single user message containing all tool_result blocks
          messages.push({
            role:    'user',
            content: toolResultContents,
            timestamp: new Date().toISOString()
          });

          // Let the LLM process tool results
          continue;
        }

        // ── Final response branch ─────────────────────────────────────────────
        finalResponse = llmResponse.content;
        messages.push({
          role:    'assistant',
          content: finalResponse,
          timestamp: new Date().toISOString()
        });
        logger.info('Agent produced final response', { tenantId, iteration });
        break;

      } catch (error) {
        logger.error('Agent loop error', { error: error.message, iteration, tenantId });
        throw new Error(`Agent processing failed: ${error.message}`);
      }
    }

    if (iteration >= this.maxIterations) {
      logger.warn('Agent hit max iterations', { tenantId, maxIterations: this.maxIterations });
      finalResponse = "I apologize, but I couldn't complete that request. Please try rephrasing or contact support at info@clickdz.ai.";
    }

    return {
      response:            finalResponse,
      toolCalls:           toolCallsExecuted,
      conversationHistory: messages        // full history for DB persistence
    };
  }

  /**
   * Dispatch to the correct LLM provider
   */
  async callLLM(systemPrompt, messages) {
    if (this.llmProvider === 'anthropic') {
      return this.callClaude(systemPrompt, messages);
    } else if (this.llmProvider === 'openai') {
      return this.callOpenAI(systemPrompt, messages);
    }
    throw new Error(`Unsupported LLM provider: ${this.llmProvider}`);
  }

  /**
   * Call Anthropic Claude Messages API.
   * Returns { content, rawContent, toolCalls }
   *   - content:    plain text response (may be empty when tools are used)
   *   - rawContent: full content array from the API (needed for proper tool_use tracking)
   *   - toolCalls:  parsed tool-use blocks, or null
   */
  async callClaude(systemPrompt, messages) {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model:      this.model,
        max_tokens: 4096,
        system:     systemPrompt,
        // Pass content as-is: arrays for tool messages, strings for text turns
        messages: messages.map(m => ({
          role:    m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        })),
        tools: ToolExecutor.getToolDefinitions()
      },
      {
        headers: {
          'x-api-key':          this.apiKey,
          'anthropic-version':  '2023-06-01',
          'content-type':       'application/json'
        },
        timeout: LLM_TIMEOUT_MS  // prevent hanging requests
      }
    );

    const content = response.data.content || [];

    // Parse tool_use blocks
    const toolCalls = content
      .filter(block => block.type === 'tool_use')
      .map(block => ({
        id:        block.id,
        name:      block.name,
        arguments: block.input
      }));

    // Concatenate text blocks
    const textContent = content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    return {
      content:    textContent,
      rawContent: content,                                  // preserved for message history
      toolCalls:  toolCalls.length > 0 ? toolCalls : null
    };
  }

  async callOpenAI(systemPrompt, messages) {
    throw new Error('OpenAI provider not yet implemented');
  }
}

module.exports = AgentEngine;
