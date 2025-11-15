# Ray-Ban Crypto Payment Hackathon - Technical Plan

## Project Overview
Enable crypto payments through Ray-Ban glasses by:
1. Recognizing the person in frame → Look up wallet address
2. Detecting verbal agreement to payment
3. Detecting handshake gesture
4. Triggering crypto transaction when all conditions met

---

## Component 1: Face Recognition

### Options Comparison

#### Option A: Face-api.js ⭐ RECOMMENDED FOR HACKATHON
**Pros:**
- Runs entirely in browser (no API costs)
- Fast setup (~30 mins)
- Good accuracy for controlled environments
- Built-in face detection + recognition
- Can process video stream in real-time
- Create face descriptors from reference images

**Cons:**
- Less accurate than cloud APIs in challenging conditions
- Requires multiple reference photos per person

**Implementation:**
```javascript
// 1. Enrollment: Take 5-10 photos of each person
// 2. Extract face descriptors
// 3. Store descriptors + wallet address in localStorage
// 4. Real-time: Match video frames against known descriptors
// 5. Confidence threshold: >0.6 = match
```

**Speed:** 10-30ms per frame on modern hardware

#### Option B: Cloud APIs (Azure Face, AWS Rekognition)
**Pros:**
- Highest accuracy
- Robust to lighting/angles
- Pre-built enrollment systems

**Cons:**
- API costs (though free tiers exist)
- Latency (network round-trip)
- Requires internet connection
- More setup complexity

**Speed:** 200-500ms per API call

#### Option C: TensorFlow.js + FaceNet
**Pros:**
- Good accuracy
- Customizable

**Cons:**
- More complex setup
- Larger model files
- Not optimized for hackathon speed

### RECOMMENDATION: Face-api.js
**Why:** Perfect balance of speed, cost (free), and accuracy for a hackathon. Can run continuously on video stream.

---

## Component 2: Audio Agreement Detection

### Options Comparison

#### Option A: Web Speech API ⭐ RECOMMENDED FOR HACKATHON
**Pros:**
- Built into modern browsers (FREE)
- Real-time continuous recognition
- No API costs
- Simple keyword detection
- Low latency

**Cons:**
- Accuracy varies by browser
- Limited to supported languages
- Requires internet (uses Google's servers)

**Implementation:**
```javascript
// 1. Start continuous recognition
// 2. Listen for keywords: "yes", "agree", "confirmed", "deal"
// 3. Context aware: "I agree to pay", "$20", etc.
// 4. Set agreementDetected = true when pattern matches
```

**Accuracy:** ~85-95% for clear speech

#### Option B: OpenAI Whisper API
**Pros:**
- Very high accuracy
- Multiple languages
- Better transcription quality

**Cons:**
- Costs money (~$0.006/minute)
- Higher latency
- Requires chunking audio

#### Option C: AssemblyAI Real-time
**Pros:**
- Real-time streaming
- Good accuracy
- Free tier available

**Cons:**
- More complex setup
- WebSocket connection needed

### RECOMMENDATION: Web Speech API
**Why:** Free, built-in, real-time, perfect for simple agreement detection. Save money for crypto transactions!

---

## Component 3: Handshake Detection

### Options Comparison

#### Option A: MediaPipe Hands ⭐ RECOMMENDED FOR HACKATHON
**Pros:**
- FREE and runs in browser
- Extremely fast (60+ FPS)
- Accurate hand tracking (21 keypoints per hand)
- Detects multiple hands
- Easy to detect handshake (hand proximity + orientation)

**Cons:**
- Needs clear view of hands
- May struggle with motion blur

**Implementation:**
```javascript
// 1. Track both hands in frame
// 2. Get hand landmarks (palm center, wrist positions)
// 3. Calculate distance between hands
// 4. If distance < threshold + hands oriented correctly = handshake
// 5. Require stable detection for 1-2 seconds
```

**Speed:** Real-time at 30-60 FPS

#### Option B: Pose Detection (MediaPipe Pose)
**Pros:**
- Can track full body pose
- Includes hand positions

**Cons:**
- Less precise for hands
- Overkill for this use case

#### Option C: Custom YOLO Model
**Pros:**
- Could be highly accurate

**Cons:**
- Requires training data
- Days of work
- Not feasible for hackathon

### RECOMMENDATION: MediaPipe Hands
**Why:** Purpose-built for hand tracking, free, real-time, perfect accuracy for handshake detection.

---

## Optimal Architecture for Hackathon

### Tech Stack
```
Frontend (Browser):
├── Face Recognition: Face-api.js
├── Handshake Detection: MediaPipe Hands
├── Audio Processing: Web Speech API
├── UI: Vanilla JS (already built)
└── Storage: IndexedDB (for face descriptors + wallet mappings)

Backend (Simple):
├── Crypto Transaction API
└── Optional: Database for user/wallet mappings
```

### Data Flow

```
Ray-Ban Glasses Stream
         ↓
    Browser App
         ↓
    ┌────┴────┐
    │         │
Face Rec   Audio    Handshake
(face-api) (Speech) (MediaPipe)
    │         │         │
    ↓         ↓         ↓
 Person   Agreement  Handshake
   ID     Detected   Detected
    │         │         │
    └────┬────┴────┬────┘
         ↓
   All Conditions Met?
         ↓
   Transaction UI
         ↓
   Backend API → Blockchain
```

### State Machine

```javascript
{
  personInFrame: null,          // { name, wallet, confidence }
  agreementDetected: false,     // true when verbal agreement heard
  handshakeDetected: false,     // true when handshake seen
  transactionAmount: null,      // extracted from speech
  readyToTransact: false        // all conditions met
}
```

---

## Implementation Plan (Estimated Time)

### Phase 1: Face Recognition (2-3 hours)
1. ✅ Integrate face-api.js library
2. ✅ Build enrollment UI (camera + capture)
3. ✅ Store face descriptors with wallet addresses
4. ✅ Implement continuous face matching
5. ✅ Display person info when recognized

### Phase 2: Audio Detection (1-2 hours)
1. ✅ Integrate Web Speech API
2. ✅ Continuous transcription
3. ✅ Pattern matching for agreements
4. ✅ Extract transaction amount from speech
5. ✅ Visual feedback when agreement detected

### Phase 3: Handshake Detection (2-3 hours)
1. ✅ Integrate MediaPipe Hands
2. ✅ Track both hands
3. ✅ Calculate hand proximity
4. ✅ Detect handshake gesture
5. ✅ Require stable detection (1-2 sec)

### Phase 4: Integration (1-2 hours)
1. ✅ Combine all three conditions
2. ✅ Transaction confirmation UI
3. ✅ Backend API integration
4. ✅ Error handling & edge cases

**Total: 6-10 hours** (Perfect for hackathon!)

---

## Face Enrollment Strategy

### For Hackathon Speed:

**Simple Approach:**
1. Add "Enroll Person" page
2. Capture 5-10 photos of each person
3. Different angles: front, left, right, slight up, slight down
4. Extract face descriptors from each photo
5. Average/combine descriptors
6. Store: `{ name: "Alice", wallet: "0x123...", descriptors: [...] }`

**During Recognition:**
1. Detect face in each frame (30 FPS)
2. Extract descriptor
3. Compare against all known descriptors
4. Use Euclidean distance < 0.6 = match
5. Show confidence score
6. Lock in after 10 consecutive matches (avoid flickers)

---

## Audio Pattern Matching

### Agreement Detection Patterns:

**Simple Keyword Matching:**
```javascript
const agreementKeywords = [
  'yes', 'yeah', 'yep', 'sure',
  'agree', 'agreed', 'confirmed',
  'ok', 'okay', 'deal', 'sounds good'
];
```

**Context-Aware (Better):**
```javascript
// Look for patterns like:
- "I agree to [amount]"
- "Yes, [amount] sounds good"
- "Deal for [amount]"
- "I'll pay you [amount]"
```

**Amount Extraction:**
```javascript
// Regex: /\$?\d+(\.\d{2})?/
// Or word matching: "twenty dollars", "five bucks"
```

---

## Handshake Detection Algorithm

### MediaPipe Hand Landmarks:
- 21 keypoints per hand
- Keypoint 0 = wrist
- Keypoint 9 = middle finger base (palm center)

### Detection Logic:
```javascript
function isHandshake(hand1, hand2) {
  // 1. Both hands detected
  if (!hand1 || !hand2) return false;

  // 2. Calculate palm center distance
  const distance = euclideanDistance(
    hand1.landmarks[9],
    hand2.landmarks[9]
  );

  // 3. Hands should be close (0.1 - 0.2 in normalized coords)
  if (distance > 0.2) return false;

  // 4. Hands should be oriented towards each other
  // Check wrist-to-palm vectors are opposing
  const orientation = checkOrientation(hand1, hand2);
  if (!orientation) return false;

  // 5. Stable for 30 frames (~1 second)
  return checkStability(30);
}
```

---

## Edge Cases to Handle

### Face Recognition:
- ❌ No face in frame → Show "Waiting for person..."
- ❌ Multiple faces → Pick closest/largest
- ❌ Low confidence → "Unable to recognize"
- ❌ Unknown person → "Unknown person detected"

### Audio:
- ❌ Background noise → May cause false positives (add confidence threshold)
- ❌ Mishearing → Require confirmation UI
- ❌ No speech → Timeout after 30 seconds

### Handshake:
- ❌ One hand only → Wait for second hand
- ❌ Hands moving too fast → Require stability
- ❌ Wrong gesture → Check orientation
- ❌ Occlusion → Require clear view

### Transaction:
- ❌ Amount mismatch → Show amount for confirmation
- ❌ Wrong person → Verify identity
- ❌ Network error → Retry logic
- ❌ Insufficient funds → Show error

---

## Testing Strategy

### Face Recognition Testing:
1. Enroll 2-3 test people
2. Test different angles
3. Test different lighting
4. Test with/without glasses
5. Test distance from camera

### Audio Testing:
1. Test quiet environment
2. Test with background noise
3. Test different phrasings
4. Test amount extraction accuracy

### Handshake Testing:
1. Test different handshake styles
2. Test different speeds
3. Test different hand positions
4. Test stability threshold

---

## Libraries & CDN Links

```html
<!-- Face-api.js -->
<script src="https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.min.js"></script>

<!-- MediaPipe Hands -->
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"></script>

<!-- Web Speech API is built-in (no CDN needed) -->
```

---

## Performance Targets

- **Face Recognition:** 30 FPS (33ms/frame)
- **Handshake Detection:** 30 FPS (33ms/frame)
- **Audio Processing:** Real-time streaming
- **Total CPU Usage:** <50% on modern laptop
- **Memory:** <500MB

---

## Future Enhancements (Post-Hackathon)

1. **Multi-person transactions** (split bills)
2. **Voice confirmation** ("Send $20 to Alice")
3. **Gesture controls** (thumbs up/down for confirm/cancel)
4. **Transaction history** with video clips
5. **Fraud detection** (analyze voice stress, eye contact)
6. **Offline mode** (store transactions, sync later)
7. **AR overlay** on Ray-Ban glasses (show wallet balance)

---

## Recommended Approach: FULL STACK

**Frontend:** Browser app with all 3 detection systems
**Backend:** Simple API for crypto transactions
**Storage:** IndexedDB for face descriptors, PostgreSQL for wallet mappings
**Deployment:** Vercel/Netlify (frontend), Railway/Render (backend)

**This gives you:**
- ✅ Fast development
- ✅ Low cost (mostly free)
- ✅ Real-time performance
- ✅ Easy to demo
- ✅ Scalable if needed

---

## Next Steps

1. Integrate face-api.js
2. Build enrollment flow
3. Add MediaPipe Hands
4. Implement Web Speech API
5. Combine all conditions
6. Build transaction UI
7. Connect to crypto backend
8. Test end-to-end
9. Polish UI/UX
10. Demo! 🚀
