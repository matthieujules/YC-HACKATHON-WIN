# Ray-Ban Crypto Payments

Smart glasses payment system using Gemini 2.0 Flash for multimodal AI detection (video + audio).

## Complete Flow

### 1. **Enrollment** (Register People)
You capture photos of people you'll transact with:

1. Click "Enroll" tab
2. Click "Start Camera"
3. Capture **3-5 photos** from different angles
4. Enter their **name** and **wallet address** (0x...)
5. Click "Save Person"
6. Photos saved to `backend/data/people.json` (persists across restarts)

**What gets stored:**
```json
{
  "id": "uuid",
  "name": "Alice",
  "wallet": "0x1234...",
  "photos": ["data:image/jpeg;base64,..."],
  "photoCount": 5,
  "createdAt": "2025-11-15T..."
}
```

### 2. **Transaction Mode** (Live Detection)

#### a) Start Streaming
1. Switch to "Transaction" tab
2. Click "▶️ Start Streaming"
3. **Backend automatically:**
   - Creates Gemini AI session
   - Sends all enrolled photos to Gemini:
     ```
     "ENROLLED PEOPLE:
      - Alice (Wallet: 0x1234...) - 5 photos"
     ```
   - Gemini now knows who to look for

#### b) Person Recognition (Continuous)
- Browser captures video @ **1 FPS**
- Sends frames to Gemini
- Gemini compares to enrolled photos
- **When match found:** Calls `identifyPerson("Alice", "0x1234...")`
- **Purple overlay appears on video:**
  ```
  ┌─────────────────────┐
  │ Alice    ✓ Identified│
  │ 0x1234...           │
  └─────────────────────┘
  ```
- **Overlay persists** as long as person is in frame

#### c) Confirmation Detection (Real-time)

**Two confirmations required:**

**1️⃣ Verbal Agreement**
- Browser captures audio @ 16kHz
- Sends to Gemini every ~2 seconds
- Gemini listens for:
  - Payment amount: "$20", "twenty dollars"
  - Explicit agreement: "yes", "deal", "agreed", "okay"
  - From BOTH parties (you + other person)
- **Example:**
  ```
  You: "I'll pay you $20"
  Them: "Yes, deal!"
  ```
- Gemini calls: `confirmVerbalAgreement(amount=20, quote="Yes, deal!")`
- **UI updates:** ❌ → ✅ (green checkmark + amount displayed)

**2️⃣ Handshake Gesture**
- Gemini watches video for:
  - Two hands clasped together
  - Stable for 2+ seconds
  - Proper handshake position
- Gemini calls: `confirmHandshake(active=true, description="...")`
- **UI updates:** ❌ → ✅ (green checkmark)

#### d) Transaction Ready
- **When BOTH ✅:** Success panel appears
- Shows: "Both Confirmations Met!"
- Ready to execute crypto transaction (not implemented yet)

### 3. **Data Flow Architecture**

```
┌─────────────────────────────────────────────────────────┐
│ RAY-BAN GLASSES (or Browser Camera/Mic)                │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ FRONTEND (localhost:8080)                               │
│ • streamManager.js:                                     │
│   - Captures video @ 1 FPS → Canvas.toDataURL()        │
│   - Captures audio @ 16kHz → ScriptProcessor           │
│   - Base64 encodes both                                 │
│ • socketClient.js:                                      │
│   - Sends via Socket.io WebSocket                      │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ BACKEND (localhost:3000)                                │
│ • streamController.js:                                  │
│   - Receives video/audio over WebSocket                │
│   - Routes to Gemini service                            │
│ • geminiLive.js:                                        │
│   - Sends to Gemini 2.0 Flash API                      │
│   - Video: 1 frame per chat message                    │
│   - Audio: Buffered chunks every 2 sec                 │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ GEMINI 2.0 FLASH API                                    │
│ • Multimodal processing (vision + audio)               │
│ • Function Calling:                                     │
│   - identifyPerson(name, wallet, confidence)           │
│   - confirmVerbalAgreement(amount, quote, confidence)  │
│   - confirmHandshake(active, description)              │
│   - updateStatus(visual, audio)                        │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ BACKEND → FRONTEND (via Socket.io)                     │
│ • Emits events:                                         │
│   - person:identified → shows overlay                  │
│   - verbal:confirmed → ❌ → ✅                          │
│   - handshake:confirmed → ❌ → ✅                        │
│   - gemini:message → live commentary                   │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Install & Run Backend
```bash
cd backend
npm install

# IMPORTANT: Add your Gemini API key to .env
# Edit backend/.env:
GEMINI_API_KEY=your_actual_gemini_key_here

npm run dev
```
✅ Server starts on **http://localhost:3000**

Get API key: https://aistudio.google.com/apikey

### 2. Run Frontend
```bash
cd frontend
python3 -m http.server 8080
```
✅ Frontend opens at **http://localhost:8080**

### 3. Test the System

**Enroll someone:**
1. Enroll tab → Start Camera
2. Capture 3-5 photos
3. Enter name: "Alice"
4. Enter wallet: "0x1234567890123456789012345678901234567890"
5. Save Person

**Test detection:**
1. Transaction tab → Start Streaming
2. Point camera at the enrolled person
3. Purple overlay should appear with their name
4. Say something like "I'll pay $20" then "Yes, deal!"
5. Shake hands with someone
6. Watch confirmations turn green ✅

## What's Actually Implemented

### ✅ Fully Working
- **Enrollment system:** Camera capture, photo storage (JSON)
- **Person recognition:** Gemini compares faces to enrolled photos
- **Video streaming:** 1 FPS to Gemini
- **Audio streaming:** 16kHz to Gemini (buffered every 2 sec)
- **WebSocket communication:** Socket.io frontend ↔ backend
- **UI overlays:** Person identification overlay on video
- **Confirmation tracking:** Verbal + Handshake detection
- **Real-time updates:** ❌ → ✅ when Gemini detects conditions
- **Data persistence:** JSON file storage (backend/data/people.json)

### ⚠️ Not Production Ready

**1. Audio Processing**
- Uses deprecated `ScriptProcessorNode` (works but will be removed from browsers)
- **Should use:** AudioWorklet (more complex, better performance)
- **Impact:** Works fine for demo, but needs upgrade for production

**2. Person Recognition Accuracy**
- Gemini gets reference photos but may not always match correctly
- Depends on: lighting, angle, photo quality, number of photos
- **Best practice:** Capture 5 photos from multiple angles in good lighting
- **Limitation:** If person looks different (haircut, glasses) may not match

**3. Verbal Agreement Detection**
- Gemini listens for keywords but may have false positives
- **Example issues:**
  - "Maybe I'll pay $20" might trigger (not definitive)
  - Background conversations could interfere
- **Need:** More robust NLP or confirmation prompts

**4. Handshake Detection**
- Vision-based gesture detection has limitations
- **Issues:**
  - Low light conditions
  - Hands out of frame
  - Similar gestures (high five, fist bump) might trigger
- **Need:** Better gesture recognition or longer stability requirement

**5. Error Handling**
- Limited retry logic for Gemini API failures
- No graceful degradation if API is down
- No user-facing error messages for detection failures

**6. Security**
- **CRITICAL:** No wallet key encryption
- Wallets stored as plaintext in JSON
- No authentication/authorization
- Anyone with access can enroll/delete people
- **Production needs:** Encryption at rest, access control, audit logs

### 🚧 Not Implemented Yet

**Crypto Transaction Execution**
- Web3.js integration exists but not connected
- Needs:
  - Private key management (secure!)
  - Transaction signing
  - Gas fee estimation
  - Transaction confirmation waiting
  - Error handling for failed transactions

**Multiple Person Tracking**
- Currently assumes ONE person in frame
- Can't handle: multiple enrolled people simultaneously
- Can't track: "Person A agreed but Person B didn't"

**Transaction History**
- No record of completed transactions
- No receipt generation
- No transaction logs

## Technical Stack

**Frontend:**
- Vanilla JavaScript (no frameworks)
- Socket.io-client (WebSocket)
- MediaStream API (camera/mic access)
- Canvas API (video frame capture)
- ScriptProcessorNode (audio capture - deprecated)

**Backend:**
- Node.js + Express
- Socket.io (WebSocket server)
- @google/generative-ai (Gemini SDK)
- JSON file storage (fs module)
- Web3.js (crypto - not active)

**AI:**
- Gemini 2.0 Flash Exp (gemini-2.0-flash-exp)
- Multimodal: Image + Audio processing
- Function calling for structured responses

**Storage:**
- JSON files (backend/data/people.json)
- Base64 encoded images
- No database required

## Known Limitations & Caveats

1. **Gemini API Cost:** Each video frame + audio chunk costs tokens. 1 minute of streaming ≈ 60 frames + ~30 audio chunks = significant cost.

2. **Browser Compatibility:** Requires camera/mic permissions. Works best in Chrome/Edge. Safari may have issues with ScriptProcessorNode.

3. **Network Requirements:** Needs stable internet for real-time Gemini API calls. High latency = delayed detections.

4. **Single Session:** Reloading page loses active stream. No session persistence.

5. **No Undo:** Deleting enrolled person is permanent. No soft delete.

6. **Wallet Validation:** Only validates format (0x + 40 hex chars). Doesn't check if wallet actually exists on blockchain.

7. **Face Recognition Limits:** Works best with:
   - Good lighting
   - Clear frontal + profile shots
   - Minimal changes in appearance
   - Similar conditions between enrollment and detection

## File Structure

```
backend/
├── data/
│   └── people.json              # Enrolled people storage
├── src/
│   ├── server.js                # Express + Socket.io setup
│   ├── config/
│   │   └── database.js          # (Unused - legacy PostgreSQL)
│   ├── services/
│   │   ├── geminiLive.js        # Gemini API integration
│   │   ├── jsonStorage.js       # JSON file CRUD operations
│   │   └── crypto.js            # Web3 (not connected)
│   ├── controllers/
│   │   ├── streamController.js  # WebSocket handlers
│   │   └── enrollmentController.js # REST API for enrollment
│   └── utils/
│       └── logger.js            # Winston logger
├── .env                         # Config (GEMINI_API_KEY required!)
└── package.json

frontend/
├── index.html                   # Main UI
├── css/
│   └── styles.css              # All styling
└── js/
    ├── app.js                  # Main coordinator
    ├── config.js               # Backend URL
    ├── socketClient.js         # WebSocket connection
    ├── streamManager.js        # Video/audio capture
    ├── enrollmentManager.js    # Enrollment flow
    └── uiManager.js            # UI updates
```

## Environment Variables

Required in `backend/.env`:
```bash
GEMINI_API_KEY=your_key_here     # REQUIRED - Get from https://aistudio.google.com/apikey
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:8080
```

Optional (not used):
```bash
DATABASE_URL=...                 # (Unused - switched to JSON)
WEB3_PROVIDER_URL=...           # (Future - for blockchain)
WALLET_PRIVATE_KEY=...          # (Future - for transactions)
```

## Next Steps for Production

1. **Security Hardening:**
   - Encrypt wallet addresses
   - Add user authentication
   - Implement rate limiting
   - Secure WebSocket connections (WSS)

2. **Improve Detection:**
   - Add confidence thresholds
   - Implement retry logic
   - Better audio preprocessing
   - Multi-angle face recognition

3. **Audio Upgrade:**
   - Replace ScriptProcessor with AudioWorklet
   - Add noise reduction
   - Implement voice activity detection

4. **Transaction Integration:**
   - Connect Web3.js properly
   - Add transaction confirmation UI
   - Implement gas estimation
   - Add transaction receipts

5. **Database Migration:**
   - Move from JSON to PostgreSQL or MongoDB
   - Add indexes for performance
   - Implement proper migrations

6. **Testing:**
   - Unit tests for all components
   - Integration tests for Gemini API
   - E2E tests for full flow
   - Load testing for concurrent streams
