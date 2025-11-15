# Vision & Voice Web App

A modular web application with camera access, designed for easy integration of computer vision and voice agent features.

## Features

- **Camera Access**: Full webcam integration with start/stop controls
- **Frame Capture**: Capture and process individual frames
- **Modular Architecture**: Easy-to-extend structure for CV and voice features
- **Responsive Design**: Works on desktop and mobile devices

## Getting Started

### Running the App

1. Open `index.html` in a web browser (Chrome, Firefox, Safari, or Edge)
2. Click "Start Camera" and grant camera permissions
3. Use the controls to interact with the camera feed

### Using a Local Server (Recommended)

For best results, especially when adding external APIs, run with a local server:

```bash
# Using Python 3
python -m http.server 8000

# Using Python 2
python -m SimpleHTTPServer 8000

# Using Node.js (http-server)
npx http-server

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## Architecture

The app is built with three main classes:

### 1. VisionVoiceApp (Main App)
- Manages camera initialization and controls
- Handles UI updates
- Coordinates between CV and Voice modules

### 2. ComputerVisionModule
- Processes captured frames
- Placeholder for CV models (TensorFlow.js, OpenCV.js, etc.)
- Displays analysis results

### 3. VoiceAgentModule
- Handles voice input/output
- Placeholder for speech recognition and synthesis
- Processes voice commands

## Adding Computer Vision

To enable and extend computer vision features:

1. **Enable the module** in `app.js`:
```javascript
// At the bottom of app.js
app.computerVision.enable();
```

2. **Add your CV library** (example with TensorFlow.js):
```html
<!-- In index.html, before </body> -->
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs"></script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd"></script>
```

3. **Implement CV processing** in `ComputerVisionModule.processFrame()`:
```javascript
async processFrame(imageData) {
    if (!this.isEnabled) return;

    // Example: Object Detection
    const img = document.createElement('img');
    img.src = imageData;
    const predictions = await this.model.detect(img);

    this.displayResults(predictions);
}
```

## Adding Voice Agent

To enable and extend voice features:

1. **Enable the module** in `app.js`:
```javascript
app.voiceAgent.enable();
```

2. **Implement speech recognition**:
```javascript
startListening() {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = true;

    recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        this.processCommand(transcript);
    };

    recognition.start();
}
```

3. **Add voice synthesis**:
```javascript
speak(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
}
```

## Common Extensions

### Example: Real-time Object Detection
```javascript
// Initialize model
async loadModel() {
    this.model = await cocoSsd.load();
}

// Process video stream continuously
startRealTimeDetection() {
    setInterval(async () => {
        const predictions = await this.model.detect(this.app.getVideoElement());
        this.drawBoundingBoxes(predictions);
    }, 100); // 10 FPS
}
```

### Example: Voice Commands
```javascript
processCommand(command) {
    if (command.includes('capture')) {
        this.app.captureFrame();
    } else if (command.includes('analyze')) {
        this.app.computerVision.processFrame(this.app.captureFrame());
    }
}
```

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (iOS 11+)
- Requires HTTPS in production (or localhost for development)

## Security Notes

- Camera access requires user permission
- Use HTTPS in production for security
- Consider privacy implications when processing images

## Next Steps

1. Add your preferred CV library (TensorFlow.js, OpenCV.js, MediaPipe)
2. Implement voice recognition (Web Speech API or external service)
3. Connect to backend APIs for advanced processing
4. Add data persistence or cloud storage

## License

MIT
