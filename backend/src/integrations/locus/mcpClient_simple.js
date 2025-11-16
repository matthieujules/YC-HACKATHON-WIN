/**
 * Locus MCP Client - Simplified for Direct Tool Calling
 * Uses @locus-technologies/langchain-mcp-m2m
 */

const { MCPClientCredentials } = require('@locus-technologies/langchain-mcp-m2m');
const logger = require('../../utils/logger');

class LocusMCPClientSimple {
  constructor(config = {}) {
    this.clientId = config.clientId || process.env.LOCUS_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.LOCUS_CLIENT_SECRET;
    this.mcpServerUrl = 'https://mcp.paywithlocus.com/mcp';

    this.client = null;
    this.tools = null;
    this.isInitialized = false;

    logger.info('Locus MCP Client (Simple) initialized');
    logger.info(`MCP Server: ${this.mcpServerUrl}`);
  }

  /**
   * Initialize MCP connection and load tools
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    logger.info('Initializing Locus MCP connection...');

    try {
      // Create MCP client with OAuth credentials
      this.client = new MCPClientCredentials({
        mcpServers: {
          'locus': {
            url: this.mcpServerUrl,
            auth: {
              clientId: this.clientId,
              clientSecret: this.clientSecret
            }
          }
        }
      });

      // Initialize connections
      await this.client.initializeConnections();

      // Get tools
      this.tools = await this.client.getTools();

      this.isInitialized = true;

      logger.info(`Successfully connected to Locus MCP`);
      const toolNames = this.tools.map(t => t.name).join(', ');
      logger.info(`Available tools: ${toolNames}`);

    } catch (error) {
      logger.error('Failed to initialize Locus MCP:', error.message);
      throw new Error(`Locus MCP initialization failed: ${error.message}`);
    }
  }

  /**
   * Ensure initialized before calling tools
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Send USDC to wallet address using send_to_address tool
   */
  async sendToAddress(address, amount, memo = '') {
    await this.ensureInitialized();

    logger.info(`Locus MCP: Sending ${amount} USDC to ${address}`);

    try {
      // Find send_to_address tool
      const sendTool = this.tools.find(t => t.name === 'send_to_address');
      if (!sendTool) {
        throw new Error('send_to_address tool not found');
      }

      // Invoke the tool directly
      const result = await sendTool.invoke({
        address: address,
        amount: parseFloat(amount),
        memo: memo || 'Payment via Locus'
      });

      logger.info(`Locus MCP: Payment sent successfully`);
      logger.debug(`Result:`, result);

      // Parse result (LangChain tools return text)
      const response = this._parseToolResult(result);

      return {
        success: true,
        transactionId: response.transactionId || response.transaction_id || response.id,
        txHash: response.txHash || response.tx_hash || response.transactionHash,
        status: response.status || 'pending',
        amount: amount,
        recipient: address,
        timestamp: new Date().toISOString(),
        raw: result
      };

    } catch (error) {
      logger.error('Locus MCP send_to_address failed:', error.message);
      throw error;
    }
  }

  /**
   * Get payment context (balance, budget, contacts)
   */
  async getPaymentContext() {
    await this.ensureInitialized();

    logger.info('Locus MCP: Getting payment context...');

    try {
      const contextTool = this.tools.find(t => t.name === 'get_payment_context');
      if (!contextTool) {
        throw new Error('get_payment_context tool not found');
      }

      const result = await contextTool.invoke({});

      logger.info('Locus MCP: Payment context retrieved');

      return {
        success: true,
        context: result,
        raw: result
      };

    } catch (error) {
      logger.error('Locus MCP get_payment_context failed:', error.message);
      throw error;
    }
  }

  /**
   * Parse tool result (handles text and JSON responses)
   */
  _parseToolResult(result) {
    // If result is already an object
    if (typeof result === 'object' && result !== null) {
      return result;
    }

    // If result is a string, try to parse as JSON
    if (typeof result === 'string') {
      try {
        return JSON.parse(result);
      } catch (e) {
        // Return as raw text if not JSON
        return { raw: result };
      }
    }

    return { raw: result };
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await this.ensureInitialized();

      return {
        status: 'healthy',
        initialized: this.isInitialized,
        toolsAvailable: this.tools ? this.tools.length : 0,
        tools: this.tools ? this.tools.map(t => t.name) : []
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        initialized: false,
        error: error.message
      };
    }
  }
}

module.exports = LocusMCPClientSimple;
