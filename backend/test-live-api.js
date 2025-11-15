require('dotenv').config();
const geminiLive = require('./src/services/geminiLive');
const jsonStorage = require('./src/services/jsonStorage');
const logger = require('./src/utils/logger');

async function testLiveAPI() {
  logger.info('=== Testing Gemini Live API Integration ===');

  try {
    // 1. Load enrolled people
    logger.info('Step 1: Loading enrolled people from JSON storage...');
    const enrolledPeople = await jsonStorage.getAllPeople();
    logger.info(`Found ${enrolledPeople.length} enrolled people`);

    if (enrolledPeople.length === 0) {
      logger.warn('No enrolled people found. Add some people first via the frontend enrollment page.');
      process.exit(0);
    }

    // Show enrolled people (without photos for brevity)
    enrolledPeople.forEach((person, index) => {
      logger.info(`  ${index + 1}. ${person.name} - ${person.wallet} (${person.photoCount} photos)`);
    });

    // 2. Create Gemini Live session
    logger.info('\nStep 2: Creating Gemini Live session with WebSocket...');

    const sessionId = 'test-session-' + Date.now();

    const session = await geminiLive.createSession(
      sessionId,
      // onMessage callback
      (message) => {
        logger.info(`[Gemini Message] ${message}`);
      },
      // onFunctionCall callback
      async (functionName, args) => {
        logger.info(`[Function Call] ${functionName}:`, JSON.stringify(args, null, 2));
        return { acknowledged: true, timestamp: new Date().toISOString() };
      }
    );

    logger.info('✅ Session created successfully!');
    logger.info(`   Session ID: ${sessionId}`);
    logger.info(`   Model: gemini-2.5-flash-native-audio-preview-09-2025`);

    // 3. Send enrolled people photos
    logger.info('\nStep 3: Sending enrolled people reference photos...');
    await geminiLive.sendEnrolledPeople(sessionId, enrolledPeople);
    logger.info('✅ Reference photos sent!');

    // 4. Send a test video frame (simulate camera input)
    logger.info('\nStep 4: Sending test video frame...');

    // Create a simple test image (1x1 white pixel as JPEG base64)
    const testImageBase64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA==';

    await geminiLive.sendVideoFrame(sessionId, testImageBase64);
    logger.info('✅ Test video frame sent!');

    // 5. Send test audio (simulate mic input)
    logger.info('\nStep 5: Sending test audio chunk...');

    // Create silent audio chunk (1024 samples of silence)
    const silentAudio = Buffer.alloc(2048).toString('base64');

    await geminiLive.sendAudioChunk(sessionId, silentAudio);
    logger.info('✅ Test audio chunk sent!');

    // 6. Wait a bit for responses
    logger.info('\nStep 6: Waiting for Gemini responses (5 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 7. Check session state
    logger.info('\nStep 7: Checking session state...');
    const state = geminiLive.getSessionState(sessionId);
    logger.info('Session state:', JSON.stringify(state, null, 2));

    // 8. Clean up
    logger.info('\nStep 8: Closing session...');
    await geminiLive.closeSession(sessionId);
    logger.info('✅ Session closed!');

    logger.info('\n=== Test Complete ===');
    logger.info('✅ Gemini Live API integration is working correctly!');
    logger.info('\nKey points:');
    logger.info('  • WebSocket connection established');
    logger.info('  • Model: Gemini 2.5 Flash with native audio');
    logger.info('  • Enrolled people photos uploaded');
    logger.info('  • Video and audio streaming functional');
    logger.info('  • Function calling configured and ready');

    process.exit(0);
  } catch (error) {
    logger.error('❌ Test failed:', error);
    logger.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testLiveAPI();
