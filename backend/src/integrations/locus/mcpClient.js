/**
 * Locus MCP Client - Proper Implementation
 *
 * Uses @modelcontextprotocol/sdk to connect to Locus MCP server
 * Supports both OAuth 2.0 and API Key authentication
 */

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js');
const axios = require('axios');
const logger = require('../../utils/logger');

class LocusMCPClient {
  constructor(config = {}) {
    this.clientId = config.clientId || process.env.LOCUS_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.LOCUS_CLIENT_SECRET;
    this.apiKey = config.apiKey || process.env.LOCUS_API_KEY;

    // Official Locus MCP server endpoint
    // Docs: https://docs.locus.sh/connecting-to-locus-mcp
    this.mcpServerUrl = config.mcpServerUrl || process.env.LOCUS_MCP_URL || 'https://mcp.paywithlocus.com/mcp';

    // AWS Cognito OAuth endpoints
    this.tokenUrl = config.tokenUrl || 'https://auth.paywithlocus.com/oauth2/token';

    this.client = null;
    this.accessToken = null;
    this.tokenExpiry = null;
    this.isConnected = false;

    logger.info('Locus MCP Client initialized');
  }

  /**
   * Get OAuth 2.0 access token using Client Credentials flow
   * @private
   */
  async getAccessToken() {
    // If we have a valid token, reuse it
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    logger.info('Fetching new OAuth access token from AWS Cognito...');

    try {
      const response = await axios.post(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'payment_context:read contact_payments:write address_payments:write email_payments:write x402:execute'
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000
        }
      );

      this.accessToken = response.data.access_token;
      // Expire 5 minutes before actual expiry to be safe
      this.tokenExpiry = Date.now() + ((response.data.expires_in - 300) * 1000);

      logger.info('OAuth token obtained successfully');
      return this.accessToken;
    } catch (error) {
      logger.error('OAuth token fetch failed:', error.response?.data || error.message);
      throw new Error(`Failed to authenticate with Locus: ${error.message}`);
    }
  }

  /**
   * Connect to Locus MCP server
   */
  async connect() {
    if (this.isConnected && this.client) {
      logger.debug('MCP client already connected');
      return;
    }

    logger.info('Connecting to Locus MCP server...');

    try {
      // Get authentication token (OAuth or API Key)
      let authToken;
      if (this.apiKey) {
        logger.info('Using API Key authentication');
        authToken = this.apiKey;
      } else if (this.clientId && this.clientSecret) {
        logger.info('Using OAuth 2.0 Client Credentials authentication');
        authToken = await this.getAccessToken();
      } else {
        throw new Error('No authentication credentials provided (API Key or OAuth)');
      }

      // Create SSE transport to Locus MCP server
      const transport = new SSEClientTransport(
        new URL(this.mcpServerUrl),
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Create MCP client
      this.client = new Client({
        name: 'rayban-payment-backend',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      // Connect to server
      await this.client.connect(transport);
      this.isConnected = true;

      logger.info('✓ Successfully connected to Locus MCP server');

      // List available tools
      const tools = await this.listTools();
      logger.info(`Available MCP tools: ${tools.map(t => t.name).join(', ')}`);

    } catch (error) {
      logger.error('Failed to connect to Locus MCP server:', error.message);
      throw new Error(`MCP connection failed: ${error.message}`);
    }
  }

  /**
   * Ensure client is connected
   * @private
   */
  async ensureConnected() {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  /**
   * List available tools from MCP server
   */
  async listTools() {
    await this.ensureConnected();

    try {
      const response = await this.client.listTools();
      return response.tools || [];
    } catch (error) {
      logger.error('Failed to list MCP tools:', error.message);
      throw error;
    }
  }

  /**
   * Call an MCP tool
   * @param {string} toolName - Name of the tool to call
   * @param {Object} params - Tool parameters
   * @returns {Promise<Object>}
   */
  async callTool(toolName, params) {
    await this.ensureConnected();

    logger.info(`Calling MCP tool: ${toolName}`, params);

    try {
      const response = await this.client.callTool({
        name: toolName,
        arguments: params
      });

      logger.info(`✓ MCP tool ${toolName} completed successfully`);
      return response.content;
    } catch (error) {
      logger.error(`MCP tool ${toolName} failed:`, error.message);
      throw error;
    }
  }

  /**
   * Get payment context (balance, budget status, contacts)
   * MCP Tool: get_payment_context
   * Required Scope: payment_context:read
   */
  async getPaymentContext() {
    logger.info('Getting payment context...');

    try {
      const result = await this.callTool('get_payment_context', {});

      // Parse the string response (it returns formatted text)
      return {
        success: true,
        context: result,
        raw: result
      };
    } catch (error) {
      logger.error('Failed to get payment context:', error.message);
      throw error;
    }
  }

  /**
   * Send USDC to a wallet address
   * MCP Tool: send_to_address
   * Required Scope: address_payments:write
   *
   * @param {string} address - Recipient wallet address (0x...)
   * @param {number} amount - Amount in USDC
   * @param {string} memo - Payment memo
   */
  async sendToAddress(address, amount, memo = '') {
    logger.info(`Sending ${amount} USDC to ${address}`);

    try {
      const result = await this.callTool('send_to_address', {
        address,
        amount: parseFloat(amount),
        memo: memo || 'Payment via Locus MCP'
      });

      // Parse response to extract transaction details
      const response = this._parseToolResponse(result);

      return {
        success: true,
        transactionId: response.transactionId || response.transaction_id || response.id,
        txHash: response.txHash || response.tx_hash || response.transactionHash,
        status: response.status || 'pending',
        amount: amount,
        recipient: address,
        timestamp: new Date().toISOString(),
        ...response
      };
    } catch (error) {
      logger.error('send_to_address failed:', error.message);
      throw error;
    }
  }

  /**
   * Send USDC to a whitelisted contact by contact number
   * MCP Tool: send_to_contact
   * Required Scope: contact_payments:write
   *
   * @param {number} contactNumber - Contact number from whitelisted contacts (1, 2, 3...)
   * @param {number} amount - Amount in USDC
   * @param {string} memo - Payment memo
   */
  async sendToContact(contactNumber, amount, memo = '') {
    logger.info(`Sending ${amount} USDC to contact #${contactNumber}`);

    try {
      const result = await this.callTool('send_to_contact', {
        contact_number: parseInt(contactNumber),
        amount: parseFloat(amount),
        memo: memo || 'Payment via Locus MCP'
      });

      const response = this._parseToolResponse(result);

      return {
        success: true,
        transactionId: response.transactionId || response.transaction_id,
        txHash: response.txHash || response.tx_hash,
        status: response.status || 'pending',
        contactNumber: contactNumber,
        amount: amount,
        timestamp: new Date().toISOString(),
        ...response
      };
    } catch (error) {
      logger.error('send_to_contact failed:', error.message);
      throw error;
    }
  }

  /**
   * Send USDC via email escrow
   * MCP Tool: send_to_email
   * Required Scope: email_payments:write
   *
   * @param {string} email - Recipient email address
   * @param {number} amount - Amount in USDC
   * @param {string} memo - Payment memo (optional)
   */
  async sendToEmail(email, amount, memo = '') {
    logger.info(`Sending ${amount} USDC to ${email} via escrow`);

    try {
      const result = await this.callTool('send_to_email', {
        email,
        amount: parseFloat(amount),
        memo: memo || 'Payment via Locus MCP'
      });

      const response = this._parseToolResponse(result);

      return {
        success: true,
        transactionId: response.transactionId || response.transaction_id,
        escrowId: response.escrowId || response.escrow_id,
        txHash: response.txHash || response.tx_hash,
        status: response.status || 'pending',
        email: email,
        amount: amount,
        timestamp: new Date().toISOString(),
        ...response
      };
    } catch (error) {
      logger.error('send_to_email failed:', error.message);
      throw error;
    }
  }

  /**
   * Parse tool response (handles both text and JSON responses)
   * @private
   */
  _parseToolResponse(result) {
    // If result is already an object, return it
    if (typeof result === 'object' && result !== null) {
      return result;
    }

    // If result is array (MCP content format)
    if (Array.isArray(result)) {
      // Find text content
      const textContent = result.find(item => item.type === 'text');
      if (textContent) {
        result = textContent.text;
      }
    }

    // Try to parse as JSON
    if (typeof result === 'string') {
      try {
        return JSON.parse(result);
      } catch (e) {
        // Return as-is if not JSON
        return { raw: result };
      }
    }

    return result;
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect() {
    if (this.client && this.isConnected) {
      logger.info('Disconnecting from Locus MCP server...');
      await this.client.close();
      this.isConnected = false;
      this.client = null;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await this.ensureConnected();
      const tools = await this.listTools();

      return {
        status: 'healthy',
        connected: this.isConnected,
        toolsAvailable: tools.length,
        tools: tools.map(t => t.name)
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message
      };
    }
  }
}

module.exports = LocusMCPClient;
