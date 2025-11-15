document.addEventListener('DOMContentLoaded', async () => {
  console.log('🕶️ Ray-Ban Crypto Payments - Initializing...');

  // Connect to backend
  socketClient.connect();

  // Set up socket callbacks
  socketClient.onGeminiMessage = (msg) => {
    uiManager.updateGeminiMessage(msg);
    uiManager.updateGeminiState('Active');
  };

  socketClient.onPersonIdentified = (data) => {
    uiManager.showPersonInfo(data);
  };

  socketClient.onVerbalConfirmed = (data) => {
    uiManager.updateVerbalConfirmation(data);
  };

  socketClient.onHandshakeConfirmed = (data) => {
    uiManager.updateHandshakeConfirmation(data);
  };

  // Initialize enrollment manager
  enrollmentManager.initialize();
  await enrollmentManager.loadEnrolledPeople();

  // Mode toggle
  const modeEnrollBtn = document.getElementById('modeEnroll');
  const modeTransactionBtn = document.getElementById('modeTransaction');
  const enrollmentMode = document.getElementById('enrollmentMode');
  const transactionMode = document.getElementById('transactionMode');

  modeEnrollBtn?.addEventListener('click', () => {
    enrollmentMode.style.display = 'block';
    transactionMode.style.display = 'none';
    modeEnrollBtn.classList.add('active');
    modeTransactionBtn.classList.remove('active');
  });

  modeTransactionBtn?.addEventListener('click', () => {
    enrollmentMode.style.display = 'none';
    transactionMode.style.display = 'block';
    modeEnrollBtn.classList.remove('active');
    modeTransactionBtn.classList.add('active');
  });

  // Transaction mode
  const startStreamBtn = document.getElementById('startStream');
  const stopStreamBtn = document.getElementById('stopStream');

  startStreamBtn?.addEventListener('click', async () => {
    const success = await streamManager.startStream();

    if (success) {
      startStreamBtn.style.display = 'none';
      stopStreamBtn.style.display = 'inline-block';
      uiManager.updateStreamStatus(true);
      uiManager.updateStatus('Streaming to Gemini AI...');
      uiManager.updateGeminiState('Active');
      uiManager.resetConfirmations();
    }
  });

  stopStreamBtn?.addEventListener('click', () => {
    streamManager.stopStream();
    startStreamBtn.style.display = 'inline-block';
    stopStreamBtn.style.display = 'none';
    uiManager.updateStreamStatus(false);
    uiManager.updateStatus('Stream stopped');
    uiManager.updateGeminiState('Idle');
    uiManager.resetConfirmations();
  });

  // Check server connection
  setTimeout(() => {
    if (!socketClient.connected) {
      uiManager.updateStatus('⚠️ Cannot connect to server. Is backend running?');
    } else {
      uiManager.updateStatus('✅ Connected - Ready to start');
    }
  }, 2000);

  console.log('✅ App initialized');
});
