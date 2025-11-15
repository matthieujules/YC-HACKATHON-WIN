require('dotenv').config();
const { GoogleGenAI, Modality } = require('@google/genai');
const logger = require('./src/utils/logger');

async function testMinimal() {
  logger.info('=== Minimal Live API Test ===');

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    logger.info('Step 1: Connecting to Gemini Live API...');

    const liveSession = await ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      config: {
        responseModalities: ['AUDIO'],
      },
      callbacks: {
        onopen: () => {
          logger.info('✅ WebSocket opened successfully');
        },
        onmessage: (message) => {
          logger.info('📨 Received message:', JSON.stringify(message).substring(0, 200));
        },
        onerror: (error) => {
          logger.error('❌ Error:', error);
        },
        onclose: (event) => {
          logger.info(`🔌 WebSocket closed - Code: ${event?.code}, Reason: ${event?.reason}`);
        }
      }
    });

    logger.info('✅ Connection established!');
    logger.info('Waiting 3 seconds...');

    await new Promise(resolve => setTimeout(resolve, 3000));

    logger.info('Sending simple audio chunk...');

    // Send a very simple PCM audio chunk
    const silentAudio = Buffer.alloc(2048).toString('base64');

    await liveSession.sendRealtimeInput({
      media: {
        data: silentAudio,
        mimeType: 'audio/pcm;rate=16000'
      }
    });

    logger.info('✅ Audio sent!');

    await new Promise(resolve => setTimeout(resolve, 3000));

    liveSession.close();
    logger.info('=== Test Complete ===');
    process.exit(0);

  } catch (error) {
    logger.error('❌ Test failed:', error);
    logger.error(error.stack);
    process.exit(1);
  }
}

testMinimal();
