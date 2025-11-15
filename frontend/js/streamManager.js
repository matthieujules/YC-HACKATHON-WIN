class StreamManager {
  constructor() {
    this.videoElement = document.getElementById('videoFeed');
    this.canvas = document.getElementById('canvas');
    this.stream = null;
    this.isStreaming = false;
    this.videoInterval = null;
    this.audioContext = null;
    this.audioWorkletNode = null;
  }

  async startStream() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }, // Reduced from 1280x720
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      this.videoElement.srcObject = this.stream;
      this.isStreaming = true;

      // Start video capture at 1 FPS
      this.startVideoCapture();

      // Start audio capture
      await this.startAudioCapture();

      // Tell backend to start Gemini session
      socketClient.startStream();

      console.log('🎥 Stream started');
      return true;
    } catch (error) {
      console.error('Error starting stream:', error);
      alert('Could not access camera/microphone. Please grant permissions.');
      return false;
    }
  }

  startVideoCapture() {
    this.videoInterval = setInterval(() => {
      if (this.isStreaming) {
        const frame = this.captureFrame();
        if (frame) {
          socketClient.sendVideo(frame);
        }
      }
    }, 1000); // 1 FPS
  }

  captureFrame() {
    if (!this.videoElement.videoWidth) return null;

    // Further downscale to 320x240 for faster processing
    const targetWidth = 320;
    const targetHeight = 240;

    this.canvas.width = targetWidth;
    this.canvas.height = targetHeight;

    const ctx = this.canvas.getContext('2d');
    ctx.drawImage(this.videoElement, 0, 0, targetWidth, targetHeight);

    // Reduced quality from 0.8 to 0.5 for smaller payload
    return this.canvas.toDataURL('image/jpeg', 0.5);
  }

  async startAudioCapture() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000
    });

    const source = this.audioContext.createMediaStreamSource(this.stream);

    // Use ScriptProcessor (deprecated but simpler for hackathon)
    const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      if (!this.isStreaming) return;

      const inputData = e.inputBuffer.getChannelData(0);

      // Convert Float32 to Int16
      const int16Array = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Convert to base64
      const base64 = this.arrayBufferToBase64(int16Array.buffer);
      socketClient.sendAudio(base64);
    };

    source.connect(processor);
    processor.connect(this.audioContext.destination);

    this.audioWorkletNode = processor;
  }

  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  stopStream() {
    this.isStreaming = false;

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.videoInterval) {
      clearInterval(this.videoInterval);
      this.videoInterval = null;
    }

    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    socketClient.stopStream();

    console.log('⏹️ Stream stopped');
  }
}

const streamManager = new StreamManager();
