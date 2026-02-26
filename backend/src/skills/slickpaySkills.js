// SlickPay Skills — Tools the AI agent can use
// All inputs are validated with Joi before touching the SlickPay API.
const Joi    = require('joi');
const SlickPayClient = require('../utils/slickpayClient');
const logger = require('../utils/logger');

// ── Validation schemas ────────────────────────────────────────────────────────
// Phone: international format, 9-15 digits, optional leading +
const phonePattern = /^\+?[0-9]{9,15}$/;

const schemas = {
  createAccount: Joi.object({
    firstName:   Joi.string().min(1).max(100).required(),
    lastName:    Joi.string().min(1).max(100).required(),
    phone:       Joi.string().pattern(phonePattern).required()
                    .messages({ 'string.pattern.base': 'Phone must be 9-15 digits in international format' }),
    slickpayKey: Joi.string().required()
  }),

  createTransfer: Joi.object({
    toPhone:     Joi.string().pattern(phonePattern).required()
                    .messages({ 'string.pattern.base': 'Phone must be 9-15 digits in international format' }),
    amount:      Joi.number().positive().max(10_000_000).required()
                    .messages({
                      'number.positive': 'Amount must be a positive number',
                      'number.max':      'Amount exceeds maximum allowed (10,000,000 DZD)'
                    }),
    description: Joi.string().max(200).optional(),
    slickpayKey: Joi.string().required()
  }),

  listTransfers: Joi.object({
    limit:       Joi.number().integer().min(1).max(100).default(20),
    slickpayKey: Joi.string().required()
  }),

  calculateCommission: Joi.object({
    amount:      Joi.number().positive().required(),
    slickpayKey: Joi.string().required()
  }),

  createInvoice: Joi.object({
    amount:        Joi.number().positive().required(),
    description:   Joi.string().min(1).max(500).required(),
    customerEmail: Joi.string().email().optional().allow('', null),
    slickpayKey:   Joi.string().required()
  }),

  getTransferDetails: Joi.object({
    transferId:  Joi.string().required(),
    slickpayKey: Joi.string().required()
  }),

  getBalance: Joi.object({
    slickpayKey: Joi.string().required()
  }),

  listAccounts: Joi.object({
    slickpayKey: Joi.string().required()
  })
};

/**
 * Validate params against a schema.
 * Returns { valid: true, value } or { valid: false, error: string }
 */
function validate(schema, params) {
  const { error, value } = schema.validate(params, { abortEarly: true });
  if (error) return { valid: false, error: `Validation error: ${error.message}` };
  return { valid: true, value };
}
// ─────────────────────────────────────────────────────────────────────────────

class SlickPaySkills {

  /**
   * Create a new account in SlickPay
   */
  static async createAccount(params) {
    const check = validate(schemas.createAccount, params);
    if (!check.valid) return { success: false, error: check.error };
    const { firstName, lastName, phone, slickpayKey } = check.value;

    const client = new SlickPayClient(slickpayKey);
    try {
      const response = await client.post('/api/v2/users/accounts', {
        first_name: firstName,
        last_name:  lastName,
        phone
      });

      logger.info('Account created', { accountId: response.data.id });
      return {
        success:   true,
        accountId: response.data.id,
        message:   `Account created successfully for ${firstName} ${lastName}`
      };
    } catch (error) {
      logger.error('Create account failed', { error: error.message });
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * List all accounts
   */
  static async listAccounts(params) {
    const check = validate(schemas.listAccounts, params);
    if (!check.valid) return { success: false, error: check.error };
    const { slickpayKey } = check.value;

    const client = new SlickPayClient(slickpayKey);
    try {
      const response = await client.get('/api/v2/users/accounts');
      return {
        success:  true,
        accounts: response.data.data || [],
        count:    response.data.data?.length || 0
      };
    } catch (error) {
      logger.error('List accounts failed', { error: error.message });
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Create a transfer (payment)
   */
  static async createTransfer(params) {
    const check = validate(schemas.createTransfer, params);
    if (!check.valid) return { success: false, error: check.error };
    const { toPhone, amount, description, slickpayKey } = check.value;

    const client = new SlickPayClient(slickpayKey);
    try {
      const response = await client.post('/api/v2/transfers', {
        to_phone:    toPhone,
        amount,
        description: description || 'Payment via ClickClawPay'
      });

      logger.info('Transfer created', {
        transferId: response.data.id,
        reference:  response.data.reference,
        amount,
        toPhone
      });

      return {
        success:    true,
        transferId: response.data.id,
        reference:  response.data.reference,
        amount:     response.data.amount,
        status:     response.data.status,
        message:    `Transfer of ${amount} DZD sent successfully to ${toPhone}`
      };
    } catch (error) {
      logger.error('Create transfer failed', { error: error.message });
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Get transfer details
   */
  static async getTransferDetails(params) {
    const check = validate(schemas.getTransferDetails, params);
    if (!check.valid) return { success: false, error: check.error };
    const { transferId, slickpayKey } = check.value;

    const client = new SlickPayClient(slickpayKey);
    try {
      const response = await client.get(`/api/v2/transfers/${transferId}`);
      return { success: true, transfer: response.data };
    } catch (error) {
      logger.error('Get transfer details failed', { error: error.message });
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * List recent transfers
   */
  static async listTransfers(params) {
    const check = validate(schemas.listTransfers, params);
    if (!check.valid) return { success: false, error: check.error };
    const { limit, slickpayKey } = check.value; // limit is clamped 1-100 by Joi

    const client = new SlickPayClient(slickpayKey);
    try {
      const response = await client.get('/api/v2/transfers', { params: { limit } });
      return {
        success:   true,
        transfers: response.data.data || [],
        count:     response.data.data?.length || 0
      };
    } catch (error) {
      logger.error('List transfers failed', { error: error.message });
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Calculate commission for a transfer
   */
  static async calculateCommission(params) {
    const check = validate(schemas.calculateCommission, params);
    if (!check.valid) return { success: false, error: check.error };
    const { amount, slickpayKey } = check.value;

    const client = new SlickPayClient(slickpayKey);
    try {
      const response = await client.get('/api/v2/commission', { params: { amount } });
      return {
        success:    true,
        commission: response.data.commission,
        total:      response.data.total,
        message:    `For ${amount} DZD, commission is ${response.data.commission} DZD (total: ${response.data.total} DZD)`
      };
    } catch (error) {
      logger.error('Calculate commission failed', { error: error.message });
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Create an invoice
   */
  static async createInvoice(params) {
    const check = validate(schemas.createInvoice, params);
    if (!check.valid) return { success: false, error: check.error };
    const { amount, description, customerEmail, slickpayKey } = check.value;

    const client = new SlickPayClient(slickpayKey);
    try {
      const response = await client.post('/api/v2/merchants/invoices', {
        amount,
        description,
        customer_email: customerEmail || undefined
      });

      logger.info('Invoice created', {
        invoiceId: response.data.id,
        amount
        // customerEmail intentionally not logged (PII)
      });

      return {
        success:    true,
        invoiceId:  response.data.id,
        invoiceUrl: response.data.url,
        message:    `Invoice created for ${amount} DZD. Payment link: ${response.data.url}`
      };
    } catch (error) {
      logger.error('Create invoice failed', { error: error.message });
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Get account balance
   */
  static async getBalance(params) {
    const check = validate(schemas.getBalance, params);
    if (!check.valid) return { success: false, error: check.error };
    const { slickpayKey } = check.value;

    const client = new SlickPayClient(slickpayKey);
    try {
      const response = await client.get('/api/v2/users/balance');
      const currency = response.data.currency || 'DZD';
      return {
        success:  true,
        balance:  response.data.balance,
        currency,
        message:  `Current balance: ${response.data.balance} ${currency}`
      };
    } catch (error) {
      logger.error('Get balance failed', { error: error.message });
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }
}

module.exports = SlickPaySkills;
