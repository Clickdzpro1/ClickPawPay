// SlickPay API Client — with retry logic and safe logging
const axios  = require('axios');
const logger = require('./logger');

class SlickPayClient {
  constructor(apiKey) {
    this.apiKey  = apiKey;
    this.baseURL = process.env.SLICKPAY_API_URL || 'https://api.slick-pay.com';

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json'
      },
      timeout: 30000
    });

    // ── Request interceptor ────────────────────────────────────────────────
    // IMPORTANT: Never log config.headers — it contains the Bearer token.
    this.client.interceptors.request.use(
      (config) => {
        logger.info('SlickPay API request', {
          method:   config.method,
          url:      config.url,
          bodySize: config.data ? JSON.stringify(config.data).length : 0
          // headers intentionally omitted — contains Authorization: Bearer <key>
        });
        return config;
      },
      (error) => {
        logger.error('SlickPay request setup error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // ── Response interceptor ───────────────────────────────────────────────
    this.client.interceptors.response.use(
      (response) => {
        logger.info('SlickPay API response', {
          status: response.status,
          url:    response.config.url
        });
        return response;
      },
      (error) => {
        logger.error('SlickPay API error', {
          status:  error.response?.status,
          message: error.response?.data?.message || error.message,
          url:     error.config?.url
          // Do NOT log error.config.headers
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Retry a request function with exponential backoff.
   * Only retries on network errors and 5xx responses.
   * Does NOT retry 4xx errors (bad request, unauthorized — retrying won't help).
   *
   * @param {Function} fn          - Async function to retry
   * @param {number}   retries     - Max number of attempts (default 3)
   * @param {number}   baseDelayMs - Base delay in ms, doubles each attempt (default 300)
   */
  async withRetry(fn, retries = 3, baseDelayMs = 300) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const status = error.response?.status;
        // Only retry network errors or 5xx server errors
        const isRetryable = !status || status >= 500;

        if (!isRetryable || attempt === retries) {
          throw error;
        }

        const delay = baseDelayMs * Math.pow(2, attempt - 1); // 300, 600, 1200 ms
        logger.warn('SlickPay request failed, retrying', {
          attempt,
          maxRetries: retries,
          delayMs:    delay,
          error:      error.message
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async get(url, config = {}) {
    return this.withRetry(() => this.client.get(url, config));
  }

  async post(url, data, config = {}) {
    return this.withRetry(() => this.client.post(url, data, config));
  }

  async put(url, data, config = {}) {
    return this.withRetry(() => this.client.put(url, data, config));
  }

  async delete(url, config = {}) {
    return this.withRetry(() => this.client.delete(url, config));
  }
}

module.exports = SlickPayClient;
