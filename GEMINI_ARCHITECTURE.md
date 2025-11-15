# Ray-Ban Crypto Payments - Gemini Live API Architecture

## Why Gemini Live API is Perfect for This Project

### Advantages
1. **Unified Multimodal Processing** - Single API handles both video AND audio streams
2. **Real-time Understanding** - See and hear simultaneously, understand context
3. **Function Calling** - Directly trigger crypto transactions when conditions met
4. **Lower Latency** - WebSocket-based, no multiple API round trips
5. **Contextual Awareness** - Can understand "I'll pay you $20 for that" while seeing handshake
6. **Cost Effective** - Single API instead of Azure Face + Whisper + MediaPipe

### How It Solves Our Use Case

**Traditional Approach:**
```
Video → Azure Face API → Person ID
Audio → Whisper API → Transcript → NLP → Agreement
Video → MediaPipe → Handshake Detection
→ Combine 3 results → Trigger transaction
```

**Gemini Live API Approach:**
```
Video + Audio Stream → Gemini Live API
                     ↓
        "I see Alice shaking hands with someone.
         I heard: 'I'll pay you $20. Yes, deal!'
         Conditions met."
                     ↓
        Function Call: executeTransaction(person="Alice", amount=20)
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Ray-Ban Glasses Stream                    │
│                    (Video 1 FPS + Audio)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Browser Frontend                           │
│  ┌──────────────────────────────────────────────┐          │
│  │   MediaStream API (Camera + Microphone)      │          │
│  │   - Capture video @ 1 FPS                    │          │
│  │   - Capture audio @ 16kHz PCM                │          │
│  └────────────────────┬─────────────────────────┘          │
│                       │                                     │
│                       │ WebSocket                           │
└───────────────────────┼─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend Server (Node.js)                       │
│  ┌──────────────────────────────────────────────┐          │
│  │         WebSocket Handler (Socket.io)        │          │
│  │   - Receive video frames (base64)            │          │
│  │   - Receive audio chunks (PCM)               │          │
│  └────────────────────┬─────────────────────────┘          │
│                       │                                     │
│                       ▼                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │       Gemini Live API Client (WebSocket)            │   │
│  │                                                      │   │
│  │  System Instructions:                               │   │
│  │  "You are a payment assistant. Monitor video/audio  │   │
│  │   for: 1) Person identity (face recognition)        │   │
│  │        2) Verbal agreement to payment               │   │
│  │        3) Handshake gesture                         │   │
│  │   When all 3 detected, call executeTransaction."    │   │
│  │                                                      │   │
│  │  Available Functions:                               │   │
│  │  - identifyPerson(face_description)                 │   │
│  │  - detectHandshake(visual_description)              │   │
│  │  - executeTransaction(person, amount, confidence)   │   │
│  └────────────────────┬────────────────────────────────┘   │
│                       │                                     │
│                       ▼                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          Transaction Orchestrator                   │   │
│  │  - Validate function calls                          │   │
│  │  - Check all conditions met                         │   │
│  │  - Execute crypto transaction                       │   │
│  │  - Store in database                                │   │
│  └────────────────────┬────────────────────────────────┘   │
└────────────────────────┼────────────────────────────────────┘
                         │
                         ▼
           ┌──────────────┬────────────────┐
           │              │                │
      PostgreSQL      Web3.js          Frontend
      (User DB)    (Blockchain)      (UI Update)
```

---

## System Prompt Strategy

### Initial System Instructions

```
You are an AI payment assistant for a Ray-Ban smart glasses payment system.

CONTEXT:
- You receive real-time video (1 FPS) and audio from Ray-Ban glasses
- Users can make crypto payments through verbal agreement and handshake
- You have access to a database of enrolled people with their wallet addresses

YOUR ROLE:
Monitor the video and audio streams for three conditions:

1. PERSON IDENTIFICATION
   - Look for a person's face in the video
   - Compare against enrolled people descriptions
   - Call identifyPerson(face_description) with what you see
   - Wait for confirmation of identity

2. VERBAL AGREEMENT
   - Listen for payment amount ("$20", "twenty dollars", etc.)
   - Listen for agreement keywords ("yes", "deal", "agreed", "okay")
   - Require both parties to verbally agree

3. HANDSHAKE DETECTION
   - Watch for two hands coming together
   - Confirm handshake gesture is occurring
   - Require stable handshake for at least 2 seconds

TRANSACTION TRIGGER:
When ALL three conditions are met simultaneously:
- Person is identified
- Verbal agreement to specific amount is confirmed
- Handshake is observed

Call: executeTransaction(person_id, amount, confidence_score)

IMPORTANT RULES:
- Never execute transaction without all 3 conditions
- Always state the amount clearly before executing
- If unsure about identity, ask for confirmation
- If handshake breaks before agreement, reset
- Provide real-time feedback on what you observe

RESPONSE STYLE:
- Brief and clear
- Real-time status updates
- Confirm when each condition is met
```

---

## Function Definitions

### 1. identifyPerson

```json
{
  "name": "identifyPerson",
  "description": "Identify a person in the video by describing their appearance. Returns their name and wallet address if enrolled.",
  "parameters": {
    "type": "object",
    "properties": {
      "face_description": {
        "type": "string",
        "description": "Detailed description of the person's face, hair, glasses, etc."
      },
      "confidence": {
        "type": "number",
        "description": "Confidence level 0-1"
      }
    },
    "required": ["face_description"]
  }
}
```

### 2. checkHandshake

```json
{
  "name": "checkHandshake",
  "description": "Report when a handshake gesture is detected in the video.",
  "parameters": {
    "type": "object",
    "properties": {
      "is_handshake": {
        "type": "boolean",
        "description": "True if handshake is occurring"
      },
      "description": {
        "type": "string",
        "description": "What you see in the video regarding hand positions"
      },
      "confidence": {
        "type": "number",
        "description": "Confidence level 0-1"
      }
    },
    "required": ["is_handshake"]
  }
}
```

### 3. executeTransaction

```json
{
  "name": "executeTransaction",
  "description": "Execute a crypto payment when all conditions are met: person identified, verbal agreement, and handshake.",
  "parameters": {
    "type": "object",
    "properties": {
      "person_name": {
        "type": "string",
        "description": "Name of identified recipient"
      },
      "amount": {
        "type": "number",
        "description": "Payment amount in USD"
      },
      "verbal_confirmation": {
        "type": "string",
        "description": "Quote of the verbal agreement"
      },
      "handshake_confirmed": {
        "type": "boolean",
        "description": "Handshake is currently happening"
      },
      "confidence": {
        "type": "number",
        "description": "Overall confidence in all conditions 0-1"
      }
    },
    "required": ["person_name", "amount", "verbal_confirmation", "handshake_confirmed"]
  }
}
```

---

## Enrollment Strategy

Since Gemini processes video at 1 FPS and doesn't have a built-in face database, we need a hybrid approach:

### Option A: Description-Based Matching (Simplest)

1. **Enrollment Process:**
   - Capture 3-5 photos of person
   - Send to Gemini: "Describe this person's appearance in detail"
   - Store description + wallet in database
   ```json
   {
     "name": "Alice",
     "wallet": "0x123...",
     "description": "Young woman with brown hair, green eyes, wearing glasses..."
   }
   ```

2. **Recognition Process:**
   - Gemini describes person in video
   - Backend compares description to stored descriptions
   - Use embeddings for semantic matching
   - Return best match if confidence > threshold

### Option B: Hybrid with Azure Face (More Accurate)

1. Use Gemini for video/audio/handshake
2. Use Azure Face API separately for face recognition
3. Combine results

**Recommended: Option A for hackathon** (simpler, single API)

---

## Message Flow

### 1. Session Setup

**Client → Backend:**
```json
{
  "action": "start_session",
  "mode": "transaction"
}
```

**Backend → Gemini:**
```json
{
  "setup": {
    "model": "gemini-2.0-flash-exp",
    "generationConfig": {
      "responseModalities": ["TEXT"],
      "speechConfig": {
        "voiceConfig": { "prebuiltVoiceConfig": { "voiceName": "Puck" }}
      }
    },
    "systemInstruction": {
      "parts": [{ "text": "..." }]
    },
    "tools": [{
      "functionDeclarations": [
        { identifyPerson }, { checkHandshake }, { executeTransaction }
      ]
    }]
  }
}
```

### 2. Streaming Video/Audio

**Client → Backend (30 times/sec for audio, 1 time/sec for video):**
```json
{
  "type": "media",
  "video": "base64_encoded_frame",  // Only 1 FPS
  "audio": "base64_encoded_pcm_chunk"  // 16kHz chunks
}
```

**Backend → Gemini:**
```json
{
  "realtimeInput": {
    "mediaChunks": [
      {
        "mimeType": "image/jpeg",
        "data": "base64_video_frame"
      },
      {
        "mimeType": "audio/pcm",
        "data": "base64_audio_chunk"
      }
    ]
  }
}
```

### 3. Gemini Responses

**Gemini → Backend (Status Updates):**
```json
{
  "serverContent": {
    "modelTurn": {
      "parts": [{
        "text": "I see a person entering the frame. They appear to be a woman with brown hair. No handshake yet. Listening for payment discussion..."
      }]
    },
    "turnComplete": false
  }
}
```

**Gemini → Backend (Function Call):**
```json
{
  "toolCall": {
    "functionCalls": [{
      "name": "identifyPerson",
      "args": {
        "face_description": "Woman with brown hair, green eyes, wearing glasses",
        "confidence": 0.85
      }
    }]
  }
}
```

### 4. Function Execution

**Backend Processing:**
```javascript
// Receive function call from Gemini
if (functionCall.name === "identifyPerson") {
  // Query database for matching description
  const person = await findPersonByDescription(args.face_description);

  // Return result to Gemini
  return {
    "toolCallResponse": {
      "functionResponses": [{
        "name": "identifyPerson",
        "response": {
          "name": person.name,
          "wallet": person.wallet,
          "confidence": person.matchConfidence
        }
      }]
    }
  };
}
```

### 5. Transaction Execution

**Gemini → Backend:**
```json
{
  "toolCall": {
    "functionCalls": [{
      "name": "executeTransaction",
      "args": {
        "person_name": "Alice",
        "amount": 20,
        "verbal_confirmation": "Yes, I agree to pay $20",
        "handshake_confirmed": true,
        "confidence": 0.92
      }
    }]
  }
}
```

**Backend → Web3:**
```javascript
const txHash = await cryptoService.sendTransaction(
  person.wallet,
  amount,
  { evidence: { audio: transcript, video: frameCapture }}
);

// Store in DB
await db.transaction.create({...});

// Notify frontend
io.emit('transaction:complete', { txHash, amount, recipient });
```

---

## Implementation Files

### backend/src/services/geminiLive.js
Main service for Gemini Live API integration

### backend/src/controllers/geminiStreamController.js
WebSocket handler for video/audio streaming

### frontend/js/geminiStreamManager.js
Browser-side media capture and streaming

---

## Performance Considerations

1. **Video FPS:** Gemini processes at 1 FPS
   - Sufficient for face recognition and handshake
   - Not suitable for fast-moving scenarios

2. **Audio Latency:** ~200-500ms
   - Real-time enough for conversation

3. **Function Call Latency:** ~500ms-1s
   - Acceptable for transaction confirmation

4. **Total Pipeline:** ~2-3 seconds from handshake to transaction

---

## Cost Estimation

### Gemini 2.0 Flash Pricing
- Input: ~$0.10 per million tokens
- Output: ~$0.40 per million tokens
- Video: ~1 FPS = 60 frames/min
- Audio: ~16kHz continuous

**Estimated cost per transaction:**
- Video processing: ~$0.01
- Audio processing: ~$0.01
- Function calls: minimal
- **Total: ~$0.02 per transaction**

Much cheaper than Azure Face ($1/1000) + Whisper ($0.006/min)!

---

## Next Steps

1. ✅ Set up Gemini API access
2. ✅ Create WebSocket client for Gemini Live API
3. ✅ Implement function calling handlers
4. ✅ Build frontend streaming
5. ✅ Test enrollment flow
6. ✅ Test transaction flow end-to-end
7. ✅ Deploy and demo!
