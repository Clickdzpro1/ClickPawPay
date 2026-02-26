// Tool Executor - Executes agent tool calls
const SlickPaySkills = require('./slickpaySkills');
const logger = require('../utils/logger');

class ToolExecutor {
  
  /**
   * Get all available tool definitions for the LLM
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
            lastName: { type: 'string', description: 'Account holder last name' },
            phone: { type: 'string', description: 'Phone number in international format' }
          },
          required: ['firstName', 'lastName', 'phone']
        }
      },
      {
        name: 'list_accounts',
        description: 'List all SlickPay accounts',
        input_schema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'create_transfer',
        description: 'Send money to a phone number. Always ask for confirmation before executing.',
        input_schema: {
          type: 'object',
          properties: {
            toPhone: { type: 'string', description: 'Recipient phone number' },
            amount: { type: 'number', description: 'Amount in DZD' },
            description: { type: 'string', description: 'Payment description' }
          },
          required: ['toPhone', 'amount']
        }
      },
      {
        name: 'get_transfer_details',
        description: 'Get details of a specific transfer by ID',
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
        description: 'List recent transfers with optional limit',
        input_schema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of transfers to retrieve (default 20)' }
          }
        }
      },
      {
        name: 'calculate_commission',
        description: 'Calculate SlickPay commission for a given amount',
        input_schema: {
          type: 'object',
          properties: {
            amount: { type: 'number', description: 'Amount in DZD' }
          },
          required: ['amount']
        }
      },
      {
        name: 'create_invoice',
        description: 'Create a payment invoice for a customer',
        input_schema: {
          type: 'object',
          properties: {
            amount: { type: 'number', description: 'Invoice amount in DZD' },
            description: { type: 'string', description: 'Invoice description' },
            customerEmail: { type: 'string', description: 'Customer email address' }
          },
          required: ['amount', 'description']
        }
      },
      {
        name: 'get_balance',
        description: 'Get current account balance',
        input_schema: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }

  /**
   * Get skill descriptions for system prompt
   */
  static getAvailableSkills() {
    return this.getToolDefinitions().map(tool => ({
      name: tool.name,
      description: tool.description
    }));
  }

  /**
   * Execute a tool by name
   */
  static async executeTool({ toolName, arguments: args, tenantId, slickpayKey }) {
    logger.info('Executing tool', { toolName, tenantId });

    try {
      // Map tool names to skill functions
      const toolMap = {
        'create_account': () => SlickPaySkills.createAccount({ ...args, slickpayKey }),
        'list_accounts': () => SlickPaySkills.listAccounts({ slickpayKey }),
        'create_transfer': () => SlickPaySkills.createTransfer({ ...args, slickpayKey }),
        'get_transfer_details': () => SlickPaySkills.getTransferDetails({ ...args, slickpayKey }),
        'list_transfers': () => SlickPaySkills.listTransfers({ ...args, slickpayKey }),
        'calculate_commission': () => SlickPaySkills.calculateCommission({ ...args, slickpayKey }),
        'create_invoice': () => SlickPaySkills.createInvoice({ ...args, slickpayKey }),
        'get_balance': () => SlickPaySkills.getBalance({ slickpayKey })
      };

      const toolFunction = toolMap[toolName];
      
      if (!toolFunction) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      const result = await toolFunction();
      
      logger.info('Tool executed successfully', { 
        toolName, 
        success: result.success,
        tenantId 
      });

      return result;

    } catch (error) {
      logger.error('Tool execution failed', {
        toolName,
        error: error.message,
        tenantId
      });

      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ToolExecutor;
