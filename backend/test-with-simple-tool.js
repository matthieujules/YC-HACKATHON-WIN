require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const logger = require('./src/utils/logger');

async function testWithSimpleTool() {
  logger.info('=== Testing Live API WITH Simple Tool ===');

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Very simple tool definition from documentation
    const simpleTools = [{
      functionDeclarations: [{
        name: "test_function",
        description: "A simple test function"
      }]
    }];

    logger.info('Connecting with simple tool...');

    const liveSession = await ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      config: {
        responseModalities: ['AUDIO'],
        tools: simpleTools
      },
      callbacks: {
        onopen: () => logger.info('✅ Opened'),
        onmessage: (msg) => {
          logger.info('📨 Message type:', Object.keys(msg)[0]);
          if (msg.toolCall) logger.info('Tool call received!', msg.toolCall);
        },
        onerror: (err) => logger.error('❌ Error:', err),
        onclose: (e) => logger.info(`🔌 Closed - Code: ${e?.code}, Reason: ${e?.reason}`)
      }
    });

    logger.info('Connected! Waiting...');
    await new Promise(r => setTimeout(r, 5000));

    liveSession.close();
    logger.info('✅ Test completed');
    process.exit(0);

  } catch (error) {
    logger.error('❌ Failed:', error);
    logger.error(error.stack);
    process.exit(1);
  }
}

testWithSimpleTool();
