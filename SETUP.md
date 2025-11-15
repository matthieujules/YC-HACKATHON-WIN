# Ray-Ban Crypto Payments - Setup Guide

## Quick Start Summary

This project uses **Gemini 2.0 Live API** for real-time multimodal processing (video + audio) to enable crypto payments through:
1. ✅ **Verbal Agreement Detection** - Gemini listens for payment confirmation
2. ✅ **Handshake Detection** - Gemini watches for handshake gesture
3. ✅ **Transaction Execution** - When both conditions are met simultaneously

---

## Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** database
- **Google Gemini API key** ([Get one here](https://makersuite.google.com/app/apikey))
- **Ethereum wallet** with private key (for testnet)
- **Infura/Alchemy** API key for blockchain access

---

## Installation

### 1. Clone and Install

```bash
cd Rayban-Payments-Hackathon

# Install backend dependencies
cd backend
npm install

# Create .env file
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `backend/.env`:

```env
# Server
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:8080

# Database
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/rayban_payments

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_AI_API_KEY=your_gemini_api_key_here

# Web3 / Crypto (use testnet!)
WEB3_PROVIDER_URL=https://sepolia.infura.io/v3/your_infura_key
WALLET_PRIVATE_KEY=your_testnet_wallet_private_key

# Security
JWT_SECRET=your_random_secret_here
```

**Important:** Use Sepolia testnet for development!

### 3. Set Up Database

```bash
# Create database
createdb rayban_payments

# Run schema
psql rayban_payments < ../database/schema.sql
```

### 4. Start Backend

```bash
# Development mode with auto-reload
npm run dev

# Or production mode
npm start
```

Server will start on `http://localhost:3000`

### 5. Start Frontend

```bash
# In a new terminal, from project root
cd frontend

# Use any static file server
python -m http.server 8080
# OR
npx http-server -p 8080
# OR
php -S localhost:8080
```

Frontend will be available at `http://localhost:8080`

---

## Usage

### Step 1: Enroll People

1. Open `http://localhost:8080`
2. Click **Enroll** tab
3. Enter:
   - Name (e.g., "Alice")
   - Wallet address (0x...)
   - Physical description (e.g., "Woman with brown hair, green eyes, glasses")
4. Click **Save Person**

The description helps Gemini recognize the person in the video stream.

### Step 2: Run a Transaction

1. Click **Transaction** tab
2. Click **Start Streaming**
3. Allow camera and microphone access

Gemini AI will now monitor your stream for:

**Condition 1: Person Recognition**
- Gemini sees the person
- Matches description to enrolled database
- Displays: "Alice identified"

**Condition 2: Verbal Agreement**
- Gemini hears payment discussion
- Example: "I'll pay you $20" → "Yes, deal!"
- Displays: "Agreement confirmed: $20"

**Condition 3: Handshake Detection**
- Gemini sees two hands coming together
- Confirms stable handshake (2+ seconds)
- Displays: "Handshake detected"

**When BOTH verbal + handshake are confirmed:**
- Transaction panel appears
- Shows recipient, amount, quote
- Click **Confirm & Send** to execute
- Blockchain transaction is sent
- You'll see the transaction hash

---

## How It Works

### Architecture

```
Ray-Ban Glasses (or Webcam)
         ↓
  Browser (captures video @ 1 FPS + audio @ 16kHz)
         ↓
  WebSocket → Backend Server
         ↓
  Gemini Live API (multimodal processing)
         ↓
  Function Calls:
    - updateStatus() → Real-time observations
    - identifyPerson() → Person matching
    - confirmVerbalAgreement() → Payment agreement
    - confirmHandshake() → Gesture detection
    - executeTransaction() → When conditions met
         ↓
  Web3.js → Ethereum Blockchain
         ↓
  PostgreSQL (transaction record)
```

### Gemini's Role

Gemini 2.0 Flash receives:
- **Video frames** (1 per second)
- **Audio chunks** (continuous 16kHz PCM)

Gemini analyzes in real-time and calls functions when it detects:
1. A person matching enrolled descriptions
2. Verbal agreement with specific amount
3. Handshake gesture

When BOTH #2 and #3 are active simultaneously → Transaction ready!

---

## API Endpoints

### Enrollment

```bash
# Create person
POST http://localhost:3000/api/enroll
{
  "name": "Alice",
  "wallet_address": "0x...",
  "description": "Woman with brown hair..."
}

# List enrolled people
GET http://localhost:3000/api/enroll/list

# Delete person
DELETE http://localhost:3000/api/enroll/:id
```

### Transactions

```bash
# Execute transaction
POST http://localhost:3000/api/transaction/execute
{
  "sessionId": "...",
  "to_person_id": "uuid",
  "amount": 20,
  "verbal_confirmation": "I'll pay you $20. Yes, deal!",
  "handshake_confirmed": true,
  "confidence": 0.92
}

# Get transaction status
GET http://localhost:3000/api/transaction/:txHash

# Get history
GET http://localhost:3000/api/transaction/history/all

# Network info
GET http://localhost:3000/api/transaction/network/info
```

### WebSocket Events

**Client → Server:**
- `stream:start` - Start Gemini session
- `stream:video` - Send video frame
- `stream:audio` - Send audio chunk
- `stream:stop` - Stop session

**Server → Client:**
- `gemini:message` - Gemini's narration
- `person:identified` - Person matched
- `verbal:confirmed` - Agreement detected
- `handshake:confirmed` - Handshake detected
- `transaction:ready` - All conditions met
- `status:update` - Real-time observations

---

## Testing

### Test Enrollment

```bash
curl -X POST http://localhost:3000/api/enroll \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice",
    "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    "description": "Woman with brown hair and green eyes"
  }'
```

### Test Transaction (without camera)

```bash
curl -X POST http://localhost:3000/api/transaction/execute \
  -H "Content-Type: application/json" \
  -d '{
    "to_person_id": "uuid-from-enrollment",
    "amount": 0.01,
    "from_wallet": "0x...",
    "verbal_confirmation": "I agree to pay $0.01",
    "handshake_confirmed": true,
    "confidence": 0.95
  }'
```

---

## Troubleshooting

### "Gemini API key not configured"
- Add `GEMINI_API_KEY` to `.env`
- Get key from https://makersuite.google.com/app/apikey

### "Database connection failed"
- Check PostgreSQL is running: `pg_isready`
- Verify `DATABASE_URL` in `.env`
- Run schema: `psql rayban_payments < database/schema.sql`

### "Transaction failed: Insufficient balance"
- Get testnet ETH from Sepolia faucet
- Check balance: `curl http://localhost:3000/api/transaction/network/info`

### "Person not recognized"
- Ensure person is enrolled with good description
- Gemini matches by description keywords
- Try including distinctive features (glasses, hair color, etc.)

### Camera/Microphone not working
- Use HTTPS or localhost (required for media access)
- Check browser permissions
- Try Chrome/Firefox (best support)

### "Handshake not detected"
- Ensure good lighting
- Hands should be clearly visible
- Hold handshake stable for 2+ seconds
- Gemini processes video at 1 FPS (be patient)

---

## Production Deployment

### Security Checklist

- [ ] Use HTTPS (required for camera access)
- [ ] Set strong `JWT_SECRET`
- [ ] Use environment variables, never commit secrets
- [ ] Enable rate limiting
- [ ] Use mainnet wallet with minimal funds
- [ ] Implement multi-signature for large transactions
- [ ] Add transaction approval workflow
- [ ] Enable audit logging

### Deployment Options

**Backend:**
- Railway
- Render
- AWS EC2
- Digital Ocean

**Frontend:**
- Vercel
- Netlify
- GitHub Pages (static)

**Database:**
- Railway PostgreSQL
- AWS RDS
- Supabase

---

## Costs

### Development (Testnet)
- Gemini API: **FREE** tier available
- Testnet ETH: **FREE** from faucets
- Total: **$0**

### Production Estimates (per month, 100 transactions)
- Gemini 2.0 Flash: ~$2-5
- Ethereum mainnet gas: ~$50-200 (varies)
- Server (Railway): ~$5-10
- Database: ~$5 (free tier available)
- **Total: ~$62-220/month**

---

## Next Steps

1. ✅ Get Gemini API key
2. ✅ Set up testnet wallet
3. ✅ Enroll 2-3 test people
4. ✅ Test full transaction flow
5. ✅ Review Gemini responses
6. ✅ Tune confidence thresholds
7. ✅ Add error handling
8. ✅ Deploy to production

---

## Support

- **Gemini API Docs:** https://ai.google.dev/gemini-api/docs/live
- **Web3.js Docs:** https://docs.web3js.org
- **Socket.io Docs:** https://socket.io/docs

---

## License

MIT
