const express = require('express');
const router = express.Router();
const db = require('../config/database');
const cryptoService = require('../services/crypto');
const logger = require('../utils/logger');

/**
 * Execute a crypto transaction
 * POST /api/transaction/execute
 */
router.post('/execute', async (req, res) => {
  try {
    const {
      sessionId,
      to_person_id,
      amount,
      from_wallet,
      verbal_confirmation,
      handshake_confirmed,
      confidence
    } = req.body;

    // Validation
    if (!to_person_id || !amount) {
      return res.status(400).json({
        error: 'to_person_id and amount are required'
      });
    }

    // Get recipient details
    const personResult = await db.query(
      'SELECT name, wallet_address FROM people WHERE id = $1',
      [to_person_id]
    );

    if (personResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Recipient not found'
      });
    }

    const recipient = personResult.rows[0];

    // Execute crypto transaction
    logger.info(`Executing transaction: ${amount} ETH to ${recipient.name} (${recipient.wallet_address})`);

    const txResult = await cryptoService.sendTransaction(
      recipient.wallet_address,
      amount,
      {
        sessionId,
        recipient: recipient.name,
        verbalConfirmation: verbal_confirmation
      }
    );

    // Store transaction in database
    const dbResult = await db.query(
      `INSERT INTO transactions (
        session_id, from_wallet, to_person_id, to_wallet,
        amount, currency, tx_hash, status,
        face_confidence, audio_transcript, handshake_timestamp,
        metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, NOW())
      RETURNING id, tx_hash, created_at`,
      [
        sessionId,
        from_wallet || txResult.from,
        to_person_id,
        recipient.wallet_address,
        amount,
        'ETH',
        txResult.txHash,
        'pending',
        confidence || 0,
        verbal_confirmation || '',
        JSON.stringify({
          handshakeConfirmed: handshake_confirmed,
          blockNumber: txResult.blockNumber,
          gasUsed: txResult.gasUsed
        })
      ]
    );

    const transaction = dbResult.rows[0];

    logger.info(`Transaction stored: ${transaction.id}, hash: ${transaction.tx_hash}`);

    res.status(201).json({
      success: true,
      transaction: {
        id: transaction.id,
        txHash: transaction.tx_hash,
        recipient: recipient.name,
        wallet: recipient.wallet_address,
        amount: amount,
        status: 'pending',
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
