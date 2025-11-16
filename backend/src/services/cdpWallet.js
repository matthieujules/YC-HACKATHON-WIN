/**
 * Coinbase Developer Platform (CDP) Wallet Service
 *
 * Provides wallet management and USDC transfers using CDP Server Wallets SDK
 * Features:
 * - Gasless USDC transfers on Base Mainnet (Coinbase pays gas!)
 * - Secure key management (no private key exposure)
 * - Perfect for hackathon: "Agentic Commerce via CDP Wallets"
 */

const { CdpClient } = require('@coinbase/cdp-sdk');
const logger = require('../utils/logger');

class CDPWalletService {
  constructor() {
    // CDP credentials from environment variables
    this.apiKeyId = process.env.CDP_API_KEY_ID;
    this.apiKeySecret = process.env.CDP_API_KEY_SECRET;
    this.walletSecret = process.env.CDP_WALLET_SECRET;
    this.walletName = process.env.CDP_WALLET_NAME || 'rayban-payments-wallet';
    this.network = process.env.BASE_NETWORK === 'base-mainnet' ? 'base-mainnet' : 'base-sepolia';

    // Validate credentials
    if (!this.apiKeyId || !this.apiKeySecret || !this.walletSecret) {
      logger.warn('CDP credentials not configured - CDP wallet functions will not work');
      logger.warn('Required env vars: CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET');
      this.cdpClient = null;
      this.wallet = null;
      return;
    }

    // Initialize CDP client
    try {
      this.cdpClient = new CdpClient({
        apiKeyId: this.apiKeyId,
        apiKeySecret: this.apiKeySecret,
        walletSecret: this.walletSecret
      });

      logger.info('CDP Wallet Service initialized');
      logger.info(`Network: ${this.network}`);
      logger.info(`Wallet Name: ${this.walletName}`);

      // Load or create wallet
      this.initializeWallet();
    } catch (error) {
      logger.error('Failed to initialize CDP client:', error.message);
      this.cdpClient = null;
      this.wallet = null;
    }
  }

  /**
   * Initialize or load existing wallet
   * @private
   */
  async initializeWallet() {
    try {
      // Try to load existing wallet by name
      const wallets = await this.cdpClient.evm.listWallets();
      this.wallet = wallets.find(w => w.name === this.walletName);

      if (!this.wallet) {
        // Create new wallet if it doesn't exist
        logger.info(`Creating new CDP wallet: ${this.walletName}`);
        const account = await this.cdpClient.evm.createAccount({
          name: this.walletName,
          network: this.network
        });
        this.wallet = account.wallet;
        logger.info(`CDP Wallet created: ${await this.getWalletAddress()}`);
      } else {
        logger.info(`CDP Wallet loaded: ${await this.getWalletAddress()}`);
      }
    } catch (error) {
      logger.error('Failed to initialize CDP wallet:', error.message);
      this.wallet = null;
    }
  }

  /**
   * Get wallet address
   * @returns {Promise<string>} Wallet address
   */
  async getWalletAddress() {
    if (!this.wallet) {
      throw new Error('CDP wallet not initialized');
    }
    const addresses = await this.wallet.getAddresses();
    return addresses[0].address;
  }

  /**
   * Get USDC balance
   * @returns {Promise<number>} Balance in USDC
   */
  async getUSDCBalance() {
    if (!this.wallet) {
      throw new Error('CDP wallet not initialized');
    }

    try {
      const balance = await this.wallet.getBalance('usdc');
      logger.info(`CDP Wallet USDC balance: ${balance}`);
      return parseFloat(balance);
    } catch (error) {
      logger.error('Failed to get USDC balance:', error.message);
      throw error;
    }
  }

  /**
   * Send USDC to recipient address
   * @param {string} toAddress - Recipient wallet address
   * @param {number} amountUSDC - Amount in USDC
   * @param {Object} metadata - Optional metadata (sessionId, recipient name, etc.)
   * @returns {Promise<Object>} Transfer result
   */
  async sendUSDC(toAddress, amountUSDC, metadata = {}) {
    if (!this.wallet) {
      throw new Error('CDP wallet not initialized');
    }

    try {
      logger.info(`CDP: Sending ${amountUSDC} USDC to ${toAddress}`);

      // Validate address
      if (!toAddress || !toAddress.startsWith('0x')) {
        throw new Error('Invalid recipient address');
      }

      // Check balance
      const balance = await this.getUSDCBalance();
      if (balance < amountUSDC) {
        throw new Error(`Insufficient USDC balance. Have: ${balance} USDC, Need: ${amountUSDC} USDC`);
      }

      // Create transfer with gasless flag (Coinbase pays gas!)
      const transfer = await this.wallet.createTransfer({
        amount: amountUSDC,
        assetId: 'usdc',
        destination: toAddress,
        gasless: true, // FREE GAS on Base Mainnet!
        skipBatching: true // Immediate processing
      });

      // Wait for transfer to complete
      await transfer.wait();

      const status = transfer.getStatus();
      logger.info(`CDP Transfer ${status}: ${transfer.toString()}`);

      // Get transaction hash
      const txHash = transfer.getTransactionHash();
      const transactionLink = transfer.getTransactionLink();

      return {
        success: true,
        txHash: txHash,
        status: status,
        amount: amountUSDC,
        recipient: toAddress,
        from: await this.getWalletAddress(),
        currency: 'USDC',
        network: this.network,
        gasless: true,
        explorer: transactionLink,
        transferId: transfer.getId()
      };
    } catch (error) {
      logger.error('CDP USDC transfer failed:', error.message);
      throw error;
    }
  }

  /**
   * Get transfer status by ID
   * @param {string} transferId - Transfer ID
   * @returns {Promise<Object>} Transfer status
   */
  async getTransferStatus(transferId) {
    if (!this.wallet) {
      throw new Error('CDP wallet not initialized');
    }

    try {
      const transfer = await this.wallet.getTransfer(transferId);
      return {
        status: transfer.getStatus(),
        txHash: transfer.getTransactionHash(),
        link: transfer.getTransactionLink()
      };
    } catch (error) {
      logger.error('Failed to get transfer status:', error.message);
      throw error;
    }
  }

  /**
   * Request testnet USDC from faucet (Base Sepolia only)
   * @returns {Promise<Object>} Faucet transaction result
   */
  async requestTestnetUSDC() {
    if (this.network !== 'base-sepolia') {
      throw new Error('Faucet only available on Base Sepolia testnet');
    }

    if (!this.wallet) {
      throw new Error('CDP wallet not initialized');
    }

    try {
      logger.info('Requesting testnet USDC from faucet...');
      const faucetTx = await this.wallet.faucet('usdc');
      await faucetTx.wait();

      logger.info('Testnet USDC received!');
      return {
        success: true,
        txHash: faucetTx.getTransactionHash(),
        link: faucetTx.getTransactionLink()
      };
    } catch (error) {
      logger.error('Faucet request failed:', error.message);
      throw error;
    }
  }

  /**
   * Validate wallet address format
   * @param {string} address - Wallet address to validate
   * @returns {boolean} True if valid
   */
  isValidAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}

// Export singleton instance
module.exports = new CDPWalletService();
