/**
 * Locus Payment Integration Module
 *
 * Standalone module for integrating with Locus payment API.
 * Supports USDC payments on Base blockchain (Mainnet & Sepolia Testnet).
 *
 * Authentication: API Key
 * Documentation: https://docs.locus.sh/
 * Dashboard: https://app.paywithlocus.com/
 */

const axios = require('axios');
const logger = require('../../utils/logger');
const LocusMCPClient = require('./mcpClient_simple');

class LocusPaymentClient {
  constructor(config = {}) {
    // Configuration with defaults
    this.apiKey = config.apiKey || process.env.LOCUS_API_KEY;
    this.baseUrl = config.baseUrl || process.env.LOCUS_API_URL || 'https://api.paywithlocus.com';
    this.walletAddress = config.walletAddress || process.env.LOCUS_WALLET_ADDRESS;
    this.environment = config.environment || process.env.LOCUS_ENVIRONMENT || 'testnet';
    this.network = config.network || process.env.LOCUS_NETWORK || 'base-sepolia';

    // Initialize MCP client for tool-based payments
    this.mcpClient = new LocusMCPClient(config);
    this.useMCP = true; // Use MCP by default

    // Validate configuration
    if (!this.apiKey) {
      logger.warn('Locus API key not configured - payment functions will not work');
    }

    logger.info(`Locus Payment Client initialized [${this.environment}] on ${this.network}`);
    logger.info(`Locus Wallet: ${this.walletAddress}`);
    logger.info(`Locus Mode: MCP (Model Context Protocol)`);
  }

  /**
   * Make authenticated request to Locus API
   * @private
   */
  async _request(method, endpoint, data = null) {
    if (!this.apiKey) {
      throw new Error('Locus API key not configured');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'X-Locus-Environment': this.environment
    };

    try {
      logger.debug(`Locus API Request: ${method} ${url}`);

      const response = await axios({
        method,
        url,
        headers,
        data,
        timeout: 30000 // 30 second timeout
      });

      logger.debug(`Locus API Response: ${response.status}`);
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  /**
   * Handle API errors
   * @private
   */
  _handleError(error) {
    if (error.response) {
      // API returned error response
      const status = error.response.status;
      const message = error.response.data?.message || error.response.statusText;

      logger.error(`Locus API Error [${status}]: ${message}`, {
        endpoint: error.config?.url,
        data: error.response.data
      });

      // Throw specific error based on status
      if (status === 401) {
        throw new Error('Locus authentication failed - check API key');
      } else if (status === 403) {
        throw new Error('Locus authorization failed - check policy group permissions');
      } else if (status === 429) {
        throw new Error('Locus rate limit exceeded - try again later');
      } else if (status >= 500) {
        throw new Error(`Locus server error: ${message}`);
      } else {
        throw new Error(`Locus API error: ${message}`);
      }
    } else if (error.request) {
      // Request made but no response
      logger.error('Locus API: No response received', { error: error.message });
      throw new Error('Locus API unavailable - no response received');
    } else {
      // Error setting up request
      logger.error('Locus API: Request setup error', { error: error.message });
      throw error;
    }
  }

  /**
   * Send payment to a wallet address
   * @param {string} recipientWallet - Recipient's wallet address (0x...)
   * @param {number|string} amount - Amount in USDC
   * @param {Object} metadata - Optional metadata (sessionId, recipient name, etc.)
   * @returns {Promise<Object>} Payment response with transaction details
   */
  async sendPayment(recipientWallet, amount, metadata = {}) {
    logger.info(`Locus: Sending ${amount} USDC to ${recipientWallet}`);

    // Validate inputs
    if (!recipientWallet || !recipientWallet.startsWith('0x')) {
      throw new Error('Invalid recipient wallet address');
    }

    if (!amount || parseFloat(amount) <= 0) {
      throw new Error('Invalid payment amount');
    }

    // Use MCP client (recommended approach)
    if (this.useMCP) {
      try {
        const memo = metadata.recipientName || metadata.memo || 'Payment via Locus';
        const result = await this.mcpClient.sendToAddress(recipientWallet, amount, memo);

        logger.info(`Locus MCP: Payment initiated`, {
          transactionId: result.transactionId,
          txHash: result.txHash
        });

        return {
          success: true,
          locusTransactionId: result.transactionId,
          txHash: result.txHash,
          status: result.status || 'pending',
          amount: amount,
          recipient: recipientWallet,
          timestamp: new Date().toISOString(),
          method: 'mcp',
          ...result
        };
      } catch (error) {
        logger.error('Locus MCP payment failed:', error.message);
        throw new Error(`Locus MCP payment failed: ${error.message}`);
      }
    }

    // Legacy REST API approach (kept for fallback, but likely won't work)
    const payload = {
      address: recipientWallet,
      amount: parseFloat(amount),
      memo: metadata.recipientName || metadata.memo || 'Payment via Locus'
    };

    const endpointsToTry = [
      '/api/payments/send-to-address',
      '/api/send-to-address',
      '/api/payments'
    ];

    let lastError;

    for (const endpoint of endpointsToTry) {
      try {
        const response = await this._request('POST', endpoint, payload);
        return {
          success: true,
          locusTransactionId: response.id || response.transactionId,
          txHash: response.tx_hash || response.transactionHash,
          status: response.status || 'pending',
          amount: amount,
          recipient: recipientWallet,
          timestamp: new Date().toISOString(),
          method: 'rest',
          ...response
        };
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(`Locus payment failed: ${lastError?.message}`);
  }

  /**
   * Get payment status by Locus transaction ID
   * @param {string} transactionId - Locus transaction ID
   * @returns {Promise<Object>} Payment status details
   */
  async getPaymentStatus(transactionId) {
    logger.debug(`Locus: Fetching payment status for ${transactionId}`);

    try {
      const response = await this._request('GET', `/v1/payments/${transactionId}`);

      return {
        transactionId: response.id,
        status: response.status,
        txHash: response.tx_hash || response.transaction_hash,
        amount: response.amount,
        currency: response.currency,
        recipient: response.to_wallet,
        confirmations: response.confirmations,
        createdAt: response.created_at,
        confirmedAt: response.confirmed_at,
        ...response
      };
    } catch (error) {
      logger.error('Locus: Failed to get payment status', { error: error.message });
      throw error;
    }
  }

  /**
   * Get wallet balance
   * @returns {Promise<Object>} Wallet balance information
   */
  async getWalletBalance() {
    logger.debug('Locus: Fetching wallet balance');

    try {
      const response = await this._request('GET', '/v1/wallet/balance');

      return {
        balance: response.balance,
        currency: response.currency || 'USDC',
        wallet: response.wallet_address || this.walletAddress,
        network: response.network || this.network,
        ...response
      };
    } catch (error) {
      logger.error('Locus: Failed to get wallet balance', { error: error.message });
      throw error;
    }
  }

  /**
   * Get transaction history
   * @param {Object} options - Query options (limit, offset, status)
   * @returns {Promise<Array>} List of transactions
   */
  async getTransactionHistory(options = {}) {
    const { limit = 50, offset = 0, status } = options;

    logger.debug('Locus: Fetching transaction history');

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      ...(status && { status })
    });

    try {
      const response = await this._request('GET', `/v1/transactions?${params}`);

      return {
        transactions: response.data || response.transactions || [],
        total: response.total || response.count,
        ...response
      };
    } catch (error) {
      logger.error('Locus: Failed to get transaction history', { error: error.message });
      throw error;
    }
  }

  /**
   * Validate wallet address format
   * @param {string} address - Wallet address to validate
   * @returns {boolean} True if valid
   */
  isValidWalletAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Health check - verify API connectivity and authentication
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    logger.debug('Locus: Performing health check');

    try {
      // Try to fetch wallet balance as a health check
      await this.getWalletBalance();

      return {
        status: 'healthy',
        authenticated: true,
        environment: this.environment,
        network: this.network,
        wallet: this.walletAddress
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        authenticated: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
const locusClient = new LocusPaymentClient();

module.exports = {
  LocusPaymentClient,
  locusClient,
  // Convenience exports
  sendPayment: (...args) => locusClient.sendPayment(...args),
  getPaymentStatus: (...args) => locusClient.getPaymentStatus(...args),
  getWalletBalance: () => locusClient.getWalletBalance(),
  getTransactionHistory: (...args) => locusClient.getTransactionHistory(...args),
  healthCheck: () => locusClient.healthCheck()
};
