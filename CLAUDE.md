# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ray-Ban smart glasses crypto payment system using Gemini 2.0 Flash for multimodal AI detection. The system enables face-to-face crypto transactions by detecting:
1. Person recognition via face matching against enrolled photos
2. Verbal payment agreement through audio analysis
3. Handshake gesture confirmation through video analysis

**Tech Stack:**
- Backend: Node.js + Express + Socket.io + Gemini 2.0 Flash API
- Frontend: Vanilla JavaScript + Socket.io-client + MediaStream API
- Storage: JSON file-based (backend/data/people.json)
- AI: Gemini multimodal (vision + audio) with function calling

## Development Commands

### Backend
```bash
cd backend
npm install
npm run dev      # Start development server with nodemon (auto-reload)
npm start        # Production mode
npm test         # Run Jest tests
```

Server runs on `http://localhost:3000`

### Frontend
```bash
cd frontend
python3 -m http.server 8080
```

Frontend runs on `http://localhost:8080`

### Environment Setup
Required: Create `backend/.env` with:
```bash
GEMINI_API_KEY=your_key_here     # Get from https://aistudio.google.com/apikey
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:8080
```

## Architecture

### Data Flow
```
Browser (Camera/Mic)
  → Frontend (streamManager.js captures video @1 FPS + audio @16kHz)
    → Socket.io WebSocket (socketClient.js)
      → Backend (streamController.js routes to Gemini)
        → Gemini 2.0 Flash API (multimodal processing + function calling)
          → Backend emits events back to Frontend
            → UI updates (overlays, confirmations)
```

### Backend Architecture

**Entry Point:** `src/server.js`
- Express app setup with Socket.io WebSocket server
- Middleware: helmet, cors, rate limiting
- Health check endpoint: `/health`
- API routes under `/api/`

**Core Services:**

1. **geminiLive.js** - Gemini API integration
   - Creates/manages chat sessions with Gemini 2.0 Flash
   - Sends video frames (1 FPS throttled)
   - Buffers and sends audio chunks (~2 sec intervals)
   - Handles function calling responses from Gemini
   - Tracks session state (person ID, verbal agreement, handshake)
   - Function declarations: `updateStatus`, `confirmVerbalAgreement`, `confirmHandshake`, `identifyPerson`, `executeTransaction`

2. **jsonStorage.js** - Data persistence
   - CRUD operations for enrolled people
   - Stores to `backend/data/people.json`
   - Each person: `{ id, name, wallet, photos[], photoCount, createdAt }`

3. **streamController.js** - WebSocket handler
   - Manages Socket.io events: `stream:start`, `stream:stop`, `stream:video`, `stream:audio`
   - Creates Gemini sessions on stream start
   - Sends enrolled people photos to Gemini for reference
   - Routes video/audio to GeminiLiveService
   - Emits events: `person:identified`, `verbal:confirmed`, `handshake:confirmed`, `transaction:ready`

**Controllers:**
- `enrollmentController.js` - REST API for enrollment (POST create, GET list, DELETE)
- `transactionController.js` - Crypto transaction endpoints (not fully implemented)

**Utils:**
- `logger.js` - Winston logger with file rotation

### Frontend Architecture

**Main Files:**
- `index.html` - Two tabs: Enrollment & Transaction
- `app.js` - Main coordinator, initializes all managers
- `config.js` - Backend URL configuration

**Managers:**

1. **streamManager.js** - Media capture
   - Uses MediaStream API to access camera/mic
   - Captures video frames via Canvas.toDataURL() at 1 FPS
   - Captures audio via ScriptProcessorNode (deprecated but functional)
   - Converts audio to Int16 PCM @ 16kHz
   - Sends via socketClient

2. **socketClient.js** - WebSocket communication
   - Connects to backend Socket.io
   - Emits: `stream:start`, `stream:stop`, `stream:video`, `stream:audio`
   - Listens: `person:identified`, `verbal:confirmed`, `handshake:confirmed`, `transaction:ready`, `gemini:message`
   - Triggers callbacks for UI updates

3. **enrollmentManager.js** - Enrollment flow
   - Camera preview for capturing photos
   - Stores 3-5 photos per person
   - REST API calls to backend `/api/enroll`
   - Validates wallet address format (0x + 40 hex chars)

4. **uiManager.js** - UI state management
   - Shows person identification overlay on video
   - Updates confirmation checkmarks (verbal ❌/✅, handshake ❌/✅)
   - Displays Gemini live commentary
   - Success panel when both confirmations met

## Key Implementation Details

### Gemini Integration
- **Model:** `gemini-live-2.5-flash-preview-native-audio-09-2025`
- **System instruction:** Detailed prompt in `geminiLive.js:18-55` instructs Gemini to monitor for person recognition, verbal agreement, and handshake
- **Function calling:** Gemini calls JavaScript functions when conditions detected
- **Reference photos:** All enrolled people's photos sent to Gemini at session start for face comparison
- **Video throttling:** Enforced at 1 FPS in `geminiLive.js:316-322` to reduce API costs
- **Audio buffering:** ~2 seconds of chunks batched before sending (`geminiLive.js:362`)

### Person Enrollment
- Photos stored as base64 data URIs in JSON
- No database - all data in `backend/data/people.json`
- Wallet addresses stored in plaintext (security risk noted in README)
- Photos sent to Gemini for face recognition reference

### Audio Processing
- Uses deprecated `ScriptProcessorNode` (works but will be removed from browsers)
- Should migrate to AudioWorklet for production
- 16kHz mono, converted from Float32 to Int16

### WebSocket Events
**Frontend → Backend:**
- `stream:start` - Initialize Gemini session
- `stream:stop` - Close session
- `stream:video` - Video frame (base64 JPEG)
- `stream:audio` - Audio chunk (base64 PCM)

**Backend → Frontend:**
- `session:created` - Gemini session ready
- `person:identified` - Face matched enrolled person
- `verbal:confirmed` - Verbal agreement detected
- `handshake:confirmed` - Handshake detected
- `transaction:ready` - Both confirmations met
- `gemini:message` - Live commentary from AI

## Known Limitations

1. **Single person tracking** - Cannot handle multiple enrolled people in frame simultaneously
2. **No crypto integration** - Web3.js present but transaction execution not connected
3. **Audio API deprecation** - ScriptProcessorNode will be removed; needs AudioWorklet migration
4. **Security** - Wallet addresses in plaintext, no encryption, no authentication
5. **Detection accuracy** - Depends on lighting, photo quality, Gemini's recognition capability
6. **No transaction history** - No persistence of completed transactions
7. **Session persistence** - Reloading page loses active stream

## Development Notes

### Testing the Flow
1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && python3 -m http.server 8080`
3. Enroll a person with 3-5 photos from different angles
4. Start streaming and point camera at enrolled person
5. Say payment amount and agreement phrase
6. Perform handshake gesture
7. Watch for both confirmations to turn green

### Adding New Gemini Functions
1. Add function declaration in `geminiLive.js` tools array
2. Update `updateSessionState()` to handle the new function
3. Add event emission in streamController's `onFunctionCall` handler
4. Add corresponding socket listener in frontend `socketClient.js`
5. Update UI in `uiManager.js` to reflect new state

### Debugging
- Backend logs: `backend/logs/combined.log` and `error.log`
- Console logs: Browser DevTools for frontend WebSocket events
- Gemini responses logged in backend console with `logger.debug()`
- Session state: Check `GeminiLiveService.getSessionState(sessionId)`

### Cost Considerations
- Each video frame + audio chunk costs Gemini API tokens
- 1 minute ≈ 60 frames + 30 audio chunks = significant cost
- Use rate limiting and frame throttling to control costs
- Consider implementing client-side motion detection to only send frames when needed
