# Locus Payment Integration

Standalone module for integrating Locus payment infrastructure into the Ray-Ban payment system.

## Overview

This module provides a clean interface to the Locus API for sending USDC payments on Base blockchain.

**Features:**
- ✅ API Key authentication
- ✅ Send USDC to wallet addresses
- ✅ Check payment status
- ✅ Get wallet balance
- ✅ Transaction history
- ✅ Comprehensive error handling
- ✅ Logging integration

## Installation

Already included in the project. No additional packages needed (uses `axios`).

## Configuration

All configuration is pulled from environment variables (`.env` file):

```bash
# Required
LOCUS_API_KEY=locus_dev_...
LOCUS_WALLET_ADDRESS=0x...

# Optional (with defaults)
LOCUS_API_URL=https://api.paywithlocus.com
LOCUS_ENVIRONMENT=testnet
LOCUS_NETWORK=base-sepolia
```

## Usage

### Basic Payment

```javascript
const locus = require('./integrations/locus');

// Send payment
const result = await locus.sendPayment(
  '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',  // recipient wallet
  10.50,                                           // amount in USDC
  {                                                // optional metadata
    sessionId: 'abc123',
    recipientName: 'Alice',
    faceConfidence: 0.95,
    handshakeDetected: true
  }
);

console.log(result.txHash);              // Blockchain transaction hash
console.log(result.locusTransactionId);  // Locus internal ID
```

### Check Payment Status

```javascript
const status = await locus.getPaymentStatus('locus_txn_123...');

console.log(status.status);        // 'pending', 'confirmed', 'failed'
console.log(status.confirmations); // Number of blockchain confirmations
```

### Get Wallet Balance

```javascript
const balance = await locus.getWalletBalance();

console.log(`Balance: ${balance.balance} ${balance.currency}`);
// Output: Balance: 100.00 USDC
```

### Transaction History

```javascript
const history = await locus.getTransactionHistory({
  limit: 10,
  offset: 0,
  status: 'confirmed'  // optional filter
});

history.transactions.forEach(tx => {
  console.log(`${tx.amount} USDC to ${tx.recipient}`);
});
```

### Health Check

```javascript
const health = await locus.healthCheck();

if (health.status === 'healthy') {
  console.log('Locus API is connected and authenticated');
} else {
  console.error('Locus API unavailable:', health.error);
}
```

## Advanced Usage

### Custom Client Instance

```javascript
const { LocusPaymentClient } = require('./integrations/locus');

const customClient = new LocusPaymentClient({
  apiKey: 'custom_key',
  baseUrl: 'https://custom.api.url',
  walletAddress: '0x...',
  environment: 'mainnet',
  network: 'base-mainnet'
});

await customClient.sendPayment('0x...', 25.00);
```

### Error Handling

```javascript
try {
  await locus.sendPayment('0x...', 100);
} catch (error) {
  if (error.message.includes('authentication failed')) {
    console.error('Invalid API key');
  } else if (error.message.includes('authorization failed')) {
    console.error('Policy group permissions issue');
  } else if (error.message.includes('rate limit')) {
    console.error('Too many requests - slow down');
  } else {
    console.error('Payment failed:', error.message);
  }
}
```

## API Response Format

### `sendPayment()` Response

```javascript
{
  success: true,
  locusTransactionId: 'locus_txn_abc123...',
  txHash: '0x...',                    // Blockchain transaction hash
  status: 'pending',                  // 'pending', 'confirmed', 'failed'
  amount: '10.50',
  recipient: '0x...',
  timestamp: '2025-11-15T12:00:00Z'
}
```

### `getPaymentStatus()` Response

```javascript
{
  transactionId: 'locus_txn_abc123...',
  status: 'confirmed',
  txHash: '0x...',
  amount: '10.50',
  currency: 'USDC',
  recipient: '0x...',
  confirmations: 12,
  createdAt: '2025-11-15T12:00:00Z',
  confirmedAt: '2025-11-15T12:05:00Z'
}
```

## Integration with Transaction Controller

See `src/controllers/transactionController.js` for how this module is integrated with the existing payment flow.

## Testing

### Test API Connection

```javascript
const health = await locus.healthCheck();
console.log(health);
```

### Test Small Payment (Testnet)

```javascript
const result = await locus.sendPayment(
  '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
  0.01,  // 0.01 USDC test payment
  { test: true }
);
```

## Troubleshooting

### "Locus API key not configured"
- Check that `LOCUS_API_KEY` is set in `.env`
- Verify the key starts with `locus_dev_` or `locus_prod_`

### "Locus authentication failed"
- Regenerate API key in Locus dashboard
- Check for extra spaces in `.env` file

### "Locus authorization failed"
- Check policy group permissions in dashboard
- Verify wallet is associated with policy group
- Ensure "send to wallet addresses" is enabled

### "Invalid recipient wallet address"
- Address must start with `0x`
- Must be 42 characters total (0x + 40 hex chars)

### "Locus API unavailable"
- Check internet connection
- Verify `LOCUS_API_URL` is correct
- Check Locus status page for outages

## Migration from Web3

If migrating from direct Web3 integration:

**Before (Web3):**
```javascript
const cryptoService = require('./services/crypto');
const result = await cryptoService.sendTransaction(wallet, amount, metadata);
```

**After (Locus):**
```javascript
const locus = require('./integrations/locus');
const result = await locus.sendPayment(wallet, amount, metadata);
```

## API Endpoints (Reference)

Based on implementation assumptions:

```
POST   /v1/payments              - Send payment
GET    /v1/payments/:id          - Get payment status
GET    /v1/wallet/balance        - Get wallet balance
GET    /v1/transactions          - Get transaction history
```

**Note:** Actual endpoints may differ. Update `index.js` if needed after testing.

## Security

- **Never commit** `.env` file with API keys
- **Use testnet** for development
- **Rotate API keys** regularly
- **Monitor** transaction history for unauthorized payments
- **Set policy limits** in Locus dashboard

## Support

- Locus Dashboard: https://app.paywithlocus.com/
- Locus Docs: https://docs.locus.sh/
- Issues: Contact Locus support or check dashboard

## License

Part of Ray-Ban Crypto Payments project (MIT License)
