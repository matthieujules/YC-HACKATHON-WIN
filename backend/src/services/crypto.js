const { Web3 } = require('web3');
const logger = require('../utils/logger');

class CryptoService {
  constructor() {
    this.web3 = new Web3(process.env.WEB3_PROVIDER_URL || 'https://sepolia.infura.io/v3/your_key');
    this.walletPrivateKey = process.env.WALLET_PRIVATE_KEY;

    if (!this.walletPrivateKey || this.walletPrivateKey === 'your_wallet_private_key_for_signing') {
      logger.warn('Wallet private key not configured or invalid - Web3 transactions will not work (using Locus for payments)');
      this.account = null;
      return;
    }

    // Add wallet account if private key is available and valid
    try {
      this.account = this.web3.eth.accounts.privateKeyToAccount(this.walletPrivateKey);
      this.web3.eth.accounts.wallet.add(this.account);
      logger.info(`Web3 Wallet configured: ${this.account.address}`);
    } catch (error) {
      logger.warn(`Web3 wallet private key not configured or invalid - Web3 transactions will not work (using Locus for payments)`);
      this.account = null;
    }
  }

  /**
   * Get ETH balance for an address
   * @param {string} address - Wallet address
   * @returns {Promise<string>} Balance in ETH
   */
  async getBalance(address) {
    try {
      const balanceWei = await this.web3.eth.getBalance(address);
      const balanceEth = this.web3.utils.fromWei(balanceWei, 'ether');
      return balanceEth;
    } catch (error) {
      logger.error('Error getting balance:', error.message);
      throw error;
    }
  }

  /**
   * Send ETH transaction
   * @param {string} toAddress - Recipient address
   * @param {number} amountEth - Amount in ETH
   * @param {Object} metadata - Optional metadata
   * @returns {Promise<Object>} Transaction receipt
   */
  async sendTransaction(toAddress, amountEth, metadata = {}) {
    try {
      if (!this.account) {
        throw new Error('Wallet not configured');
      }

      // Validate address
      if (!this.web3.utils.isAddress(toAddress)) {
        throw new Error('Invalid recipient address');
      }

      // Convert amount to Wei
      const amountWei = this.web3.utils.toWei(amountEth.toString(), 'ether');

      // Check balance
      const balance = await this.web3.eth.getBalance(this.account.address);
      if (BigInt(balance) < BigInt(amountWei)) {
        throw new Error('Insufficient balance');
      }

      // Get current gas price
      const gasPrice = await this.web3.eth.getGasPrice();

      // Estimate gas
      const gasEstimate = await this.web3.eth.estimateGas({
        from: this.account.address,
        to: toAddress,
        value: amountWei
      });

      // Build transaction
      const tx = {
        from: this.account.address,
        to: toAddress,
        value: amountWei,
        gas: gasEstimate,
        gasPrice: gasPrice,
        // Optional: Add metadata as hex data
        data: metadata ? this.web3.utils.utf8ToHex(JSON.stringify(metadata)) : '0x'
      };

      logger.info(`Sending ${amountEth} ETH to ${toAddress}`);

      // Sign and send transaction
      const signedTx = await this.web3.eth.accounts.signTransaction(tx, this.walletPrivateKey);
      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);

      logger.info(`Transaction successful: ${receipt.transactionHash}`);

      return {
        success: true,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        from: receipt.from,
        to: receipt.to,
        amount: amountEth
      };
    } catch (error) {
      logger.error('Transaction error:', error.message);
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
        value: this.web3.utils.fromWei(tx.value, 'ether')
      };
    } catch (error) {
      logger.error('Error getting transaction status:', error.message);
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

  /**
   * Get current gas price in Gwei
   * @returns {Promise<string>}
   */
  async getGasPrice() {
    try {
      const gasPriceWei = await this.web3.eth.getGasPrice();
      const gasPriceGwei = this.web3.utils.fromWei(gasPriceWei, 'gwei');
      return gasPriceGwei;
    } catch (error) {
      logger.error('Error getting gas price:', error.message);
      throw error;
    }
  }

  /**
   * Estimate transaction cost
   * @param {string} toAddress - Recipient address
   * @param {number} amountEth - Amount in ETH
   * @returns {Promise<Object>} Cost estimate
   */
  async estimateTransactionCost(toAddress, amountEth) {
    try {
      const amountWei = this.web3.utils.toWei(amountEth.toString(), 'ether');

      const gasEstimate = await this.web3.eth.estimateGas({
        from: this.account?.address || '0x0000000000000000000000000000000000000000',
        to: toAddress,
        value: amountWei
      });

      const gasPrice = await this.web3.eth.getGasPrice();
      const gasCostWei = BigInt(gasEstimate) * BigInt(gasPrice);
      const gasCostEth = this.web3.utils.fromWei(gasCostWei.toString(), 'ether');

      return {
        gasEstimate: gasEstimate.toString(),
        gasPrice: this.web3.utils.fromWei(gasPrice, 'gwei'),
        gasCost: gasCostEth,
        totalCost: (parseFloat(amountEth) + parseFloat(gasCostEth)).toFixed(6)
      };
    } catch (error) {
      logger.error('Error estimating transaction cost:', error.message);
      throw error;
    }
  }

  /**
   * Get network information
   * @returns {Promise<Object>}
   */
  async getNetworkInfo() {
    try {
      const networkId = await this.web3.eth.net.getId();
      const blockNumber = await this.web3.eth.getBlockNumber();
      const gasPrice = await this.getGasPrice();

      const networks = {
        1: 'Mainnet',
        11155111: 'Sepolia',
        5: 'Goerli',
        137: 'Polygon',
        80001: 'Mumbai'
      };

      return {
        networkId: networkId.toString(),
        networkName: networks[networkId] || 'Unknown',
        blockNumber: blockNumber.toString(),
        gasPrice: gasPrice
      };
    } catch (error) {
      logger.error('Error getting network info:', error.message);
      throw error;
    }
  }
}

module.exports = new CryptoService();
