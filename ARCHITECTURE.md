# Ray-Ban Crypto Payments - System Architecture

## Overview
Real-time video/audio streaming from Ray-Ban glasses to browser, with cloud-based AI processing for face recognition, verbal agreement detection, and handshake detection to trigger crypto transactions.

---

## Technology Stack

### Frontend
- **Framework:** Vanilla JS / React (your choice)
- **Video Streaming:** WebRTC / MediaStream API
- **Communication:** WebSocket (Socket.io)
- **UI:** Modern responsive design

### Backend
- **Runtime:** Node.js (Express + Socket.io)
- **Language:** JavaScript/TypeScript
- **Database:** PostgreSQL (user/wallet storage)
- **Cache:** Redis (session management)

### Cloud APIs
1. **Face Recognition:** Azure Face API or AWS Rekognition
   - Enrollment: Person Group management
   - Recognition: Real-time face identification

2. **Speech-to-Text:** OpenAI Whisper API or AssemblyAI
   - Real-time transcription
   - High accuracy
   - Keyword/intent detection

3. **Hand Tracking:** Google MediaPipe (can run on backend)
   - Handshake detection
   - Real-time pose estimation

4. **Crypto Transactions:** Web3.js + Ethereum/Polygon
   - Wallet integration
   - Transaction signing
   - Smart contract interaction

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Ray-Ban Glasses                        │
│                    (Video + Audio Input)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Browser Frontend                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Video Stream │  │ Audio Stream │  │  UI/Controls │     │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘     │
│         │                  │                                │
│         └──────────┬───────┘                                │
│                    │ WebSocket                              │
└────────────────────┼────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend Server (Node.js)                  │
│                                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │           WebSocket Handler (Socket.io)            │   │
│  └────────┬───────────────────────┬───────────────────┘   │
│           │                       │                         │
│  ┌────────▼────────┐    ┌────────▼────────┐               │
│  │ Video Processor │    │ Audio Processor │               │
│  └────────┬────────┘    └────────┬────────┘               │
│           │                       │                         │
└───────────┼───────────────────────┼─────────────────────────┘
            │                       │
            ▼                       ▼
┌──────────────────────┐  ┌──────────────────────┐
│   Azure Face API     │  │  OpenAI Whisper API  │
│  or AWS Rekognition  │  │   or AssemblyAI      │
└──────────┬───────────┘  └──────────┬───────────┘
           │                          │
           ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Transaction Orchestrator                       │
│                                                              │
│  State Machine:                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Face Detected│  │Agreement Heard│  │Handshake Done│     │
│  │   (Person)   │→ │   (Amount)    │→ │  (Trigger)   │     │
│  └──────────────┘  └──────────────┘  └──────┬───────┘     │
│                                              │              │
│                                              ▼              │
│                                    ┌──────────────────┐    │
│                                    │ Crypto Transaction│    │
│                                    │   (Web3.js)       │    │
│                                    └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                     PostgreSQL Database                     │
│  - User profiles                                            │
│  - Wallet addresses                                         │
│  - Transaction history                                      │
│  - Face recognition person IDs                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
rayban-payments/
│
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── app.js                 # Main application
│   │   ├── streamManager.js       # Video/audio streaming
│   │   ├── socketClient.js        # WebSocket communication
│   │   ├── ui.js                  # UI updates and controls
│   │   └── transaction.js         # Transaction UI/logic
│   └── assets/
│       └── icons/
│
├── backend/
│   ├── src/
│   │   ├── server.js              # Express + Socket.io server
│   │   ├── config/
│   │   │   ├── database.js        # DB connection
│   │   │   └── api-keys.js        # API credentials
│   │   ├── services/
│   │   │   ├── faceRecognition.js # Azure/AWS face API
│   │   │   ├── speechToText.js    # Whisper/AssemblyAI
│   │   │   ├── handshake.js       # Handshake detection
│   │   │   └── crypto.js          # Web3 transactions
│   │   ├── controllers/
│   │   │   ├── streamController.js
│   │   │   ├── enrollmentController.js
│   │   │   └── transactionController.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Transaction.js
│   │   │   └── Session.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── errorHandler.js
│   │   └── utils/
│   │       ├── logger.js
│   │       └── validators.js
│   ├── package.json
│   └── .env.example
│
├── database/
│   ├── schema.sql                 # Database schema
│   └── migrations/
│
├── docs/
│   ├── API.md                     # API documentation
│   ├── SETUP.md                   # Setup instructions
│   └── TESTING.md                 # Testing guide
│
├── .gitignore
├── docker-compose.yml             # Docker setup
├── README.md
└── package.json
```

---

## Data Flow

### 1. Enrollment Flow
```
User → Fill form (name, wallet)
     → Capture video frames
     → Send to backend
     → Backend → Azure Face API (Create Person + Add Faces)
     → Store Person ID + Wallet in DB
     → Return success
```

### 2. Transaction Flow
```
Ray-Ban Stream → Browser
              → WebSocket → Backend

Backend receives frame:
  → Extract frame → Azure Face API → Identify person
  → Update state: { personId, name, wallet, confidence }

Backend receives audio:
  → Buffer audio chunks → Whisper API → Transcription
  → NLP: Extract intent + amount
  → Update state: { agreementDetected: true, amount }

Backend receives frame (continuous):
  → MediaPipe Hands → Detect handshake
  → Update state: { handshakeDetected: true }

When all 3 conditions met:
  → Trigger transaction
  → Web3.js → Sign & send transaction
  → Notify frontend
  → Update DB
```

---

## API Choices & Rationale

### Face Recognition: Azure Face API ✅
**Why:**
- Free tier: 30,000 transactions/month
- Person Groups for easy enrollment
- High accuracy (~99%+)
- Fast response (~200-500ms)
- Easy enrollment workflow

**Alternative:** AWS Rekognition
- Similar features
- Slightly more expensive
- Better if already using AWS

### Speech-to-Text: OpenAI Whisper API ✅
**Why:**
- Extremely accurate
- Supports 99+ languages
- $0.006 per minute (very cheap)
- Easy integration
- Good at understanding context

**Alternative:** AssemblyAI
- Real-time streaming support
- Slightly more expensive
- Built-in keyword detection

### Handshake Detection: Google MediaPipe ✅
**Why:**
- Can run on backend (Python/Node.js)
- Free and open-source
- Real-time hand tracking
- 21 landmarks per hand
- Easy handshake logic

**Alternative:** Custom ML model
- Overkill for hackathon
- Would need training data

---

## State Management

### Transaction State Machine
```javascript
{
  sessionId: "uuid",
  status: "idle" | "active" | "ready" | "processing" | "completed",

  // Face Recognition
  face: {
    detected: false,
    personId: null,
    name: null,
    wallet: null,
    confidence: 0,
    consecutiveFrames: 0  // Require 10+ for stability
  },

  // Audio Agreement
  audio: {
    detected: false,
    transcript: "",
    amount: null,
    timestamp: null
  },

  // Handshake
  handshake: {
    detected: false,
    stableFrames: 0,  // Require 30+ frames (~1 sec)
    timestamp: null
  },

  // Transaction
  transaction: {
    ready: false,
    txHash: null,
    status: "pending" | "confirmed" | "failed"
  }
}
```

---

## API Endpoints

### REST API

```
POST   /api/enroll             # Create new person
GET    /api/enroll/list        # List enrolled people
DELETE /api/enroll/:id         # Delete person

POST   /api/transaction/start  # Start transaction session
POST   /api/transaction/confirm # Confirm and execute
GET    /api/transaction/history # Get transaction history

GET    /api/health             # Health check
```

### WebSocket Events

```
Client → Server:
- stream:video          # Video frame data
- stream:audio          # Audio chunk data
- stream:start          # Start streaming
- stream:stop           # Stop streaming

Server → Client:
- face:detected         # Face recognized
- face:lost             # Face lost
- audio:transcript      # Real-time transcript
- audio:agreement       # Agreement detected
- handshake:detected    # Handshake detected
- handshake:lost        # Handshake lost
- transaction:ready     # All conditions met
- transaction:complete  # Transaction done
- error                 # Error occurred
```

---

## Database Schema

```sql
-- Users/People enrolled
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(255) NOT NULL UNIQUE,
  face_person_id VARCHAR(255) UNIQUE,  -- Azure Face Person ID
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_wallet VARCHAR(255) NOT NULL,
  to_person_id UUID REFERENCES people(id),
  to_wallet VARCHAR(255) NOT NULL,
  amount DECIMAL(18, 8) NOT NULL,
  currency VARCHAR(10) DEFAULT 'ETH',
  tx_hash VARCHAR(255) UNIQUE,
  status VARCHAR(50) DEFAULT 'pending',
  metadata JSONB,  -- Store video/audio evidence
  created_at TIMESTAMP DEFAULT NOW(),
  confirmed_at TIMESTAMP
);

-- Sessions (for tracking active streams)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(50) DEFAULT 'active',
  state JSONB,  -- Store current state machine
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Environment Variables

```env
# Server
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:8080

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/rayban_payments

# Redis
REDIS_URL=redis://localhost:6379

# Azure Face API
AZURE_FACE_API_KEY=your_key_here
AZURE_FACE_ENDPOINT=https://your-region.api.cognitive.microsoft.com
AZURE_FACE_PERSON_GROUP_ID=rayban-users

# OpenAI Whisper
OPENAI_API_KEY=your_key_here

# Crypto
WEB3_PROVIDER_URL=https://mainnet.infura.io/v3/your_key
WALLET_PRIVATE_KEY=your_private_key
```

---

## Deployment Strategy

### Development
- Frontend: Live Server / Vite dev server
- Backend: nodemon
- Database: Local PostgreSQL
- Redis: Local instance

### Production
- Frontend: Vercel / Netlify
- Backend: Railway / Render / AWS EC2
- Database: Railway PostgreSQL / AWS RDS
- Redis: Railway Redis / AWS ElastiCache

---

## Performance Targets

- **Face Recognition:** < 500ms per frame
- **Audio Transcription:** < 1s latency
- **Handshake Detection:** Real-time (30 FPS)
- **WebSocket Latency:** < 100ms
- **End-to-End:** < 2s from handshake to transaction trigger

---

## Security Considerations

1. **API Keys:** Store in environment variables, never commit
2. **WebSocket:** Implement authentication tokens
3. **Video/Audio:** Encrypt WebSocket connections (WSS)
4. **Transactions:** Require multi-factor confirmation
5. **Database:** Use parameterized queries (SQL injection prevention)
6. **Rate Limiting:** Prevent API abuse

---

## Cost Estimate (Per Month)

### APIs
- **Azure Face API:** Free (< 30k calls/month)
- **OpenAI Whisper:** ~$5-10 (assuming 100 transactions, ~2 min each)
- **MediaPipe:** Free (self-hosted)

### Infrastructure
- **Backend Server:** $5-10 (Railway/Render)
- **Database:** Free tier (Railway) or $5 (paid)
- **Redis:** Free tier

**Total: ~$10-25/month** for moderate usage

---

## Next Steps

1. ✅ Set up project structure
2. ✅ Initialize backend with Express + Socket.io
3. ✅ Set up database schema
4. ✅ Integrate Azure Face API enrollment
5. ✅ Implement video streaming (frontend → backend)
6. ✅ Integrate face recognition in real-time
7. ✅ Integrate OpenAI Whisper for audio
8. ✅ Implement handshake detection
9. ✅ Build transaction orchestrator
10. ✅ Test end-to-end flow
11. ✅ Deploy and demo!
