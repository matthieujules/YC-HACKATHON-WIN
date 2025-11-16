/**
 * Test Locus MCP Integration
 *
 * This script tests the connection to Locus MCP server and available tools
 */

require('dotenv').config();
const LocusMCPClient = require('./src/integrations/locus/mcpClient');

async function testMCPIntegration() {
  console.log('='.repeat(60));
  console.log('Testing Locus MCP Integration');
  console.log('='.repeat(60));
  console.log('');

  // Check environment variables
  console.log('1. Checking configuration...');
  console.log(`   API Key: ${process.env.LOCUS_API_KEY ? '✓ Set' : '✗ Missing'}`);
  console.log(`   Client ID: ${process.env.LOCUS_CLIENT_ID ? '✓ Set' : '✗ Missing'}`);
  console.log(`   Client Secret: ${process.env.LOCUS_CLIENT_SECRET ? '✓ Set' : '✗ Missing'}`);
  console.log(`   Wallet: ${process.env.LOCUS_WALLET_ADDRESS || 'Not set'}`);
  console.log('');

  // Create client
  console.log('2. Initializing MCP client...');
  const client = new LocusMCPClient();
  console.log('   ✓ Client created');
  console.log('');

  try {
    // Test connection
    console.log('3. Connecting to Locus MCP server...');
    await client.connect();
    console.log('   ✓ Connected successfully!');
    console.log('');

    // List available tools
    console.log('4. Listing available tools...');
    const tools = await client.listTools();
    console.log(`   Found ${tools.length} tools:`);
    tools.forEach(tool => {
      console.log(`   - ${tool.name}`);
      if (tool.description) {
        console.log(`     ${tool.description}`);
      }
    });
    console.log('');

    // Test get_payment_context
    console.log('5. Testing get_payment_context...');
    try {
      const context = await client.getPaymentContext();
      console.log('   ✓ Payment context retrieved:');
      console.log(JSON.stringify(context, null, 2));
    } catch (error) {
      console.log(`   ✗ Failed: ${error.message}`);
    }
    console.log('');

    // Health check
    console.log('6. Running health check...');
    const health = await client.healthCheck();
    console.log(`   Status: ${health.status}`);
    console.log(`   Connected: ${health.connected}`);
    console.log(`   Tools Available: ${health.toolsAvailable}`);
    console.log('');

    console.log('='.repeat(60));
    console.log('✓ MCP Integration Test Complete!');
    console.log('='.repeat(60));

    // Disconnect
    await client.disconnect();

  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('✗ MCP Integration Test Failed');
    console.error('='.repeat(60));
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    console.error('Stack:', error.stack);
    console.error('');

    if (error.message.includes('authentication') || error.message.includes('401')) {
      console.error('💡 Tip: Check your LOCUS_CLIENT_ID and LOCUS_CLIENT_SECRET');
      console.error('   Get them from: https://app.paywithlocus.com/dashboard/agents');
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      console.error('💡 Tip: Check your LOCUS_MCP_URL');
      console.error('   The MCP server URL might be different from the default');
    } else if (error.message.includes('SSE') || error.message.includes('transport')) {
      console.error('💡 Tip: The MCP server might not support SSE transport');
      console.error('   You may need to contact Locus support for the correct connection method');
    }

    process.exit(1);
  }
}

// Run the test
testMCPIntegration()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
