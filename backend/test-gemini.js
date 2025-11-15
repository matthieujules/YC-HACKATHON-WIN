require('dotenv').config();
const geminiLive = require('./src/services/geminiLive');

async function testGeminiSession() {
  console.log('\n🧪 Testing Gemini Live API Connection...\n');

  try {
    // Test 1: Create session
    console.log('1️⃣ Creating Gemini Live session...');
    const sessionId = 'test-session-' + Date.now();

    const session = await geminiLive.createSession(
      sessionId,
      (message) => {
        console.log('📨 Gemini message:', message);
      },
      async (functionName, args) => {
        console.log('🔧 Function call:', functionName, args);
        return { acknowledged: true };
      }
    );

    console.log('✅ Session created successfully!');
    console.log('   Session ID:', sessionId);

    // Wait a moment for connection to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Send a test video frame
    console.log('\n2️⃣ Sending test video frame...');
    // Create a minimal valid JPEG base64 (1x1 pixel black image)
    const minimalJpeg = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/AAAAB//Z';
    await geminiLive.sendVideoFrame(sessionId, `data:image/jpeg;base64,${minimalJpeg}`);
    console.log('✅ Video frame sent using sendRealtimeInput!');

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2b: Send test audio
    console.log('\n2️⃣b Sending test audio...');
    // Create minimal PCM audio (silence)
    const silentAudio = Buffer.alloc(16000).toString('base64'); // 1 second of silence
    await geminiLive.sendAudioChunk(sessionId, `data:audio/pcm;base64,${silentAudio}`);
    console.log('✅ Audio chunk sent using sendRealtimeInput!');

    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Load and send real enrollment data
    console.log('\n3️⃣ Testing enrollment data...');
    const jsonStorage = require('./src/services/jsonStorage');
    const realPeople = await jsonStorage.getAllPeople();
    console.log(`   Loaded ${realPeople.length} enrolled people from database`);

    if (realPeople.length > 0) {
      await geminiLive.sendEnrolledPeople(sessionId, realPeople);
      console.log('✅ Enrollment data sent!');
    } else {
      console.log('⚠️  No enrolled people found, skipping enrollment');
    }

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 4: Check if session is still alive
    console.log('\n4️⃣ Checking session status...');
    const isActive = geminiLive.activeSessions.has(sessionId);
    console.log('   Session active:', isActive);

    if (isActive) {
      console.log('\n✅ All tests passed! Session is stable.');
    } else {
      console.log('\n❌ Session was closed unexpectedly!');
    }

    // Cleanup
    console.log('\n🧹 Closing session...');
    geminiLive.closeSession(sessionId);
    console.log('✅ Test complete!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

testGeminiSession();
