/**
 * Test Locus MCP Payment - $0.01 USDC
 */

require('dotenv').config();
const LocusMCPClient = require('./src/integrations/locus/mcpClient_simple');

async function testPayment() {
  console.log('🧪 Testing Locus MCP payment...\n');

  const recipientAddress = '0x47599eacf8cbb84eacda971c7da01d8623efe57e';
  const amount = 0.01; // $0.01 USDC

  console.log('Payment Details:');
  console.log('  To:', recipientAddress);
  console.log('  Amount:', amount, 'USDC');
  console.log('  Network: Base Mainnet');
  console.log('  Method: Locus MCP\n');

  try {
    console.log('Initializing Locus MCP client...');
    const locus = new LocusMCPClient({
      clientId: process.env.LOCUS_CLIENT_ID,
      clientSecret: process.env.LOCUS_CLIENT_SECRET
    });

    console.log('Connecting to Locus MCP server...');
    await locus.initialize();
    console.log('✅ Connected to Locus MCP\n');

    console.log('Sending payment...');
    const result = await locus.sendToAddress(
      recipientAddress,
      amount,
      'Test payment - $0.01 USDC via Locus MCP'
    );

    console.log('\n✅ Payment successful!');
    console.log('\nTransaction Details:');
    console.log('  Transaction ID:', result.transactionId);
    console.log('  TX Hash:', result.txHash);
    console.log('  Status:', result.status);
    console.log('  Amount:', result.amount, 'USDC');
    console.log('  Recipient:', result.recipient);
    console.log('  Timestamp:', result.timestamp);
    console.log('\nFull Result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('\n❌ Payment failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testPayment();
