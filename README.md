# Ray-Ban Crypto Payments

Smart glasses payment system using Gemini 2.0 Live API for multimodal detection (video + audio).

## How It Works

### Overview
1. **Enroll People**: Capture 3-5 photos + name + wallet address
2. **Start Transaction Stream**: Video (1 FPS) + audio streams to Gemini AI
3. **Gemini Detects TWO Confirmations**:
   - ✅ **Verbal Agreement**: Hears both parties agree to amount (e.g., "I'll pay $20" + "Yes, deal!")
   - ✅ **Handshake Gesture**: Sees hands shaking
4. **When Both Met**: Transaction can be executed

### Person Recognition
- Enrolled photos stored with wallet address
- During stream: Gemini receives current frame + enrolled photos
- Gemini compares faces and returns match/no match
- Stays consistent by continuous comparison every frame (1 FPS)

### Data Flow
```
Browser Camera/Mic
  → Canvas.toDataURL (video @ 1 FPS) + ScriptProcessor (audio @ 16kHz)
  → Base64 encode
  → Socket.io WebSocket
  → Backend Node.js Server
  → Gemini 2.0 Live API
  → Function calls back to server
  → Socket.io emits to frontend
  → UI updates (❌ → ✅)
```

## Architecture

### Backend (Node.js + Express + Socket.io)
- **Port**: 3000
- **Gemini Live API**: Handles video + audio simultaneously
- **Function Calling**: Gemini calls predefined functions when conditions met:
  - `identifyPerson(name, wallet)` - when face recognized
  - `confirmVerbalAgreement(amount, quote)` - when verbal agreement heard
  - `confirmHandshake(description)` - when handshake seen
  - `updateStatus(message)` - real-time observations

**Files**:
- `src/server.js` - Express + Socket.io setup
- `src/services/geminiLive.js` - Gemini API integration
- `src/controllers/streamController.js` - WebSocket event handling
- `src/controllers/enrollmentController.js` - REST API for enrollment

### Frontend (Vanilla JS)
- **Port**: 8080
- **No frameworks** - just HTML/CSS/JS

**Files**:
- `index.html` - Two modes: Enrollment & Transaction
- `js/app.js` - Main coordinator
- `js/enrollmentManager.js` - Camera capture, photo enrollment
- `js/streamManager.js` - Video/audio capture and streaming
- `js/uiManager.js` - Updates confirmations (❌ → ✅)
- `js/socketClient.js` - WebSocket connection
- `js/config.js` - Backend URL
- `css/styles.css` - Full styling

## Quick Start

### 1. Setup Backend
```bash
cd backend
npm install

# Edit .env and add your Gemini API key:
# GEMINI_API_KEY=your_actual_key_here

npm run dev
```
Server runs on **http://localhost:3000**

### 2. Setup Frontend
```bash
cd frontend
python3 -m http.server 8080
```
Frontend runs on **http://localhost:8080**

### 3. Use the App
1. Open http://localhost:8080
2. **Enroll Mode**:
   - Click "Start Camera"
   - Capture 3-5 photos from different angles
   - Enter name + wallet address (0x...)
   - Click "Save Person"
3. **Transaction Mode**:
   - Switch to Transaction tab
   - Click "Start Streaming"
   - Gemini watches for:
     - Face recognition (matches against enrolled photos)
     - Verbal agreement between two parties
     - Handshake gesture
   - Watch the checkmarks turn green (❌ → ✅)

## Current Status

### ✅ Working
- Frontend UI with camera enrollment
- Transaction mode with confirmation checkboxes
- Socket.io connection between frontend/backend
- Backend server running
- Gemini Live API integration code

### ⚠️ Issues
**PostgreSQL Not Installed**:
- Error: `ECONNREFUSED` when trying to connect to PostgreSQL
- Database configured at `postgresql://localhost:5432/rayban_payments`
- Backend starts anyway (graceful degradation)
- Enrolled people won't persist across restarts

**Solutions**:
1. Install PostgreSQL and run schema (production approach)
2. Use JSON file storage (quick prototype)
3. Use in-memory storage (testing only)

### 🔧 TODO
- Fix database (currently not installed)
- Add actual Gemini API key to .env
- Test full enrollment flow with camera
- Test streaming with real Gemini API
- Add crypto transaction execution (Web3.js integration)

## Tech Stack
- **Backend**: Node.js, Express, Socket.io, @google/generative-ai
- **Frontend**: Vanilla JS, Socket.io-client, MediaStream API
- **AI**: Gemini 2.0 Live API (multimodal video + audio)
- **Database**: PostgreSQL (not yet set up)
- **Blockchain**: Web3.js + Ethereum (future)

## Database Issue Details

**Problem**: PostgreSQL not running
**Error**: `AggregateError [ECONNREFUSED]` at `pg-pool/index.js:45:11`

**Why**: `.env` has `DATABASE_URL=postgresql://localhost:5432/rayban_payments` but PostgreSQL server not installed/running

**Impact**:
- Enrolled people not saved
- App still runs (UI works)
- Can test camera/streaming
- Just can't persist data

**Fix Options**:
1. **Install PostgreSQL**:
   ```bash
   brew install postgresql@15
   brew services start postgresql@15
   createdb rayban_payments
   psql rayban_payments < database/schema.sql
   ```

2. **Switch to JSON storage** (simpler for prototype):
   - Modify `src/controllers/enrollmentController.js`
   - Use `fs.writeFileSync('data/people.json')`
   - No database needed

3. **In-memory only** (testing):
   - Just use arrays in Node.js
   - Data lost on restart
   - Simplest for quick demo
