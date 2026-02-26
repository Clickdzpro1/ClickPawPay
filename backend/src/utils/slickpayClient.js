// SlickPay API Client
const axios = require('axios');
const logger = require('./logger');

class SlickPayClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = process.env.SLICKPAY_API_URL || 'https://api.slick-pay.com';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info('SlickPay API request', {
          method: config.method,
          url: config.url,
          data: config.data ? '***masked***' : undefined
        });
        return config;
      },
      (error) => {
        logger.error('SlickPay request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.info('SlickPay API response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error('SlickPay API error', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  async get(url, config = {}) {
    return this.client.get(url, config);
  }

  async post(url, data, config = {}) {
    return this.client.post(url, data, config);
  }

  async put(url, data, config = {}) {
    return this.client.put(url, data, config);
  }

  async delete(url, config = {}) {
    return this.client.delete(url, config);
  }
}

module.exports = SlickPayClient;
