// Agent Engine - The core AI loop (OpenClaw-inspired)
const axios = require('axios');
const logger = require('../utils/logger');
const PromptBuilder = require('./promptBuilder');
const ToolExecutor = require('./toolExecutor');

class AgentEngine {
  constructor(config = {}) {
    this.llmProvider = config.llmProvider || 'anthropic'; // or 'openai'
    this.model = config.model || 'claude-3-5-sonnet-20241022';
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    this.maxIterations = config.maxIterations || 10;
  }

  /**
   * Main agent loop: Observe → Think → Act
   * @param {Object} params - {tenantId, userId, userMessage, conversationHistory, slickpayKey}
   * @returns {Object} - {response, toolCalls, conversationHistory}
   */
  async processMessage(params) {
    const { tenantId, userId, userMessage, conversationHistory = [], slickpayKey } = params;
    
    logger.info('Agent processing message', { tenantId, userId });

    // Build the system prompt with skills and context
    const systemPrompt = PromptBuilder.buildSystemPrompt({
      tenantId,
      skills: ToolExecutor.getAvailableSkills()
    });

    // Add user message to conversation
    const messages = [
      ...conversationHistory,
      { role: 'user', content: userMessage, timestamp: new Date().toISOString() }
    ];

    let iteration = 0;
    let finalResponse = '';
    const toolCallsExecuted = [];

    // Agent loop
    while (iteration < this.maxIterations) {
      iteration++;

      try {
        // Call LLM
        const llmResponse = await this.callLLM(systemPrompt, messages);

        // Check if LLM wants to use a tool
        if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
          logger.info('Agent requesting tool execution', {
            tools: llmResponse.toolCalls.map(tc => tc.name)
          });

          // Execute each tool call
          for (const toolCall of llmResponse.toolCalls) {
            const toolResult = await ToolExecutor.executeTool({
              toolName: toolCall.name,
              arguments: toolCall.arguments,
              tenantId,
              slickpayKey
            });

            toolCallsExecuted.push({
              tool: toolCall.name,
              args: toolCall.arguments,
              result: toolResult,
              timestamp: new Date().toISOString()
            });

            // Add tool result to conversation
            messages.push({
              role: 'assistant',
              content: llmResponse.content || '',
              toolCalls: [toolCall],
              timestamp: new Date().toISOString()
            });

            messages.push({
              role: 'user',
              content: `Tool result for ${toolCall.name}: ${JSON.stringify(toolResult)}`,
              timestamp: new Date().toISOString()
            });
          }

          // Continue loop - let LLM process tool results
          continue;
        }

        // No more tool calls - we have final response
        finalResponse = llmResponse.content;
        messages.push({
          role: 'assistant',
          content: finalResponse,
          timestamp: new Date().toISOString()
        });
        break;

      } catch (error) {
        logger.error('Agent loop error', { error: error.message, iteration });
        throw new Error(`Agent processing failed: ${error.message}`);
      }
    }

    if (iteration >= this.maxIterations) {
      logger.warn('Agent hit max iterations', { tenantId });
      finalResponse = "I apologize, but I couldn't complete that request. Please try rephrasing or contact support.";
    }

    return {
      response: finalResponse,
      toolCalls: toolCallsExecuted,
      conversationHistory: messages
    };
  }

  /**
   * Call the LLM API (Anthropic Claude example)
   */
  async callLLM(systemPrompt, messages) {
    if (this.llmProvider === 'anthropic') {
      return this.callClaude(systemPrompt, messages);
    } else if (this.llmProvider === 'openai') {
      return this.callOpenAI(systemPrompt, messages);
    }
    throw new Error(`Unsupported LLM provider: ${this.llmProvider}`);
  }

  async callClaude(systemPrompt, messages) {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        })),
        tools: ToolExecutor.getToolDefinitions()
      },
      {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }
      }
    );

    const content = response.data.content;
    
    // Parse tool calls if present
    const toolCalls = content
      .filter(block => block.type === 'tool_use')
      .map(block => ({
        id: block.id,
        name: block.name,
        arguments: block.input
      }));

    // Get text content
    const textContent = content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    return {
      content: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : null
    };
  }

  async callOpenAI(systemPrompt, messages) {
    // Similar implementation for OpenAI
    throw new Error('OpenAI provider not yet implemented');
  }
}

module.exports = AgentEngine;
