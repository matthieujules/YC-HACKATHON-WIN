/**
 * USDC Payment Service for Base Sepolia
 *
 * Sends USDC tokens on Base Sepolia testnet
 * Compatible with Locus wallet infrastructure
 */

const { Web3 } = require('web3');
const logger = require('../utils/logger');

// ERC-20 ABI (minimal - just what we need for transfers)
const ERC20_ABI = [
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "_to", "type": "address"},
      {"name": "_value", "type": "uint256"}
    ],
    "name": "transfer",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{"name": "", "type": "uint8"}],
    "type": "function"
  }
];

// Network configurations
const NETWORKS = {
  'base-sepolia': {
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    usdcContract: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
    explorer: 'https://sepolia.basescan.org'
  },
  'base-mainnet': {
    name: 'Base Mainnet',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    usdcContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base Mainnet USDC
    explorer: 'https://basescan.org'
  }
};

class USDCPaymentService {
  constructor() {
    // Get network from env (default to Base Sepolia testnet)
    this.network = process.env.BASE_NETWORK || 'base-sepolia';
    const networkConfig = NETWORKS[this.network];

    // Initialize Web3 with Base network
    this.web3 = new Web3(networkConfig.rpcUrl);
    this.walletPrivateKey = process.env.LOCUS_WALLET_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY;
    this.usdcContract = networkConfig.usdcContract;
    this.networkConfig = networkConfig;

    // Validate private key
    const isValidKey = this.walletPrivateKey &&
                       this.walletPrivateKey.startsWith('0x') &&
                       this.walletPrivateKey.length === 66;

    if (!isValidKey) {
      logger.warn('USDC wallet private key not configured - USDC payments will not work');
      this.wallet= null;
      this.account = null;
      return;
    }

    // Initialize wallet
    try {
      this.account = this.web3.eth.accounts.privateKeyToAccount(this.walletPrivateKey);
      this.web3.eth.accounts.wallet.add(this.account);

      // Initialize USDC contract
      this.usdc = new this.web3.eth.Contract(ERC20_ABI, this.usdcContract);

      logger.info(`USDC Payment Service initialized`);
      logger.info(`Network: ${networkConfig.name} (Chain ID: ${networkConfig.chainId})`);
      logger.info(`Wallet: ${this.account.address}`);
      logger.info(`USDC Contract: ${this.usdcContract}`);
    } catch (error) {
      logger.error('Failed to initialize USDC service:', error.message);
      this.account = null;
    }
  }

  /**
   * Get USDC balance for an address
   * @param {string} address - Wallet address
   * @returns {Promise<string>} Balance in USDC
   */
  async getUSDCBalance(address) {
    try {
      const balance = await this.usdc.methods.balanceOf(address).call();
      // USDC has 6 decimals
      const balanceUSDC = parseFloat(balance) / 1000000;
      return balanceUSDC.toString();
    } catch (error) {
      logger.error('Error getting USDC balance:', error.message);
      throw error;
    }
  }

  /**
   * Send USDC to recipient
   * @param {string} toAddress - Recipient address
   * @param {number} amountUSDC - Amount in USDC
   * @param {Object} metadata - Optional metadata
   * @returns {Promise<Object>} Transaction receipt
   */
  async sendUSDC(toAddress, amountUSDC, metadata = {}) {
    try {
      if (!this.account) {
        throw new Error('Wallet not configured');
      }

      // Validate address
      if (!this.web3.utils.isAddress(toAddress)) {
        throw new Error('Invalid recipient address');
      }

      // Convert USDC to smallest unit (6 decimals)
      const amountInSmallestUnit = Math.floor(parseFloat(amountUSDC) * 1000000);

      // Check balance
      const balance = await this.usdc.methods.balanceOf(this.account.address).call();
      if (BigInt(balance) < BigInt(amountInSmallestUnit)) {
        const balanceUSDC = parseFloat(balance) / 1000000;
        throw new Error(`Insufficient USDC balance. Have: ${balanceUSDC} USDC, Need: ${amountUSDC} USDC`);
      }

      logger.info(`Sending ${amountUSDC} USDC to ${toAddress}`);

      // Encode the transfer function call
      const transferData = this.usdc.methods.transfer(toAddress, amountInSmallestUnit).encodeABI();

      // Get current gas price
      const gasPrice = await this.web3.eth.getGasPrice();

      // Estimate gas
      const gasEstimate = await this.web3.eth.estimateGas({
        from: this.account.address,
        to: this.usdcContract,
        data: transferData
      });

      // Build transaction
      const tx = {
        from: this.account.address,
        to: this.usdcContract,
        data: transferData,
        gas: gasEstimate,
        gasPrice: gasPrice
      };

      // Sign and send transaction
      const signedTx = await this.web3.eth.accounts.signTransaction(tx, this.walletPrivateKey);
      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);

      logger.info(`USDC transaction successful: ${receipt.transactionHash}`);
      logger.info(`View on explorer: ${this.networkConfig.explorer}/tx/${receipt.transactionHash}`);

      return {
        success: true,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        from: receipt.from,
        to: toAddress,
        amount: amountUSDC,
        currency: 'USDC',
        network: this.network,
        explorer: `${this.networkConfig.explorer}/tx/${receipt.transactionHash}`
      };
    } catch (error) {
      logger.error('USDC transaction error:', error.message);
      throw error;
    }
  }

  /**
   * Get transaction status
   * @param {string} txHash - Transaction hash
   * @returns {Promise<Object>} Transaction details
   */
  async getTransactionStatus(txHash) {
    try {
      const tx = await this.web3.eth.getTransaction(txHash);
      const receipt = await this.web3.eth.getTransactionReceipt(txHash);

      if (!tx) {
        return { status: 'not_found' };
      }

      const currentBlock = await this.web3.eth.getBlockNumber();
      const confirmations = receipt ? currentBlock - receipt.blockNumber : 0;

      return {
        status: receipt ? (receipt.status ? 'confirmed' : 'failed') : 'pending',
        confirmations: confirmations.toString(),
        blockNumber: receipt?.blockNumber.toString(),
        gasUsed: receipt?.gasUsed.toString(),
        from: tx.from,
        to: tx.to,
        explorer: `${this.networkConfig.explorer}/tx/${txHash}`
      };
    } catch (error) {
      logger.error('Error getting transaction status:', error.message);
      throw error;
    }
  }

  /**
   * Get network information
   * @returns {Promise<Object>}
   */
  async getNetworkInfo() {
    try {
      const chainId = await this.web3.eth.getChainId();
      const blockNumber = await this.web3.eth.getBlockNumber();
      const gasPrice = await this.web3.eth.getGasPrice();

      return {
        networkId: chainId.toString(),
        networkName: this.networkConfig.name,
        blockNumber: blockNumber.toString(),
        gasPrice: this.web3.utils.fromWei(gasPrice, 'gwei'),
        usdcContract: this.usdcContract
      };
    } catch (error) {
      logger.error('Error getting network info:', error.message);
      throw error;
    }
  }

  /**
   * Validate wallet address
   * @param {string} address - Address to validate
   * @returns {boolean}
   */
  isValidAddress(address) {
    return this.web3.utils.isAddress(address);
  }
}

module.exports = new USDCPaymentService();
