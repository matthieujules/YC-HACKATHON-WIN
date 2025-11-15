class SocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.onGeminiMessage = null;
    this.onStatusUpdate = null;  // NEW: For real-time status updates
    this.onPersonIdentified = null;
    this.onVerbalConfirmed = null;
    this.onHandshakeConfirmed = null;
    this.onTransactionReady = null;
  }

  connect() {
    this.socket = io(CONFIG.BACKEND_URL);

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('✅ Connected to server');
      this.updateServerStatus(true);
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.log('❌ Disconnected from server');
      this.updateServerStatus(false);
    });

    this.socket.on('session:created', (data) => {
      console.log('Session created:', data);
    });

    this.socket.on('gemini:message', (data) => {
      if (this.onGeminiMessage) this.onGeminiMessage(data.message);
    });

    this.socket.on('status:update', (data) => {
      console.log('Status update:', data);
      // Display in UI
      if (this.onStatusUpdate) this.onStatusUpdate(data);
    });

    this.socket.on('person:identified', (data) => {
      console.log('Person identified:', data);
      if (this.onPersonIdentified) this.onPersonIdentified(data);
    });

    this.socket.on('person:unknown', (data) => {
      console.log('Unknown person:', data);
    });

    this.socket.on('verbal:confirmed', (data) => {
      console.log('Verbal confirmed:', data);
      if (this.onVerbalConfirmed) this.onVerbalConfirmed(data);
    });

    this.socket.on('handshake:confirmed', (data) => {
      console.log('Handshake confirmed:', data);
      if (this.onHandshakeConfirmed) this.onHandshakeConfirmed(data);
    });

    this.socket.on('transaction:ready', (data) => {
      console.log('Transaction ready:', data);
      if (this.onTransactionReady) this.onTransactionReady(data);
    });

    this.socket.on('transaction:blocked', (data) => {
      console.warn('Transaction blocked:', data.reason);
      alert(`Transaction blocked: ${data.reason}`);
    });

    this.socket.on('stream:started', (data) => {
      console.log('Stream started:', data);
    });

    this.socket.on('stream:stopped', () => {
      console.log('Stream stopped');
    });

    this.socket.on('stream:error', (data) => {
      console.error('Stream error:', data.error);
      alert(`Stream error: ${data.error}`);
    });
  }

  updateServerStatus(connected) {
    const statusEl = document.getElementById('serverStatus');
    if (statusEl) {
      statusEl.innerHTML = connected
        ? '<span class="dot online"></span> Connected'
        : '<span class="dot offline"></span> Disconnected';
    }
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
