const logger = require('../utils/logger');

/**
 * Handshake Detection Service
 *
 * This service processes hand landmark data from the frontend
 * (MediaPipe Hands runs in browser and sends hand positions via WebSocket)
 *
 * Alternative: Could use Google Cloud Vision API or custom ML model
 */
class HandshakeDetectionService {
  constructor() {
    this.stableFramesRequired = 30; // ~1 second at 30 FPS
    this.maxHandDistance = 0.15; // Maximum distance between hands (normalized 0-1)
    this.minConfidence = 0.7; // Minimum detection confidence
  }

  /**
   * Detect handshake from MediaPipe hand landmarks
   * @param {Array} hands - Array of hand objects with landmarks
   * @returns {Object} Detection result
   */
  detectHandshake(hands) {
    // Need exactly 2 hands for handshake
    if (!hands || hands.length !== 2) {
      return {
        detected: false,
        confidence: 0,
        reason: hands?.length === 0 ? 'No hands detected' :
                hands?.length === 1 ? 'Only one hand detected' :
                'More than 2 hands detected'
      };
    }

    const hand1 = hands[0];
    const hand2 = hands[1];

    // Verify both hands have landmarks
    if (!hand1.landmarks || !hand2.landmarks) {
      return {
        detected: false,
        confidence: 0,
        reason: 'Missing landmark data'
      };
    }

    // Get palm centers (landmark index 9 = middle finger base)
    const palm1 = hand1.landmarks[9];
    const palm2 = hand2.landmarks[9];

    // Calculate Euclidean distance between palms
    const distance = Math.sqrt(
      Math.pow(palm1.x - palm2.x, 2) +
      Math.pow(palm1.y - palm2.y, 2) +
      Math.pow((palm1.z || 0) - (palm2.z || 0), 2)
    );

    // Check if hands are close enough
    if (distance > this.maxHandDistance) {
      return {
        detected: false,
        confidence: 0,
        distance,
        reason: `Hands too far apart (${distance.toFixed(3)} > ${this.maxHandDistance})`
      };
    }

    // Check hand orientation (hands should be facing each other)
    const orientationMatch = this.checkHandOrientation(hand1, hand2);

    if (!orientationMatch.match) {
      return {
        detected: false,
        confidence: 0,
        distance,
        reason: 'Hands not properly oriented for handshake'
      };
    }

    // Calculate confidence based on distance and orientation
    const distanceConfidence = 1 - (distance / this.maxHandDistance);
    const confidence = (distanceConfidence + orientationMatch.confidence) / 2;

    return {
      detected: true,
      confidence,
      distance,
      orientation: orientationMatch,
      reason: 'Handshake detected'
    };
  }

  /**
   * Check if hands are oriented towards each other
   * @param {Object} hand1 - First hand data
   * @param {Object} hand2 - Second hand data
   * @returns {Object} Orientation match result
   */
  checkHandOrientation(hand1, hand2) {
    // Get wrist (landmark 0) and middle finger base (landmark 9)
    const wrist1 = hand1.landmarks[0];
    const palm1 = hand1.landmarks[9];
    const wrist2 = hand2.landmarks[0];
    const palm2 = hand2.landmarks[9];

    // Calculate hand direction vectors
    const dir1 = {
      x: palm1.x - wrist1.x,
      y: palm1.y - wrist1.y
    };

    const dir2 = {
      x: palm2.x - wrist2.x,
      y: palm2.y - wrist2.y
    };

    // Calculate dot product (should be negative if hands face each other)
    const dotProduct = dir1.x * dir2.x + dir1.y * dir2.y;

    // Normalize by vector magnitudes
    const mag1 = Math.sqrt(dir1.x * dir1.x + dir1.y * dir1.y);
    const mag2 = Math.sqrt(dir2.x * dir2.x + dir2.y * dir2.y);
    const normalizedDot = dotProduct / (mag1 * mag2);

    // If dot product is negative and close to -1, hands are facing each other
    const facingEachOther = normalizedDot < 0;
    const confidence = facingEachOther ? Math.abs(normalizedDot) : 0;

    return {
      match: facingEachOther && confidence > 0.3,
      confidence,
      dotProduct: normalizedDot
    };
  }

  /**
   * Track handshake stability over multiple frames
   * @param {string} sessionId - Session identifier
   * @param {Object} detection - Current frame detection result
   * @returns {Object} Stability result
   */
  trackStability(sessionId, detection) {
    if (!this.sessions) {
      this.sessions = new Map();
    }

    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        stableFrames: 0,
        lastDetection: null,
        confirmed: false
      });
    }

    const session = this.sessions.get(sessionId);

    if (detection.detected) {
      session.stableFrames++;
      session.lastDetection = Date.now();

      // Check if we've reached stability threshold
      if (session.stableFrames >= this.stableFramesRequired && !session.confirmed) {
        session.confirmed = true;
        logger.info(`Handshake confirmed for session ${sessionId} after ${session.stableFrames} frames`);

        return {
          stable: true,
          confirmed: true,
          frames: session.stableFrames,
          confidence: detection.confidence
        };
      }

      return {
        stable: false,
        confirmed: false,
        frames: session.stableFrames,
        progress: session.stableFrames / this.stableFramesRequired,
        confidence: detection.confidence
      };
    } else {
      // Reset if handshake is lost
      if (session.stableFrames > 0) {
        logger.debug(`Handshake lost for session ${sessionId} after ${session.stableFrames} frames`);
      }
      session.stableFrames = 0;
      session.confirmed = false;

      return {
        stable: false,
        confirmed: false,
        frames: 0,
        progress: 0
      };
    }
  }

  /**
   * Reset session tracking
   * @param {string} sessionId - Session identifier
   */
  resetSession(sessionId) {
    if (this.sessions && this.sessions.has(sessionId)) {
      this.sessions.delete(sessionId);
      logger.info(`Session ${sessionId} reset`);
    }
  }

  /**
   * Get session status
   * @param {string} sessionId - Session identifier
   */
  getSessionStatus(sessionId) {
    if (!this.sessions || !this.sessions.has(sessionId)) {
      return null;
    }
    return this.sessions.get(sessionId);
  }

  /**
   * Clean up old sessions (call periodically)
   * @param {number} maxAge - Maximum age in milliseconds (default: 5 minutes)
   */
  cleanupOldSessions(maxAge = 5 * 60 * 1000) {
    if (!this.sessions) return;

    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastDetection && (now - session.lastDetection > maxAge)) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old handshake sessions`);
    }
  }
}

module.exports = new HandshakeDetectionService();
