require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const logger = require('./src/utils/logger');

async function testWithoutTools() {
  logger.info('=== Testing Live API WITHOUT Tools ===');

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    logger.info('Connecting WITHOUT tools/functions...');

    const liveSession = await ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      config: {
        responseModalities: ['AUDIO'],
        systemInstruction: 'You are a helpful assistant'
      },
      callbacks: {
        onopen: () => logger.info('✅ Opened'),
        onmessage: (msg) => logger.info('📨 Message:', JSON.stringify(msg).substring(0, 150)),
        onerror: (err) => logger.error('❌ Error:', err),
        onclose: (e) => logger.info(`🔌 Closed - Code: ${e?.code}, Reason: ${e?.reason}`)
      }
    });

    logger.info('Connected! Waiting 2s...');
    await new Promise(r => setTimeout(r, 2000));

    logger.info('Sending audio...');
    await liveSession.sendRealtimeInput({
      media: {
        data: Buffer.alloc(2048).toString('base64'),
        mimeType: 'audio/pcm;rate=16000'
      }
    });

    logger.info('Audio sent! Waiting 3s...');
    await new Promise(r => setTimeout(r, 3000));

    liveSession.close();
    logger.info('✅ Test passed - NO tools works fine!');
    process.exit(0);

  } catch (error) {
    logger.error('❌ Failed:', error);
    process.exit(1);
  }
}

testWithoutTools();
