// SlickPay Skills - Tools the AI agent can use
const SlickPayClient = require('../utils/slickpayClient');
const logger = require('../utils/logger');

class SlickPaySkills {
  
  /**
   * Create a new account in SlickPay
   */
  static async createAccount({ firstName, lastName, phone, slickpayKey }) {
    const client = new SlickPayClient(slickpayKey);
    
    try {
      const response = await client.post('/api/v2/users/accounts', {
        first_name: firstName,
        last_name: lastName,
        phone: phone
      });
      
      return {
        success: true,
        accountId: response.data.id,
        message: `Account created successfully for ${firstName} ${lastName}`
      };
    } catch (error) {
      logger.error('Create account failed', { error: error.message });
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * List all accounts
   */
  static async listAccounts({ slickpayKey }) {
    const client = new SlickPayClient(slickpayKey);
    
    try {
      const response = await client.get('/api/v2/users/accounts');
      
      return {
        success: true,
        accounts: response.data.data || [],
        count: response.data.data?.length || 0
      };
    } catch (error) {
      logger.error('List accounts failed', { error: error.message });
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Create a transfer (payment)
   */
  static async createTransfer({ toPhone, amount, description, slickpayKey }) {
    const client = new SlickPayClient(slickpayKey);
    
    try {
      const response = await client.post('/api/v2/transfers', {
        to_phone: toPhone,
        amount: amount,
        description: description || 'Payment via ClickClawPay'
      });
      
      return {
        success: true,
        transferId: response.data.id,
        reference: response.data.reference,
        amount: response.data.amount,
        status: response.data.status,
        message: `Transfer of ${amount} DZD sent successfully to ${toPhone}`
      };
    } catch (error) {
      logger.error('Create transfer failed', { error: error.message });
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Get transfer details
   */
  static async getTransferDetails({ transferId, slickpayKey }) {
    const client = new SlickPayClient(slickpayKey);
    
    try {
      const response = await client.get(`/api/v2/transfers/${transferId}`);
      
      return {
        success: true,
        transfer: response.data
      };
    } catch (error) {
      logger.error('Get transfer details failed', { error: error.message });
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * List recent transfers
   */
  static async listTransfers({ limit = 20, slickpayKey }) {
    const client = new SlickPayClient(slickpayKey);
    
    try {
      const response = await client.get('/api/v2/transfers', {
        params: { limit }
      });
      
      return {
        success: true,
        transfers: response.data.data || [],
        count: response.data.data?.length || 0
      };
    } catch (error) {
      logger.error('List transfers failed', { error: error.message });
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Calculate commission for a transfer
   */
  static async calculateCommission({ amount, slickpayKey }) {
    const client = new SlickPayClient(slickpayKey);
    
    try {
      const response = await client.get('/api/v2/commission', {
        params: { amount }
      });
      
      return {
        success: true,
        commission: response.data.commission,
        total: response.data.total,
        message: `For ${amount} DZD, commission is ${response.data.commission} DZD (total: ${response.data.total} DZD)`
      };
    } catch (error) {
      logger.error('Calculate commission failed', { error: error.message });
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Create an invoice
   */
  static async createInvoice({ amount, description, customerEmail, slickpayKey }) {
    const client = new SlickPayClient(slickpayKey);
    
    try {
      const response = await client.post('/api/v2/merchants/invoices', {
        amount: amount,
        description: description,
        customer_email: customerEmail
      });
      
      return {
        success: true,
        invoiceId: response.data.id,
        invoiceUrl: response.data.url,
        message: `Invoice created for ${amount} DZD. Payment link: ${response.data.url}`
      };
    } catch (error) {
      logger.error('Create invoice failed', { error: error.message });
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Get account balance
   */
  static async getBalance({ slickpayKey }) {
    const client = new SlickPayClient(slickpayKey);
    
    try {
      const response = await client.get('/api/v2/users/balance');
      
      return {
        success: true,
        balance: response.data.balance,
        currency: response.data.currency || 'DZD',
        message: `Current balance: ${response.data.balance} ${response.data.currency || 'DZD'}`
      };
    } catch (error) {
      logger.error('Get balance failed', { error: error.message });
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }
}

module.exports = SlickPaySkills;
