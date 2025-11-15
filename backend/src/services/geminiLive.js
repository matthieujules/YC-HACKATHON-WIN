const { GoogleGenAI } = require('@google/genai');
const logger = require('../utils/logger');

class GeminiLiveService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;

    if (!this.apiKey) {
      logger.error('GEMINI_API_KEY not found in .env file');
      throw new Error('GEMINI_API_KEY is required');
    }

    this.genAI = new GoogleGenAI({ apiKey: this.apiKey });
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
   - Call updateStatus() EVERY TIME you receive a new video frame - provide constant visual commentary
   - Describe what you see in the video in EVERY update
   - Call confirmVerbalAgreement() ONLY when you hear explicit verbal agreement with amount
   - Call confirmHandshake() ONLY when you see a proper, stable handshake
   - Call executeTransaction() ONLY when BOTH verbal AND handshake are confirmed simultaneously
   - If either confirmation is lost (handshake breaks, person retracts agreement), reset that confirmation
   - Always state amounts clearly before executing
   - Provide real-time narration of what you see and hear

RESPONSE STYLE:
   - Brief, real-time updates EVERY frame
   - Always describe the visual scene
   - Clear status on each confirmation
   - Confidence scores (0-1) for detections`;

    // Function definitions for Gemini
    this.tools = [{
      functionDeclarations: [
        {
          name: 'updateStatus',
          description: 'Report current observations from video and audio. Call this frequently to provide real-time updates.',
          parameters: {
            type: 'OBJECT',
            properties: {
              visual_observation: {
                type: 'STRING',
                description: 'What you currently see in the video (people, hands, gestures)'
              },
              audio_observation: {
                type: 'STRING',
                description: 'What you currently hear (conversation, keywords)'
              },
              person_description: {
                type: 'STRING',
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
            type: 'OBJECT',
            properties: {
              agreed: {
                type: 'BOOLEAN',
                description: 'true if agreement is detected, false if retracted'
              },
              amount: {
                type: 'NUMBER',
                description: 'Payment amount in USD'
              },
              quote: {
                type: 'STRING',
                description: 'Exact quote of the verbal agreement'
              },
              confidence: {
                type: 'NUMBER',
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
            type: 'OBJECT',
            properties: {
              handshake_active: {
                type: 'BOOLEAN',
                description: 'true if handshake is currently happening, false if stopped'
              },
              description: {
                type: 'STRING',
                description: 'Description of what you see with the hands'
              },
              confidence: {
                type: 'NUMBER',
                description: 'Confidence level 0-1'
              },
              stable_duration: {
                type: 'NUMBER',
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
            type: 'OBJECT',
            properties: {
              name: {
                type: 'STRING',
                description: 'Name of the identified person (must match an enrolled person)'
              },
              wallet: {
                type: 'STRING',
                description: 'Wallet address of the identified person'
              },
              confidence: {
                type: 'NUMBER',
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
            type: 'OBJECT',
            properties: {
              person_description: {
                type: 'STRING',
                description: 'Description of the identified person'
              },
              amount: {
                type: 'NUMBER',
                description: 'Payment amount in USD'
              },
              verbal_confirmation_quote: {
                type: 'STRING',
                description: 'Quote of the verbal agreement'
              },
              handshake_confirmed: {
                type: 'BOOLEAN',
                description: 'Handshake is currently active and stable'
              },
              overall_confidence: {
                type: 'NUMBER',
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

      const sessionData = {
        id: sessionId,
        liveSession: null,
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

      // Create Live API connection (WebSocket-based) using new SDK
      const liveSession = await this.genAI.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          systemInstruction: this.systemInstruction,
          tools: this.tools,
          responseModalities: ['AUDIO'],  // Native audio model needs AUDIO modality
          generationConfig: {
            temperature: 0.3,
            topP: 0.8,
            topK: 40
          }
        },
        callbacks: {
          onopen: () => {
            logger.info(`Live session ${sessionId} WebSocket opened`);
          },
          onmessage: async (message) => {
            await this.handleLiveMessage(sessionId, message);
          },
          onerror: (error) => {
            logger.error(`Live session ${sessionId} error:`, error);
          },
          onclose: (event) => {
            logger.info(`Live session ${sessionId} closed - Code: ${event?.code}, Reason: ${event?.reason}`);
            this.activeSessions.delete(sessionId);
          }
        }
      });

      sessionData.liveSession = liveSession;
      this.activeSessions.set(sessionId, sessionData);

      logger.info(`Session ${sessionId} created successfully`);

      return sessionData;
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

      // Send introduction text
      const intro = `ENROLLED PEOPLE FOR IDENTIFICATION:\n\n${enrolledPeople.map(p =>
        `- ${p.name} (Wallet: ${p.wallet})`
      ).join('\n')}\n\nI will now show you reference photos. Remember these faces and match them to people you see in the live video stream.`;

      await session.liveSession.sendClientContent({
        turns: [{
          role: 'user',
          parts: [{ text: intro }]
        }],
        turnComplete: false
      });

      // Send photos ONE AT A TIME using sendRealtimeInput (not batched)
      // This avoids the "invalid argument" error from too many images at once
      for (const person of enrolledPeople) {
        if (person.photos && person.photos.length > 0) {
          logger.info(`Sending photos for ${person.name} one at a time...`);

          // Send only the first 2 photos to reduce API load (can be adjusted)
          const photosToSend = person.photos.slice(0, 2);

          for (let i = 0; i < photosToSend.length; i++) {
            const base64Data = photosToSend[i].replace(/^data:image\/\w+;base64,/, '');

            // Send each photo individually via realtime input
            await session.liveSession.sendRealtimeInput({
              media: {
                data: base64Data,
                mimeType: 'image/jpeg'
              }
            });

            // Small delay between photos to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 200));
          }

          logger.info(`Sent ${photosToSend.length} reference photos for ${person.name}`);
        }
      }

      logger.info(`All enrolled people photos sent to session ${sessionId}`);
      session.enrollmentSent = true;
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
      // Throttle to ~2 FPS (send every 500ms for faster updates)
      const now = Date.now();
      if (now - session.lastVideoTime < 500) {
        return; // Skip this frame
      }
      session.lastVideoTime = now;
      session.videoFrameCount++;

      // Remove data URI prefix if present
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');

      // Send using sendRealtimeInput for native audio model (supports video too)
      await session.liveSession.sendRealtimeInput({
        media: {
          data: base64Data,
          mimeType: 'image/jpeg'
        }
      });

      // Send activation prompt AFTER first real video frame arrives
      if (session.videoFrameCount === 1 && session.enrollmentSent) {
        logger.info('✨ First video frame received - sending activation prompt');
        await session.liveSession.sendClientContent({
          turns: [{
            role: 'user',
            parts: [{ text: 'You are now receiving live video and audio. Start analyzing immediately. Call updateStatus() to report what you see and hear. Look for enrolled people and monitor for payment confirmations.' }]
          }],
          turnComplete: true
        });
      }

      // Log every 10th frame
      if (session.videoFrameCount % 10 === 0) {
        logger.info(`Sent ${session.videoFrameCount} video frames to Gemini`);
      }
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

      // Send using sendRealtimeInput for native audio model
      await session.liveSession.sendRealtimeInput({
        media: {
          data: base64Data,
          mimeType: 'audio/pcm;rate=16000'
        }
      });
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

      await session.liveSession.sendClientContent({
        turns: [{ role: 'user', parts: parts }],
        turnComplete: true
      });
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
      // Log message type for debugging
      const messageType = Object.keys(message)[0];
      if (messageType !== 'serverContent') {
        logger.info(`📨 Gemini message type: ${messageType} for session ${sessionId.substring(0, 8)}`);
      }

      // Check for setupComplete
      if (message.setupComplete) {
        logger.info(`✅ Setup complete for session ${sessionId.substring(0, 8)}`);
      }

      // Check for function calls (toolCall in new SDK)
      if (message.toolCall && message.toolCall.functionCalls) {
        for (const functionCall of message.toolCall.functionCalls) {
          logger.info(`Function call: ${functionCall.name}`, functionCall.args);

          // Update session state based on function calls
          this.updateSessionState(session, functionCall);

          // Execute function call handler
          if (session.onFunctionCall) {
            try {
              const functionResponse = await session.onFunctionCall(functionCall.name, functionCall.args);

              // Send function response back to Gemini (must include id from the function call)
              if (functionResponse && functionCall.id) {
                logger.debug(`Sending tool response for ${functionCall.name}:`, functionResponse);
                await session.liveSession.sendToolResponse({
                  functionResponses: [{
                    id: functionCall.id,
                    name: functionCall.name,
                    response: functionResponse
                  }]
                });
                logger.debug(`Tool response sent successfully for ${functionCall.name}`);
              }
            } catch (toolError) {
              logger.error(`Error sending tool response for ${functionCall.name}:`, toolError);
              // Don't rethrow - continue processing other messages
            }
          }
        }
      }

      // Check for text response (serverContent in new SDK)
      if (message.serverContent && message.serverContent.modelTurn) {
        const parts = message.serverContent.modelTurn.parts;
        for (const part of parts) {
          if (part.text && session.onMessage) {
            session.onMessage(part.text);
          }
        }
      }

      // Check for audio response
      if (message.serverContent && message.serverContent.modelTurn) {
        const parts = message.serverContent.modelTurn.parts;
        for (const part of parts) {
          if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
            logger.debug('Received audio response from Gemini');
            // Could forward audio back to client if needed
          }
        }
      }
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
