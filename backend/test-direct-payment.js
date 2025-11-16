/**
 * Direct Locus MCP Payment Test
 * Sends USDC directly to an address without database lookup
 */

require('dotenv').config();
const LocusMCPClient = require('./src/integrations/locus/mcpClient_simple');

async function testDirectPayment() {
  console.log('🚀 Testing direct Locus MCP payment...\n');

  const recipientAddress = '0x47599eacf8cbb84eacda971c7da01d8623efe57e';
  const amount = 0.05; // $0.05 USDC

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

    await locus.initialize();
    console.log('✅ Locus MCP client initialized\n');

    console.log('Sending payment...');
    const result = await locus.sendToAddress(
      recipientAddress,
      amount,
      'Direct test payment via Locus MCP'
    );

    console.log('\n✅ Payment successful!');
    console.log('Result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('\n❌ Payment failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testDirectPayment();
