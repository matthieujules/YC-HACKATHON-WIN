const express = require('express');
const router = express.Router();
const db = require('../config/database');
const cryptoService = require('../services/crypto');
const locus = require('../integrations/locus');
const logger = require('../utils/logger');

// Payment method configuration
const PAYMENT_METHOD = process.env.PAYMENT_METHOD || 'locus'; // 'locus' or 'crypto'

// Safety limits
const MAX_TRANSACTION_AMOUNT = 0.10; // Maximum $0.10 USDC per transaction
const MIN_TRANSACTION_AMOUNT = 0.01; // Minimum $0.01 USDC per transaction

/**
 * Execute a crypto transaction
 * POST /api/transaction/execute
 */
router.post('/execute', async (req, res) => {
  try {
    const {
      sessionId,
      to_person_id,
      to_wallet,
      to_name,
      amount,
      from_wallet,
      verbal_confirmation,
      handshake_confirmed,
      confidence
    } = req.body;

    // Validation - we need either person_id OR wallet address
    if (!amount) {
      return res.status(400).json({
        error: 'amount is required'
      });
    }

    if (!to_wallet && !to_person_id) {
      return res.status(400).json({
        error: 'Either to_wallet or to_person_id is required'
      });
    }

    // Safety check: Maximum transaction amount
    if (amount > MAX_TRANSACTION_AMOUNT) {
      logger.warn(`Transaction blocked: Amount $${amount} exceeds maximum of $${MAX_TRANSACTION_AMOUNT}`);
      return res.status(400).json({
        error: `Transaction amount $${amount} exceeds maximum allowed amount of $${MAX_TRANSACTION_AMOUNT}`,
        maxAmount: MAX_TRANSACTION_AMOUNT,
        requestedAmount: amount
      });
    }

    // Safety check: Minimum transaction amount
    if (amount < MIN_TRANSACTION_AMOUNT) {
      logger.warn(`Transaction blocked: Amount $${amount} below minimum of $${MIN_TRANSACTION_AMOUNT}`);
      return res.status(400).json({
        error: `Transaction amount $${amount} is below minimum allowed amount of $${MIN_TRANSACTION_AMOUNT}`,
        minAmount: MIN_TRANSACTION_AMOUNT,
        requestedAmount: amount
      });
    }

    // Get recipient details directly from the request
    // Gemini has already verified the person via facial recognition
    const recipient = {
      name: to_name || 'Unknown',
      wallet_address: to_wallet
    };

    // Validate we have a wallet address
    if (!recipient.wallet_address) {
      return res.status(400).json({
        error: 'Recipient wallet address is required'
      });
    }

    logger.info(`Payment to ${recipient.name} at ${recipient.wallet_address}`);

    // Execute payment using configured method (Locus or Crypto)
    let txResult;
    let paymentMethod = PAYMENT_METHOD;
    let currency = 'USDC';

    logger.info(`Executing ${paymentMethod.toUpperCase()} transaction: ${amount} ${currency} to ${recipient.name} (${recipient.wallet_address})`);

    if (paymentMethod === 'locus') {
      // Use Locus payment (MCP)
      try {
        txResult = await locus.sendPayment(
          recipient.wallet_address,
          amount,
          {
            sessionId,
            recipientName: recipient.name,
            verbalConfirmation: verbal_confirmation,
            handshakeConfirmed: handshake_confirmed,
            faceConfidence: confidence
          }
        );
        logger.info('Locus payment successful');
      } catch (error) {
        logger.error('Locus payment failed:', error.message);
        // Fallback to crypto if Locus fails
        paymentMethod = 'crypto';
        currency = 'ETH';
        txResult = await cryptoService.sendTransaction(
          recipient.wallet_address,
          amount,
          {
            sessionId,
            recipient: recipient.name,
            verbalConfirmation: verbal_confirmation
          }
        );
      }
    } else {
      // Use Web3 ETH
      currency = 'ETH';
      txResult = await cryptoService.sendTransaction(
        recipient.wallet_address,
        amount,
        {
          sessionId,
          recipient: recipient.name,
          verbalConfirmation: verbal_confirmation
        }
      );
    }

    // Create transaction record (without database dependency)
    const transaction = {
      id: txResult.locusTransactionId || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tx_hash: txResult.txHash,
      created_at: new Date().toISOString(),
      session_id: sessionId,
      from_wallet: from_wallet || txResult.from || process.env.LOCUS_WALLET_ADDRESS,
      to_wallet: recipient.wallet_address,
      amount: amount,
      currency: currency,
      status: txResult.status || 'pending',
      face_confidence: confidence || 0,
      audio_transcript: verbal_confirmation || '',
      metadata: {
        recipientName: recipient.name,
        handshakeConfirmed: handshake_confirmed,
        blockNumber: txResult.blockNumber,
        gasUsed: txResult.gasUsed,
        paymentMethod: paymentMethod,
        locusTransactionId: txResult.locusTransactionId
      }
    };

    logger.info(`Transaction completed: ${transaction.id}, hash: ${transaction.tx_hash}`);

    res.status(201).json({
      success: true,
      paymentMethod: paymentMethod,
      transaction: {
        id: transaction.id,
        txHash: transaction.tx_hash,
        locusTransactionId: txResult.locusTransactionId,
        recipient: recipient.name,
        wallet: recipient.wallet_address,
        amount: amount,
        currency: currency,
        status: txResult.status || 'completed',
        createdAt: transaction.created_at
      },
      blockchain: txResult
    });
  } catch (error) {
    logger.error('Error executing transaction:', error);
    res.status(500).json({
      error: 'Failed to execute transaction',
      message: error.message
    });
  }
});

/**
 * Get transaction status
 * GET /api/transaction/:txHash
 */
router.get('/:txHash', async (req, res) => {
  try {
    const { txHash } = req.params;

    // Get from database
    const dbResult = await db.query(
      `SELECT t.*, p.name as recipient_name
       FROM transactions t
       LEFT JOIN people p ON t.to_person_id = p.id
       WHERE t.tx_hash = $1`,
      [txHash]
    );

    if (dbResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Transaction not found'
      });
    }

    const tx = dbResult.rows[0];

    // Get blockchain status
    const blockchainStatus = await cryptoService.getTransactionStatus(txHash);

    // Update database if status changed
    if (blockchainStatus.status !== tx.status) {
      await db.query(
        'UPDATE transactions SET status = $1, confirmed_at = NOW() WHERE tx_hash = $2',
        [blockchainStatus.status, txHash]
      );
    }

    res.json({
      success: true,
      transaction: {
        id: tx.id,
        txHash: tx.tx_hash,
        recipient: tx.recipient_name,
        wallet: tx.to_wallet,
        amount: parseFloat(tx.amount),
        currency: tx.currency,
        status: blockchainStatus.status,
        confirmations: blockchainStatus.confirmations,
        verbalConfirmation: tx.audio_transcript,
        confidence: parseFloat(tx.face_confidence),
        createdAt: tx.created_at,
        confirmedAt: tx.confirmed_at
      },
      blockchain: blockchainStatus
    });
  } catch (error) {
    logger.error('Error getting transaction status:', error);
    res.status(500).json({
      error: 'Failed to get transaction status',
      message: error.message
    });
  }
});

/**
 * Get transaction history
 * GET /api/transaction/history
 */
router.get('/history/all', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await db.query(
      `SELECT t.*, p.name as recipient_name
       FROM transactions t
       LEFT JOIN people p ON t.to_person_id = p.id
       ORDER BY t.created_at DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), parseInt(offset)]
    );

    const transactions = result.rows.map(tx => ({
      id: tx.id,
      txHash: tx.tx_hash,
      recipient: tx.recipient_name,
      wallet: tx.to_wallet,
      amount: parseFloat(tx.amount),
      currency: tx.currency,
      status: tx.status,
      confidence: parseFloat(tx.face_confidence),
      createdAt: tx.created_at,
      confirmedAt: tx.confirmed_at
    }));

    res.json({
      success: true,
      count: transactions.length,
      transactions
    });
  } catch (error) {
    logger.error('Error getting transaction history:', error);
    res.status(500).json({
      error: 'Failed to get transaction history',
      message: error.message
    });
  }
});

/**
 * Get network info
 * GET /api/transaction/network/info
 */
router.get('/network/info', async (req, res) => {
  try {
    const networkInfo = await cryptoService.getNetworkInfo();
    const gasPrice = await cryptoService.getGasPrice();

    res.json({
      success: true,
      network: networkInfo,
      gasPrice: gasPrice
    });
  } catch (error) {
    logger.error('Error getting network info:', error);
    res.status(500).json({
      error: 'Failed to get network info',
      message: error.message
    });
  }
});

/**
 * Estimate transaction cost
 * POST /api/transaction/estimate
 */
router.post('/estimate', async (req, res) => {
  try {
    const { to_wallet, amount } = req.body;

    if (!to_wallet || !amount) {
      return res.status(400).json({
        error: 'to_wallet and amount are required'
      });
    }

    const estimate = await cryptoService.estimateTransactionCost(to_wallet, amount);

    res.json({
      success: true,
      estimate
    });
  } catch (error) {
    logger.error('Error estimating transaction:', error);
    res.status(500).json({
      error: 'Failed to estimate transaction',
      message: error.message
    });
  }
});

module.exports = router;
