document.addEventListener('DOMContentLoaded', async () => {
  console.log('🕶️ Ray-Ban Crypto Payments - Initializing...');

  // Connect to backend
  socketClient.connect();

  // Set up socket callbacks
  socketClient.onGeminiMessage = (msg) => {
    uiManager.updateGeminiMessage(msg);
    uiManager.updateGeminiState('Active');
  };

  // NEW: Real-time status updates from Gemini's updateStatus() calls
  socketClient.onStatusUpdate = (data) => {
    uiManager.updateStatusObservations(data);
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

  // AUTOMATIC PAYMENT EXECUTION: When Gemini confirms both handshake + verbal agreement
  socketClient.onTransactionReady = async (data) => {
    console.log('💰 Transaction ready - Executing payment via Locus MCP...', data);

    try {
      // Show processing status
      uiManager.updateStatus('💰 Executing payment via Locus...');
      uiManager.updateGeminiMessage('🚀 Initiating USDC payment on Base via Locus MCP...');

      // Call the transaction execution API
      console.log('💰 PAYMENT REQUEST DATA:', {
        recipient: data.recipient,
        wallet: data.recipient.wallet,
        name: data.recipient.name
      });

      const response = await fetch(`${CONFIG.BACKEND_URL}/api/transaction/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to_person_id: data.recipient.id,
          to_wallet: data.recipient.wallet,
          to_name: data.recipient.name,
          amount: data.amount,
          verbal_confirmation: data.verbalQuote,
          handshake_confirmed: true,
          confidence: data.confidence,
          session_id: data.sessionId
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Payment executed successfully!', result);
        uiManager.updateStatus(`✅ Payment sent! ${result.transaction.amount} USDC to ${result.transaction.recipient}`);
        uiManager.updateGeminiMessage(`✅ Payment Complete!\nAmount: ${result.transaction.amount} USDC\nTo: ${result.transaction.recipient}\nWallet: ${result.transaction.wallet}\nMethod: Locus MCP\nTransaction ID: ${result.transaction.id}`);

        // Show success panel with transaction details
        uiManager.showTransactionSuccess(result);
      } else {
        console.error('❌ Payment failed:', result);
        uiManager.updateStatus('❌ Payment failed: ' + (result.error || 'Unknown error'));
        uiManager.updateGeminiMessage('❌ Payment failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ Error executing payment:', error);
      uiManager.updateStatus('❌ Error executing payment: ' + error.message);
      uiManager.updateGeminiMessage('❌ Payment error: ' + error.message);
    }
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
      uiManager.clearGeminiMessages();  // Clear previous messages
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

  // Payment overlay close button
  const closePaymentOverlayBtn = document.getElementById('closePaymentOverlay');
  closePaymentOverlayBtn?.addEventListener('click', () => {
    uiManager.hidePaymentPopup();
  });

  console.log('✅ App initialized');
});
