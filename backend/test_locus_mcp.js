/**
 * Test script to find the correct Locus MCP server URL
 */

const axios = require('axios');

const LOCUS_CLIENT_ID = '736dhf41srbi40ldbkgo0i16o5';
const LOCUS_CLIENT_SECRET = '19de7rjrgt8nmb29qrhc673e319gl4u46hioirf40dqcusj8cnlj';

// Possible Locus MCP server URLs
const possibleUrls = [
  'https://mcp.paywithlocus.com',
  'https://app.paywithlocus.com/mcp',
  'https://api.paywithlocus.com/mcp',
  'https://app.paywithlocus.com/api/mcp',
  'https://mcp.locus.sh',
  'https://paywithlocus.com/mcp'
];

async function testMcpUrl(url) {
  try {
    console.log(`\nTesting: ${url}`);
    
    // Try to connect to MCP endpoint
    const response = await axios.get(url, {
      timeout: 5000,
      validateStatus: () => true // Don't throw on non-2xx status
    });
    
    console.log(`  Status: ${response.status}`);
    console.log(`  Response:`, response.data);
    return { url, status: response.status, success: true };
  } catch (error) {
    if (error.code === 'ENOTFOUND') {
      console.log(`  ❌ DNS not found`);
    } else if (error.code === 'ETIMEDOUT') {
      console.log(`  ❌ Connection timeout`);
    } else {
      console.log(`  ❌ Error: ${error.message}`);
    }
    return { url, error: error.message, success: false };
  }
}

async function main() {
  console.log('🔍 Searching for Locus MCP server endpoint...\n');
  console.log(`Using Client ID: ${LOCUS_CLIENT_ID.substring(0, 10)}...`);
  
  const results = [];
  
  for (const url of possibleUrls) {
    const result = await testMcpUrl(url);
    results.push(result);
  }
  
  console.log('\n\n📊 Results:');
  console.log('='.repeat(60));
  
  const working = results.filter(r => r.success && r.status < 500);
  if (working.length > 0) {
    console.log('\n✅ Possible working endpoints:');
    working.forEach(r => console.log(`  - ${r.url} (Status: ${r.status})`));
  } else {
    console.log('\n❌ No working endpoints found');
    console.log('\n💡 Solution: Contact Locus support or check their documentation');
    console.log('   Email: founders@paywithlocus.com');
    console.log('   Or check your agent dashboard for MCP configuration');
  }
}

main().catch(console.error);
