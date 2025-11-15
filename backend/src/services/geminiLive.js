const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

class GeminiLiveService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;

    if (!this.apiKey) {
      logger.error('GEMINI_API_KEY not found in .env file');
      throw new Error('GEMINI_API_KEY is required');
    }

    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.activeSessions = new Map();

    // System instruction for transaction monitoring
    this.systemInstruction = `You are an AI payment assistant for Ray-Ban smart glasses crypto payments.

MISSION: Monitor video and audio streams to detect TWO confirmations for crypto transactions:

1. VERBAL CONFIRMATION
   - Listen for payment amount ("$20", "twenty dollars", etc.)
   - Listen for CLEAR agreement from BOTH parties
   - Keywords: "yes", "deal", "agreed", "okay", "sure", "I agree"
   - MUST hear explicit confirmation of the amount
   - Example: "I'll pay you $20" → "Yes, deal!"

2. HANDSHAKE CONFIRMATION
   - Watch for two hands coming together in handshake position
   - Hands should be clasped/gripping
   - MUST be stable for at least 2 seconds (you'll see multiple frames)
   - Confirm it's a proper handshake, not just hands near each other

PERSON IDENTIFICATION:
   - I will provide you with reference photos of enrolled people
   - Compare the person you see in the live video to these reference photos
   - ONLY call identifyPerson() when you clearly recognize someone from the reference photos
   - Call identifyPerson() once when first detected, providing their name and wallet
   - If you don't see anyone, or the person doesn't match enrolled photos, do NOT call identifyPerson()
   - Do NOT mention unknown people - only report enrolled people you recognize

CRITICAL RULES:
   - Call updateStatus() frequently with what you observe
   - Call confirmVerbalAgreement() ONLY when you hear explicit verbal agreement with amount
   - Call confirmHandshake() ONLY when you see a proper, stable handshake
   - Call executeTransaction() ONLY when BOTH verbal AND handshake are confirmed simultaneously
   - If either confirmation is lost (handshake breaks, person retracts agreement), reset that confirmation
   - Always state amounts clearly before executing
   - Provide real-time narration of what you see and hear

RESPONSE STYLE:
   - Brief, real-time updates
   - Clear status on each confirmation
   - Confidence scores (0-1) for detections`;

    // Function definitions for Gemini
    this.tools = [{
      functionDeclarations: [
        {
          name: 'updateStatus',
          description: 'Report current observations from video and audio. Call this frequently to provide real-time updates.',
          parameters: {
            type: 'object',
            properties: {
              visual_observation: {
                type: 'string',
                description: 'What you currently see in the video (people, hands, gestures)'
              },
              audio_observation: {
                type: 'string',
                description: 'What you currently hear (conversation, keywords)'
              },
              person_description: {
                type: 'string',
                description: 'Description of person in frame (if visible)'
              }
            },
            required: ['visual_observation', 'audio_observation']
          }
        },
        {
          name: 'confirmVerbalAgreement',
          description: 'Call this when you detect a CLEAR verbal agreement to a payment with a specific amount.',
          parameters: {
            type: 'object',
            properties: {
              agreed: {
                type: 'boolean',
                description: 'true if agreement is detected, false if retracted'
              },
              amount: {
                type: 'number',
                description: 'Payment amount in USD'
              },
              quote: {
                type: 'string',
                description: 'Exact quote of the verbal agreement'
              },
              confidence: {
                type: 'number',
                description: 'Confidence level 0-1'
              }
            },
            required: ['agreed', 'amount', 'quote', 'confidence']
          }
        },
        {
          name: 'confirmHandshake',
          description: 'Call this when you detect or lose detection of a handshake gesture.',
          parameters: {
            type: 'object',
            properties: {
              handshake_active: {
                type: 'boolean',
                description: 'true if handshake is currently happening, false if stopped'
              },
              description: {
                type: 'string',
                description: 'Description of what you see with the hands'
              },
              confidence: {
                type: 'number',
                description: 'Confidence level 0-1'
              },
              stable_duration: {
                type: 'number',
                description: 'How many seconds the handshake has been stable (estimate)'
              }
            },
            required: ['handshake_active', 'description', 'confidence']
          }
        },
        {
          name: 'identifyPerson',
          description: 'Call this when you recognize an enrolled person from the reference photos. Provide their name and wallet address from the enrolled list.',
          parameters: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name of the identified person (must match an enrolled person)'
              },
              wallet: {
                type: 'string',
                description: 'Wallet address of the identified person'
              },
              confidence: {
                type: 'number',
                description: 'Confidence level 0-1 for the face match'
              }
            },
            required: ['name', 'wallet', 'confidence']
          }
        },
        {
          name: 'executeTransaction',
          description: 'Execute the crypto transaction. ONLY call this when BOTH verbal agreement AND handshake are confirmed simultaneously.',
          parameters: {
            type: 'object',
            properties: {
              person_description: {
                type: 'string',
                description: 'Description of the identified person'
              },
              amount: {
                type: 'number',
                description: 'Payment amount in USD'
              },
              verbal_confirmation_quote: {
                type: 'string',
                description: 'Quote of the verbal agreement'
              },
              handshake_confirmed: {
                type: 'boolean',
                description: 'Handshake is currently active and stable'
              },
              overall_confidence: {
                type: 'number',
                description: 'Overall confidence in all conditions 0-1'
              }
            },
            required: ['person_description', 'amount', 'verbal_confirmation_quote', 'handshake_confirmed', 'overall_confidence']
          }
        }
      ]
    }];
  }

  /**
   * Create a new Gemini Live session using WebSocket connection
   * @param {string} sessionId - Unique session identifier
   * @param {Function} onMessage - Callback for messages from Gemini
   * @param {Function} onFunctionCall - Callback for function calls
   * @returns {Promise<Object>} Session object
   */
  async createSession(sessionId, onMessage, onFunctionCall) {
    try {
      logger.info(`Creating Gemini Live session: ${sessionId}`);

      // Create Live API connection (WebSocket-based)
      const liveSession = await this.genAI.live.connect({
        model: 'models/gemini-2.5-flash-native-audio-preview-09-2025',
        systemInstruction: this.systemInstruction,
        tools: this.tools,
        generationConfig: {
          responseModalities: ['TEXT', 'AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
          }
        }
      });

      const session = {
        id: sessionId,
        liveSession: liveSession,
        onMessage: onMessage,
        onFunctionCall: onFunctionCall,
        audioBuffer: [],
        videoFrameCount: 0,
        lastVideoTime: 0,
        enrollmentSent: false,
        state: {
          personIdentified: false,
          personDescription: null,
          verbalAgreement: false,
          verbalAmount: null,
          verbalQuote: null,
          handshakeActive: false,
          handshakeDuration: 0,
          readyForTransaction: false
        }
      };

      // Set up message handler for incoming responses
      liveSession.on('message', async (message) => {
        await this.handleLiveMessage(sessionId, message);
      });

      // Handle errors
      liveSession.on('error', (error) => {
        logger.error(`Live session ${sessionId} error:`, error);
      });

      // Handle close
      liveSession.on('close', () => {
        logger.info(`Live session ${sessionId} closed`);
        this.activeSessions.delete(sessionId);
      });

      this.activeSessions.set(sessionId, session);
      logger.info(`Session ${sessionId} created successfully`);

      return session;
    } catch (error) {
      logger.error(`Error creating session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Send enrolled people reference photos to Gemini
   * @param {string} sessionId - Session ID
   * @param {Array} enrolledPeople - Array of enrolled people with photos
   */
  async sendEnrolledPeople(sessionId, enrolledPeople) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!enrolledPeople || enrolledPeople.length === 0) {
      logger.info(`No enrolled people to send for session ${sessionId}`);
      return;
    }

    try {
      logger.info(`Sending ${enrolledPeople.length} enrolled people to Gemini`);

      // Build enrollment message with all photos
      const parts = [];

      // Add text introduction
      const intro = `ENROLLED PEOPLE REFERENCE PHOTOS:\n\n${enrolledPeople.map(p =>
        `- ${p.name} (Wallet: ${p.wallet}) - ${p.photoCount} photos`
      ).join('\n')}\n\nI will now show you reference photos for each person. Compare these to the live video stream.`;

      parts.push({ text: intro });

      // Add all photos with labels
      for (const person of enrolledPeople) {
        parts.push({ text: `\n\nReference photos for ${person.name}:` });

        for (let i = 0; i < person.photos.length; i++) {
          const base64Data = person.photos[i].replace(/^data:image\/\w+;base64,/, '');
          parts.push({
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data
            }
          });
        }
      }

      // Send all enrollment data in one message
      await session.liveSession.send(parts);
      session.enrollmentSent = true;

      logger.info(`All enrolled people photos sent to session ${sessionId}`);
    } catch (error) {
      logger.error(`Error sending enrolled people to session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Send video frame to Gemini (1 FPS)
   * @param {string} sessionId - Session ID
   * @param {string} imageData - Base64 encoded image
   */
  async sendVideoFrame(sessionId, imageData) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      // Throttle to ~1 FPS
      const now = Date.now();
      if (now - session.lastVideoTime < 1000) {
        return; // Skip this frame
      }
      session.lastVideoTime = now;
      session.videoFrameCount++;

      // Remove data URI prefix if present
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');

      // Send to Gemini Live API
      await session.liveSession.send([
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data
          }
        },
        {
          text: `[Video Frame ${session.videoFrameCount}] Analyze this frame. What do you see? Report status.`
        }
      ]);
    } catch (error) {
      logger.error(`Error sending video frame for ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Send audio chunk to Gemini
   * @param {string} sessionId - Session ID
   * @param {string} audioData - Base64 encoded audio (PCM 16-bit, 16kHz)
   */
  async sendAudioChunk(sessionId, audioData) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      // Remove data URI prefix if present
      const base64Data = audioData.replace(/^data:audio\/\w+;base64,/, '');

      // Send directly to Live API (it handles audio streaming natively)
      await session.liveSession.send([
        {
          inlineData: {
            mimeType: 'audio/pcm;rate=16000',
            data: base64Data
          }
        }
      ]);
    } catch (error) {
      logger.error(`Error sending audio for ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Send combined video + audio message
   * @param {string} sessionId - Session ID
   * @param {string} videoData - Base64 encoded image
   * @param {string} audioData - Base64 encoded audio
   */
  async sendMultimodalChunk(sessionId, videoData, audioData) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      const parts = [];

      if (videoData) {
        const videoBase64 = videoData.replace(/^data:image\/\w+;base64,/, '');
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: videoBase64
          }
        });
      }

      if (audioData) {
        const audioBase64 = audioData.replace(/^data:audio\/\w+;base64,/, '');
        parts.push({
          inlineData: {
            mimeType: 'audio/pcm;rate=16000',
            data: audioBase64
          }
        });
      }

      parts.push({
        text: 'Analyze what you see and hear. Update me on the status of: 1) Person identification, 2) Verbal agreement, 3) Handshake. Are both confirmations present?'
      });

      await session.liveSession.send(parts);
    } catch (error) {
      logger.error(`Error sending multimodal chunk for ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Handle incoming message from Gemini Live API
   */
  async handleLiveMessage(sessionId, message) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      // Check for function calls
      if (message.toolCall) {
        const functionCall = message.toolCall.functionCalls[0];
        logger.info(`Function call: ${functionCall.name}`, functionCall.args);

        // Update session state based on function calls
        this.updateSessionState(session, functionCall);

        // Execute function call handler
        if (session.onFunctionCall) {
          const functionResponse = await session.onFunctionCall(functionCall.name, functionCall.args);

          // Send function response back to Gemini
          if (functionResponse) {
            await session.liveSession.send([{
              functionResponse: {
                name: functionCall.name,
                response: functionResponse
              }
            }]);
          }
        }
      }

      // Check for text response
      if (message.text && session.onMessage) {
        session.onMessage(message.text);
      }

      // Check for audio response (if needed later)
      if (message.inlineData && message.inlineData.mimeType?.startsWith('audio/')) {
        logger.debug('Received audio response from Gemini');
        // Could forward audio back to client if needed
      }

      logger.debug(`Gemini response:`, message);
    } catch (error) {
      logger.error('Error handling Gemini message:', error);
    }
  }

  /**
   * Update session state based on function calls
   */
  updateSessionState(session, functionCall) {
    const { name, args } = functionCall;

    switch (name) {
      case 'identifyPerson':
        session.state.personIdentified = true;
        session.state.personDescription = args.description;
        break;

      case 'confirmVerbalAgreement':
        session.state.verbalAgreement = args.agreed;
        session.state.verbalAmount = args.amount;
        session.state.verbalQuote = args.quote;
        break;

      case 'confirmHandshake':
        session.state.handshakeActive = args.handshake_active;
        session.state.handshakeDuration = args.stable_duration || 0;
        break;

      case 'executeTransaction':
        session.state.readyForTransaction =
          args.handshake_confirmed &&
          session.state.verbalAgreement;
        break;
    }

    logger.debug(`Session ${session.id} state updated:`, session.state);
  }

  /**
   * Get session state
   */
  getSessionState(sessionId) {
    const session = this.activeSessions.get(sessionId);
    return session ? session.state : null;
  }

  /**
   * Close session
   */
  closeSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      if (session.liveSession) {
        session.liveSession.close();
      }
      this.activeSessions.delete(sessionId);
      logger.info(`Session ${sessionId} closed`);
    }
  }

  /**
   * List active sessions
   */
  getActiveSessions() {
    return Array.from(this.activeSessions.keys());
  }
}

module.exports = new GeminiLiveService();
