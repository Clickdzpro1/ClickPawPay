// Tool Executor — Executes agent tool calls with arg validation and timeout
const SlickPaySkills = require('../skills/slickpaySkills');
const logger = require('../utils/logger');

// Timeout for individual tool executions (ms)
const TOOL_TIMEOUT_MS = parseInt(process.env.TOOL_TIMEOUT_MS || '30000', 10);

class ToolExecutor {

  /**
   * Get all available tool definitions for the LLM (Anthropic tool_use format)
   */
  static getToolDefinitions() {
    return [
      {
        name: 'create_account',
        description: 'Create a new SlickPay account for receiving payments',
        input_schema: {
          type: 'object',
          properties: {
            firstName: { type: 'string', description: 'Account holder first name' },
            lastName:  { type: 'string', description: 'Account holder last name' },
            phone:     { type: 'string', description: 'Phone number in international format (e.g. +213555123456)' }
          },
          required: ['firstName', 'lastName', 'phone']
        }
      },
      {
        name: 'list_accounts',
        description: 'List all SlickPay accounts linked to this tenant',
        input_schema: { type: 'object', properties: {} }
      },
      {
        name: 'create_transfer',
        description: 'Send money to a phone number. ALWAYS ask for explicit user confirmation before executing.',
        input_schema: {
          type: 'object',
          properties: {
            toPhone:     { type: 'string', description: 'Recipient phone number in international format' },
            amount:      { type: 'number', description: 'Positive amount in DZD (max 10,000,000)' },
            description: { type: 'string', description: 'Payment description (optional)' }
          },
          required: ['toPhone', 'amount']
        }
      },
      {
        name: 'get_transfer_details',
        description: 'Get details of a specific transfer by its ID',
        input_schema: {
          type: 'object',
          properties: {
            transferId: { type: 'string', description: 'Transfer ID or reference' }
          },
          required: ['transferId']
        }
      },
      {
        name: 'list_transfers',
        description: 'List recent transfers with optional limit (1-100)',
        input_schema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of transfers to retrieve (default 20, max 100)' }
          }
        }
      },
      {
        name: 'calculate_commission',
        description: 'Calculate the SlickPay commission fee for a given transfer amount',
        input_schema: {
          type: 'object',
          properties: {
            amount: { type: 'number', description: 'Amount in DZD to calculate commission for' }
          },
          required: ['amount']
        }
      },
      {
        name: 'create_invoice',
        description: 'Create a payment invoice and return a payment link for a customer',
        input_schema: {
          type: 'object',
          properties: {
            amount:        { type: 'number',  description: 'Invoice amount in DZD' },
            description:   { type: 'string',  description: 'Invoice description' },
            customerEmail: { type: 'string',  description: 'Customer email address (optional)' }
          },
          required: ['amount', 'description']
        }
      },
      {
        name: 'get_balance',
        description: 'Get the current account balance',
        input_schema: { type: 'object', properties: {} }
      }
    ];
  }

  /**
   * Get skill descriptions for the system prompt
   */
  static getAvailableSkills() {
    return this.getToolDefinitions().map(tool => ({
      name:        tool.name,
      description: tool.description
    }));
  }

  /**
   * Execute a tool by name.
   * Validates required arguments before calling the skill.
   * Applies a configurable execution timeout.
   */
  static async executeTool({ toolName, arguments: args = {}, tenantId, slickpayKey }) {
    logger.info('Executing tool', { toolName, tenantId });

    // ── Pre-execution: validate required fields from schema ────────────────
    const toolDef = this.getToolDefinitions().find(t => t.name === toolName);
    if (!toolDef) {
      logger.error('Unknown tool requested', { toolName, tenantId });
      return { success: false, error: `Unknown tool: ${toolName}` };
    }

    const requiredFields = toolDef.input_schema.required || [];
    const missingFields  = requiredFields.filter(f => args[f] == null);
    if (missingFields.length > 0) {
      logger.error('Tool called with missing required arguments', { toolName, missingFields });
      return { success: false, error: `Missing required arguments: ${missingFields.join(', ')}` };
    }
    // ───────────────────────────────────────────────────────────────────────

    // ── Tool dispatch map ──────────────────────────────────────────────────
    const toolMap = {
      'create_account':       () => SlickPaySkills.createAccount({ ...args, slickpayKey }),
      'list_accounts':        () => SlickPaySkills.listAccounts({ slickpayKey }),
      'create_transfer':      () => SlickPaySkills.createTransfer({ ...args, slickpayKey }),
      'get_transfer_details': () => SlickPaySkills.getTransferDetails({ ...args, slickpayKey }),
      'list_transfers':       () => SlickPaySkills.listTransfers({ ...args, slickpayKey }),
      'calculate_commission': () => SlickPaySkills.calculateCommission({ ...args, slickpayKey }),
      'create_invoice':       () => SlickPaySkills.createInvoice({ ...args, slickpayKey }),
      'get_balance':          () => SlickPaySkills.getBalance({ slickpayKey })
    };
    // ───────────────────────────────────────────────────────────────────────

    try {
      // Wrap execution in a timeout to prevent hanging requests
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Tool ${toolName} timed out after ${TOOL_TIMEOUT_MS}ms`)),
          TOOL_TIMEOUT_MS
        )
      );

      const result = await Promise.race([toolMap[toolName](), timeoutPromise]);

      logger.info('Tool executed successfully', { toolName, success: result.success, tenantId });
      return result;

    } catch (error) {
      logger.error('Tool execution failed', { toolName, error: error.message, tenantId });
      return { success: false, error: error.message };
    }
  }
}

module.exports = ToolExecutor;
