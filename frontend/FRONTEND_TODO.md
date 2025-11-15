# Frontend JavaScript Files - Implementation Guide

The backend is complete! You need to create these frontend JavaScript files to complete the system.

## Files to Create

### 1. `js/config.js`
Configuration and constants

```javascript
const CONFIG = {
  BACKEND_URL: 'http://localhost:3000',
  WS_URL: 'http://localhost:3000',
  VIDEO_FPS: 1, // Gemini processes 1 FPS
  AUDIO_SAMPLE_RATE: 16000, // 16kHz for Gemini
  AUDIO_CHUNK_SIZE: 1024
};
```

### 2. `js/socketClient.js`
WebSocket connection manager

```javascript
class SocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
  }

  connect() {
    this.socket = io(CONFIG.WS_URL);

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.log('Disconnected from server');
    });

    // Register event handlers
    this.registerHandlers();
  }

  registerHandlers() {
    // Handle Gemini messages
    this.socket.on('gemini:message', (data) => {
      uiManager.updateGeminiMessage(data.message);
    });

    // Handle person identified
    this.socket.on('person:identified', (data) => {
      uiManager.updatePersonCard(data);
    });

    // Handle verbal confirmation
    this.socket.on('verbal:confirmed', (data) => {
      uiManager.updateVerbalCard(data);
    });

    // Handle handshake confirmation
    this.socket.on('handshake:confirmed', (data) => {
      uiManager.updateHandshakeCard(data);
    });

    // Handle transaction ready
    this.socket.on('transaction:ready', (data) => {
      uiManager.showTransactionPanel(data);
    });
  }

  startStream() {
    this.socket.emit('stream:start');
  }

  stopStream() {
    this.socket.emit('stream:stop');
  }

  sendVideo(frameData) {
    if (this.connected) {
      this.socket.emit('stream:video', { frame: frameData });
    }
  }

  sendAudio(audioData) {
    if (this.connected) {
      this.socket.emit('stream:audio', { audio: audioData });
    }
  }
}

const socketClient = new SocketClient();
```

### 3. `js/streamManager.js`
Camera and microphone stream manager

```javascript
class StreamManager {
  constructor() {
    this.videoElement = document.getElementById('videoFeed');
    this.canvas = document.getElementById('canvas');
    this.stream = null;
    this.isStreaming = false;
    this.videoInterval = null;
    this.audioContext = null;
    this.audioProcessor = null;
  }

  async startStream() {
    try {
      // Get camera and microphone
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: { sampleRate: 16000, channelCount: 1 }
      });

      this.videoElement.srcObject = this.stream;
      this.isStreaming = true;

      // Start sending video frames (1 FPS)
      this.startVideoCapture();

      // Start sending audio chunks
      this.startAudioCapture();

      // Tell backend to start Gemini session
      socketClient.startStream();

      console.log('Stream started');
    } catch (error) {
      console.error('Error starting stream:', error);
      alert('Could not access camera/microphone. Please grant permissions.');
    }
  }

  startVideoCapture() {
    // Capture frame every 1 second (1 FPS for Gemini)
    this.videoInterval = setInterval(() => {
      if (this.isStreaming) {
        const frame = this.captureFrame();
        if (frame) {
          socketClient.sendVideo(frame);
        }
      }
    }, 1000);
  }

  captureFrame() {
    this.canvas.width = this.videoElement.videoWidth;
    this.canvas.height = this.videoElement.videoHeight;

    const ctx = this.canvas.getContext('2d');
    ctx.drawImage(this.videoElement, 0, 0);

    // Get base64 image
    return this.canvas.toDataURL('image/jpeg', 0.8);
  }

  startAudioCapture() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000
    });

    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.audioProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.audioProcessor.onaudioprocess = (e) => {
      const audioData = e.inputBuffer.getChannelData(0);

      // Convert to base64
      const int16Array = new Int16Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        int16Array[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
      }

      const base64Audio = this.arrayBufferToBase64(int16Array.buffer);
      socketClient.sendAudio(base64Audio);
    };

    source.connect(this.audioProcessor);
    this.audioProcessor.connect(this.audioContext.destination);
  }

  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    if (this.videoInterval) {
      clearInterval(this.videoInterval);
    }

    if (this.audioProcessor) {
      this.audioProcessor.disconnect();
    }

    if (this.audioContext) {
      this.audioContext.close();
    }

    this.isStreaming = false;
    socketClient.stopStream();

    console.log('Stream stopped');
  }
}

const streamManager = new StreamManager();
```

### 4. `js/enrollmentManager.js`
Handles person enrollment

```javascript
class EnrollmentManager {
  constructor() {
    this.enrolledPeople = [];
  }

  async loadEnrolledPeople() {
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}/api/enroll/list`);
      const data = await response.json();

      if (data.success) {
        this.enrolledPeople = data.people;
        this.renderEnrolledList();
      }
    } catch (error) {
      console.error('Error loading enrolled people:', error);
    }
  }

  async enrollPerson(name, wallet, description) {
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}/api/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, wallet_address: wallet, description })
      });

      const data = await response.json();

      if (data.success) {
        alert(`Successfully enrolled ${name}!`);
        await this.loadEnrolledPeople();
        return true;
      } else {
        alert(`Error: ${data.error}`);
        return false;
      }
    } catch (error) {
      console.error('Error enrolling person:', error);
      alert('Failed to enroll person');
      return false;
    }
  }

  async deletePerson(id) {
    if (!confirm('Are you sure you want to delete this person?')) {
      return;
    }

    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}/api/enroll/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        await this.loadEnrolledPeople();
      }
    } catch (error) {
      console.error('Error deleting person:', error);
    }
  }

  renderEnrolledList() {
    const listElement = document.getElementById('enrolledList');

    if (this.enrolledPeople.length === 0) {
      listElement.innerHTML = '<p class="placeholder">No people enrolled yet</p>';
      return;
    }

    listElement.innerHTML = this.enrolledPeople.map(person => `
      <div class="person-card">
        <div class="person-info">
          <h4>${person.name}</h4>
          <p>${person.wallet}</p>
        </div>
        <button class="btn-delete" onclick="enrollmentManager.deletePerson('${person.id}')">
          Delete
        </button>
      </div>
    `).join('');
  }
}

const enrollmentManager = new EnrollmentManager();
```

### 5. `js/uiManager.js`
Manages UI updates

```javascript
class UIManager {
  updateGeminiMessage(message) {
    document.getElementById('geminiMessage').textContent = message;
  }

  updatePersonCard(data) {
    const card = document.getElementById('personCard');
    const status = document.getElementById('personStatus');
    const details = document.getElementById('personDetails');

    card.classList.add('detected');
    status.innerHTML = `<p class="status-text">Person Identified</p>`;
    details.innerHTML = `
      <p><strong>${data.name}</strong></p>
      <p class="mono">${data.wallet}</p>
      <p>Confidence: ${(data.confidence * 100).toFixed(0)}%</p>
    `;
  }

  updateVerbalCard(data) {
    const card = document.getElementById('verbalCard');
    const status = document.getElementById('verbalStatus');
    const details = document.getElementById('verbalDetails');

    if (data.agreed) {
      card.classList.add('detected');
      status.innerHTML = `<p class="status-text">Agreement Confirmed ✅</p>`;
      details.innerHTML = `
        <p><strong>Amount: $${data.amount}</strong></p>
        <p class="quote">"${data.quote}"</p>
        <p>Confidence: ${(data.confidence * 100).toFixed(0)}%</p>
      `;
    } else {
      card.classList.remove('detected');
      status.innerHTML = `<p class="status-text">Listening...</p>`;
    }
  }

  updateHandshakeCard(data) {
    const card = document.getElementById('handshakeCard');
    const status = document.getElementById('handshakeStatus');
    const details = document.getElementById('handshakeDetails');

    if (data.active) {
      card.classList.add('detected');
      status.innerHTML = `<p class="status-text">Handshake Confirmed ✅</p>`;
      details.innerHTML = `
        <p>${data.description}</p>
        <p>Duration: ${data.duration || 0}s</p>
        <p>Confidence: ${(data.confidence * 100).toFixed(0)}%</p>
      `;
    } else {
      card.classList.remove('detected');
      status.innerHTML = `<p class="status-text">Waiting...</p>`;
    }
  }

  showTransactionPanel(data) {
    const panel = document.getElementById('transactionPanel');
    panel.style.display = 'block';

    document.getElementById('txRecipient').textContent = data.recipient.name;
    document.getElementById('txWallet').textContent = data.recipient.wallet;
    document.getElementById('txAmount').textContent = `$${data.amount}`;
    document.getElementById('txQuote').textContent = data.verbalQuote;

    // Store transaction data for confirmation
    panel.dataset.transactionData = JSON.stringify(data);
  }
}

const uiManager = new UIManager();
```

### 6. `js/app.js`
Main application coordinator

```javascript
// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Ray-Ban Crypto Payments - Initializing...');

  // Connect to backend
  socketClient.connect();

  // Load enrolled people
  await enrollmentManager.loadEnrolledPeople();

  // Mode toggle
  document.getElementById('modeEnroll').addEventListener('click', () => {
    document.getElementById('enrollmentMode').style.display = 'block';
    document.getElementById('transactionMode').style.display = 'none';
    document.getElementById('modeEnroll').classList.add('active');
    document.getElementById('modeTransaction').classList.remove('active');
  });

  document.getElementById('modeTransaction').addEventListener('click', () => {
    document.getElementById('enrollmentMode').style.display = 'none';
    document.getElementById('transactionMode').style.display = 'block';
    document.getElementById('modeEnroll').classList.remove('active');
    document.getElementById('modeTransaction').classList.add('active');
  });

  // Enrollment handlers
  document.getElementById('saveEnrollment').addEventListener('click', async () => {
    const name = document.getElementById('personName').value;
    const wallet = document.getElementById('walletAddress').value;
    const description = document.getElementById('personDescription').value;

    if (!name || !wallet) {
      alert('Name and wallet address are required');
      return;
    }

    const success = await enrollmentManager.enrollPerson(name, wallet, description);

    if (success) {
      // Reset form
      document.getElementById('personName').value = '';
      document.getElementById('walletAddress').value = '';
      document.getElementById('personDescription').value = '';
    }
  });

  document.getElementById('resetEnrollment').addEventListener('click', () => {
    document.getElementById('personName').value = '';
    document.getElementById('walletAddress').value = '';
    document.getElementById('personDescription').value = '';
  });

  // Transaction handlers
  document.getElementById('startStream').addEventListener('click', async () => {
    await streamManager.startStream();

    document.getElementById('startStream').style.display = 'none';
    document.getElementById('stopStream').style.display = 'inline-block';
    document.getElementById('streamStatus').innerHTML = `
      <span class="status-dot online"></span>
      <span class="status-text">Streaming</span>
    `;
  });

  document.getElementById('stopStream').addEventListener('click', () => {
    streamManager.stopStream();

    document.getElementById('startStream').style.display = 'inline-block';
    document.getElementById('stopStream').style.display = 'none';
    document.getElementById('streamStatus').innerHTML = `
      <span class="status-dot offline"></span>
      <span class="status-text">Offline</span>
    `;
  });

  document.getElementById('confirmTransaction').addEventListener('click', async () => {
    const panel = document.getElementById('transactionPanel');
    const data = JSON.parse(panel.dataset.transactionData);

    // Execute transaction
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}/api/transaction/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: data.sessionId,
          to_person_id: data.recipient.id,
          amount: data.amount,
          verbal_confirmation: data.verbalQuote,
          handshake_confirmed: true,
          confidence: data.confidence
        })
      });

      const result = await response.json();

      if (result.success) {
        document.getElementById('transactionResult').innerHTML = `
          <div class="success">
            <h3>✅ Transaction Successful!</h3>
            <p>Transaction Hash:</p>
            <p class="mono">${result.transaction.txHash}</p>
            <p>Amount: $${result.transaction.amount}</p>
            <p>To: ${result.transaction.recipient}</p>
          </div>
        `;
        document.getElementById('transactionResult').style.display = 'block';
      } else {
        alert(`Transaction failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Transaction error:', error);
      alert('Failed to execute transaction');
    }
  });

  document.getElementById('cancelTransaction').addEventListener('click', () => {
    document.getElementById('transactionPanel').style.display = 'none';
  });

  console.log('App initialized successfully');
});
```

## Quick Implementation Checklist

- [ ] Create all 6 JavaScript files above
- [ ] Update `frontend/index.html` to reference them correctly
- [ ] Update `frontend/css/styles.css` with detection card styles
- [ ] Test enrollment flow
- [ ] Test streaming connection
- [ ] Test full transaction flow

## Tips

1. **CORS:** Make sure backend allows `http://localhost:8080`
2. **Camera Permissions:** Must use HTTPS or localhost
3. **Gemini API Key:** Must be set in backend `.env`
4. **Database:** Must be running and schema loaded

Good luck with your hackathon! 🚀
