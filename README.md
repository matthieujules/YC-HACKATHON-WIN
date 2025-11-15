# 🕶️ Ray-Ban Crypto Payments

> Handshake-activated crypto transactions using Ray-Ban smart glasses, powered by Gemini AI

## 🎯 Overview

Enable secure, hands-free crypto payments through **two confirmations**:

1. **🎤 Verbal Agreement** - AI listens for explicit payment confirmation
2. **🤝 Handshake Gesture** - AI watches for physical handshake

When BOTH are detected simultaneously → Transaction executes automatically

---

## ✨ Key Features

- **Real-time Multimodal AI** - Gemini 2.0 Live API processes video + audio streams
- **Person Recognition** - Matches faces to enrolled users with wallet addresses
- **Verbal Confirmation** - Detects payment amount and agreement keywords
- **Handshake Detection** - Identifies handshake gesture in video
- **Blockchain Integration** - Executes Ethereum transactions via Web3
- **Transaction History** - Full audit trail in PostgreSQL

---

## 🏗️ Architecture

```
Ray-Ban Glasses (Camera + Mic)
         ↓
    Browser WebSocket
         ↓
    Node.js Backend
         ↓
    Gemini Live API (Multimodal AI)
    - Sees video @ 1 FPS
    - Hears audio continuously
    - Understands context
    - Calls functions when conditions met
         ↓
    Blockchain Transaction
```

### Why Gemini Live API?

**Before:** Needed 3 separate APIs
- Azure Face API (person recognition)
- OpenAI Whisper (speech-to-text)
- MediaPipe (handshake detection)

**After:** Single Gemini Live API does it all
- Sees AND hears simultaneously
- Understands context ("I see Alice shaking hands while agreeing to $20")
- Function calling for direct transaction triggers
- Lower latency, lower cost, simpler code

---

## 🚀 Quick Start

### 1. Install

```bash
cd backend
npm install
cp .env.example .env
```

### 2. Configure

Edit `backend/.env`:

```env
GEMINI_API_KEY=your_key_here
DATABASE_URL=postgresql://localhost/rayban_payments
WEB3_PROVIDER_URL=https://sepolia.infura.io/v3/your_key
WALLET_PRIVATE_KEY=your_testnet_private_key
```

### 3. Database

```bash
createdb rayban_payments
psql rayban_payments < database/schema.sql
```

### 4. Run

```bash
# Backend
cd backend
npm run dev

# Frontend (new terminal)
cd frontend
python -m http.server 8080
```

Visit `http://localhost:8080`

---

## 📖 Usage

### Enroll People

1. Go to **Enroll** tab
2. Enter name, wallet address, and physical description
3. Click **Save Person**

Example:
- **Name:** Alice
- **Wallet:** 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
- **Description:** Woman with brown hair, green eyes, wearing glasses

### Run Transaction

1. Go to **Transaction** tab
2. Click **Start Streaming**
3. Allow camera/mic access

Gemini monitors for:

**Person:** "I see a woman with brown hair and glasses" → Matches "Alice"

**Verbal:** "I'll pay you $20" → "Yes, deal!" → Confirmed ✅

**Handshake:** Two hands come together → Stable for 2 seconds → Confirmed ✅

**Both confirmed?** → Transaction panel appears → Click "Confirm & Send" → Done! 🎉

---

## 🎯 How Gemini Works

### System Instructions

Gemini is given this mission:

> "Monitor video and audio for 3 conditions:
> 1. Person identification (match to enrolled descriptions)
> 2. Verbal agreement (keywords: yes, deal, agreed, with $ amount)
> 3. Handshake gesture (hands together, stable 2+ seconds)
>
> When conditions 2 AND 3 are met simultaneously, call executeTransaction()"

### Function Calling

Gemini calls these functions:

```javascript
// Continuous updates
updateStatus({ visual: "...", audio: "..." })

// Person identified
identifyPerson({ description: "...", confidence: 0.92 })

// Agreement detected
confirmVerbalAgreement({
  agreed: true,
  amount: 20,
  quote: "Yes, I'll pay $20"
})

// Handshake detected
confirmHandshake({
  active: true,
  duration: 2.5
})

// All conditions met!
executeTransaction({
  person: "Alice",
  amount: 20,
  verbal: "Yes, I'll pay $20",
  handshake: true,
  confidence: 0.95
})
```

Backend receives these calls and:
- Validates all conditions
- Checks database for wallet address
- Executes blockchain transaction
- Stores in audit log

---

## 📁 Project Structure

```
rayban-payments/
├── backend/
│   ├── src/
│   │   ├── server.js                    # Express + Socket.io server
│   │   ├── services/
│   │   │   ├── geminiLive.js            # Gemini Live API client
│   │   │   ├── crypto.js                # Web3 blockchain
│   │   │   └── handshake.js             # (Backup handshake detection)
│   │   ├── controllers/
│   │   │   ├── streamController.js      # WebSocket handler
│   │   │   ├── enrollmentController.js  # Person CRUD
│   │   │   └── transactionController.js # Transaction API
│   │   ├── config/
│   │   │   └── database.js              # PostgreSQL connection
│   │   └── utils/
│   │       └── logger.js                # Winston logging
│   └── package.json
├── frontend/
│   ├── index.html                       # Main UI
│   ├── css/
│   │   └── styles.css                   # Styling
│   └── js/
│       ├── app.js                       # Main app
│       ├── socketClient.js              # WebSocket client
│       ├── streamManager.js             # Media capture
│       ├── enrollmentManager.js         # Enrollment UI
│       └── uiManager.js                 # UI updates
├── database/
│   └── schema.sql                       # PostgreSQL schema
├── docs/
│   ├── ARCHITECTURE.md                  # Technical details
│   ├── GEMINI_ARCHITECTURE.md           # Gemini integration
│   └── TECHNICAL_PLAN.md                # Original plan
├── SETUP.md                             # Setup guide
└── README.md                            # This file
```

---

## 🔧 Tech Stack

### Frontend
- Vanilla JavaScript
- Socket.io client
- MediaStream API (camera/mic)
- Modern CSS

### Backend
- Node.js + Express
- Socket.io (WebSocket)
- @google/generative-ai (Gemini SDK)
- Web3.js (Ethereum)
- PostgreSQL

### AI
- Gemini 2.0 Flash (multimodal)
- Function calling
- Real-time streaming

### Blockchain
- Ethereum (Sepolia testnet)
- Web3.js
- Infura/Alchemy

---

## 📊 Demo Scenario

**Characters:**
- **You** (wearing Ray-Ban glasses with camera)
- **Alice** (enrolled user, wallet: 0x742d...)

**Conversation:**

```
You: "Hey Alice, I'll buy that book from you for $20. Deal?"
Alice: "Yes, deal!"
*You shake hands*

[Gemini AI Processing...]
✅ Person identified: Alice (0x742d...)
✅ Verbal agreement: $20
✅ Handshake: Confirmed

[Transaction Executes]
🎉 Sent 20 USDC to Alice
Tx: 0xabc123...
```

---

## 🎨 UI Features

### Enrollment Tab
- Simple form (name, wallet, description)
- List of enrolled people
- Delete enrolled users

### Transaction Tab
- Live video feed
- Real-time Gemini narration
- Three detection cards:
  - 👤 Person Recognition
  - 🎤 Verbal Agreement
  - 🤝 Handshake Detection
- Transaction confirmation panel
- Transaction result/hash display

---

## 🔒 Security

- **Testnet First:** Always test on Sepolia/Goerli
- **User Confirmation:** Transaction panel requires manual click
- **Confidence Thresholds:** Only execute if confidence > 70%
- **Audit Trail:** All transactions logged in database
- **Environment Variables:** API keys never committed
- **Rate Limiting:** Prevent API abuse
- **HTTPS Required:** For camera/mic access

---

## 💰 Cost Estimate

### Development
- **FREE** (Gemini free tier + testnet ETH)

### Production (100 transactions/month)
- Gemini 2.0 Flash: ~$2-5
- Ethereum gas: ~$50-200 (varies by network congestion)
- Server: ~$5-10 (Railway/Render)
- Database: ~$5 (or free tier)
- **Total: ~$62-220/month**

---

## 🐛 Troubleshooting

### Camera not working
- Use HTTPS or localhost
- Check browser permissions (Chrome/Firefox recommended)

### Gemini not detecting handshake
- Ensure good lighting
- Hold handshake stable for 2+ seconds
- Remember: video processes at 1 FPS (be patient)

### Person not recognized
- Include distinctive features in description
- Try "Woman with brown hair, green eyes, glasses"
- Gemini matches by keywords in description

### Transaction failed
- Check testnet balance
- Verify wallet address format (0x...)
- Check `DATABASE_URL` connection

See `SETUP.md` for full troubleshooting guide.

---

## 📚 Documentation

- **SETUP.md** - Complete setup instructions
- **ARCHITECTURE.md** - Original architecture (Azure/Whisper/MediaPipe)
- **GEMINI_ARCHITECTURE.md** - Gemini Live API integration details
- **TECHNICAL_PLAN.md** - Initial technical planning

---

## 🚧 Future Enhancements

- [ ] Mobile app (React Native)
- [ ] Multi-person transactions (split bills)
- [ ] Voice commands ("Send $50 to Alice")
- [ ] AR overlay on Ray-Ban display
- [ ] Multiple blockchain support (Polygon, Solana)
- [ ] Recurring payments
- [ ] Transaction analytics dashboard
- [ ] Fraud detection (voice stress analysis)

---

## 🤝 Contributing

This is a hackathon project, but contributions are welcome!

1. Fork the repo
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

---

## 📄 License

MIT License - see LICENSE file

---

## 🙏 Acknowledgments

- **Google Gemini** - Incredible multimodal AI
- **Web3.js** - Ethereum integration
- **Socket.io** - Real-time communication
- **PostgreSQL** - Reliable database

---

## 📞 Support

- **Gemini Docs:** https://ai.google.dev/gemini-api/docs/live
- **Web3 Docs:** https://docs.web3js.org
- **Issues:** https://github.com/your-repo/issues

---

**Built with ❤️ for the hackathon**

*Making crypto payments as easy as shaking hands*
