// Main App Class - Modular structure for easy extension
class VisionVoiceApp {
    constructor() {
        this.videoElement = document.getElementById('videoFeed');
        this.canvasElement = document.getElementById('canvas');
        this.stream = null;
        this.isStreaming = false;

        // Module placeholders for future features
        this.computerVision = new ComputerVisionModule(this);
        this.voiceAgent = new VoiceAgentModule(this);

        this.initializeUI();
    }

    initializeUI() {
        // Button references
        this.startBtn = document.getElementById('startCamera');
        this.stopBtn = document.getElementById('stopCamera');
        this.captureBtn = document.getElementById('captureFrame');
        this.statusElement = document.getElementById('status');

        // Event listeners
        this.startBtn.addEventListener('click', () => this.startCamera());
        this.stopBtn.addEventListener('click', () => this.stopCamera());
        this.captureBtn.addEventListener('click', () => this.captureFrame());
    }

    async startCamera() {
        try {
            this.updateStatus('Requesting camera access...');

            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: false
            });

            // Set video source
            this.videoElement.srcObject = this.stream;
            this.isStreaming = true;

            // Update UI
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.captureBtn.disabled = false;
            this.updateStatus('Camera is active');

            console.log('Camera started successfully');
        } catch (error) {
            console.error('Error accessing camera:', error);
            this.updateStatus('Error: Could not access camera');
            alert('Unable to access camera. Please ensure you have granted camera permissions.');
        }
    }

    stopCamera() {
        if (this.stream) {
            // Stop all tracks
            this.stream.getTracks().forEach(track => track.stop());
            this.videoElement.srcObject = null;
            this.stream = null;
            this.isStreaming = false;

            // Update UI
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
            this.captureBtn.disabled = true;
            this.updateStatus('Camera stopped');

            console.log('Camera stopped');
        }
    }

    captureFrame() {
        if (!this.isStreaming) {
            console.warn('Cannot capture: camera is not active');
            return null;
        }

        // Set canvas size to match video
        this.canvasElement.width = this.videoElement.videoWidth;
        this.canvasElement.height = this.videoElement.videoHeight;

        // Draw current frame to canvas
        const ctx = this.canvasElement.getContext('2d');
        ctx.drawImage(this.videoElement, 0, 0);

        // Get image data
        const imageData = this.canvasElement.toDataURL('image/jpeg', 0.95);

        this.updateStatus('Frame captured');
        console.log('Frame captured');

        // Trigger CV processing (if implemented)
        this.computerVision.processFrame(imageData);

        return imageData;
    }

    updateStatus(message) {
        this.statusElement.textContent = message;
        console.log('Status:', message);
    }

    getVideoElement() {
        return this.videoElement;
    }

    getCanvasElement() {
        return this.canvasElement;
    }
}

// Computer Vision Module - Placeholder for CV functionality
class ComputerVisionModule {
    constructor(app) {
        this.app = app;
        this.isEnabled = false;
        this.resultsElement = document.getElementById('cvResults');
        this.contentElement = document.getElementById('cvContent');
    }

    enable() {
        this.isEnabled = true;
        this.resultsElement.style.display = 'block';
        console.log('Computer Vision module enabled');
    }

    disable() {
        this.isEnabled = false;
        this.resultsElement.style.display = 'none';
        console.log('Computer Vision module disabled');
    }

    processFrame(imageData) {
        if (!this.isEnabled) {
            console.log('CV processing skipped: module not enabled');
            return;
        }

        // Placeholder for CV processing
        // Add your computer vision logic here
        // Examples: object detection, face recognition, OCR, etc.

        console.log('Processing frame with Computer Vision...');
        this.displayResults('CV processing would happen here');
    }

    displayResults(data) {
        this.contentElement.innerHTML = `
            <p><strong>CV Analysis:</strong></p>
            <pre>${JSON.stringify(data, null, 2)}</pre>
            <p class="placeholder">Connect your CV model here</p>
        `;
    }

    // Helper method to get current frame data
    async getCurrentFrame() {
        return this.app.captureFrame();
    }
}

// Voice Agent Module - Placeholder for voice functionality
class VoiceAgentModule {
    constructor(app) {
        this.app = app;
        this.isListening = false;
        this.voiceSection = document.getElementById('voiceSection');
        this.voiceToggle = document.getElementById('voiceToggle');
        this.voiceOutput = document.getElementById('voiceOutput');

        // Initialize voice button (when needed)
        if (this.voiceToggle) {
            this.voiceToggle.addEventListener('click', () => this.toggleListening());
        }
    }

    enable() {
        this.voiceSection.style.display = 'block';
        console.log('Voice Agent module enabled');
    }

    disable() {
        this.voiceSection.style.display = 'none';
        if (this.isListening) {
            this.stopListening();
        }
        console.log('Voice Agent module disabled');
    }

    toggleListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    startListening() {
        // Placeholder for voice recognition
        // Add your speech recognition logic here
        // Example: Web Speech API, voice agent integration, etc.

        this.isListening = true;
        this.voiceToggle.textContent = 'Stop Listening';
        this.voiceToggle.classList.add('listening');
        this.app.updateStatus('Voice agent listening...');

        this.displayOutput('Voice recognition would start here');
        console.log('Voice agent started listening');
    }

    stopListening() {
        this.isListening = false;
        this.voiceToggle.textContent = 'Start Listening';
        this.voiceToggle.classList.remove('listening');
        this.app.updateStatus('Voice agent stopped');

        console.log('Voice agent stopped listening');
    }

    displayOutput(text) {
        const timestamp = new Date().toLocaleTimeString();
        this.voiceOutput.innerHTML += `
            <div class="voice-message">
                <small>${timestamp}</small>
                <p>${text}</p>
            </div>
        `;
    }

    // Method to process voice commands
    processCommand(command) {
        console.log('Processing voice command:', command);
        // Add command processing logic here
    }
}

// Initialize the app when DOM is ready
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new VisionVoiceApp();
    console.log('Vision & Voice App initialized');

    // Example: Enable CV module for testing
    // Uncomment when you're ready to use it
    // app.computerVision.enable();

    // Example: Enable Voice module for testing
    // Uncomment when you're ready to use it
    // app.voiceAgent.enable();
});

// Export for external use if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VisionVoiceApp, ComputerVisionModule, VoiceAgentModule };
}
