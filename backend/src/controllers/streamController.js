const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const geminiLive = require('../services/geminiLive');
const cryptoService = require('../services/crypto');
const jsonStorage = require('../services/jsonStorage');

class StreamController {
  constructor() {
    this.activeSessions = new Map();
  }

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(socket, io) {
    const sessionId = uuidv4();
    logger.info(`New stream connection: ${socket.id}, session: ${sessionId}`);

    // Initialize session
    const session = {
      socketId: socket.id,
      sessionId: sessionId,
      geminiSession: null,
      enrolledPeople: [],
      currentState: {
        personIdentified: false,
        personData: null,
        verbalAgreement: false,
        amount: null,
        handshakeActive: false,
        readyForTransaction: false
      },
      transactionExecuted: false
    };

    this.activeSessions.set(socket.id, session);

    // Load enrolled people from database
    await this.loadEnrolledPeople(session);

    // Register event handlers
    this.registerHandlers(socket, session, io);

    // Send initial status
    socket.emit('session:created', {
      sessionId: sessionId,
      enrolledPeopleCount: session.enrolledPeople.length
    });
  }

  /**
   * Load enrolled people from JSON storage
   */
  async loadEnrolledPeople(session) {
    try {
      const people = await jsonStorage.getAllPeople();
      session.enrolledPeople = people;
      logger.info(`Loaded ${session.enrolledPeople.length} enrolled people for session ${session.sessionId}`);
    } catch (error) {
      logger.error('Error loading enrolled people:', error);
      session.enrolledPeople = [];
    }
  }

  /**
   * Register WebSocket event handlers
   */
  registerHandlers(socket, session, io) {
    // Start streaming session
    socket.on('stream:start', async () => {
      try {
        logger.info(`Starting stream for session ${session.sessionId}`);

        // Create Gemini Live session
        session.geminiSession = await geminiLive.createSession(
          session.sessionId,
          // onMessage callback
          (message) => {
            socket.emit('gemini:message', { message });
          },
          // onFunctionCall callback
          async (functionName, args) => {
            return await this.handleFunctionCall(socket, session, functionName, args);
          }
        );

        // Send enrolled people reference photos to Gemini
        if (session.enrolledPeople.length > 0) {
          logger.info(`Sending ${session.enrolledPeople.length} enrolled people to Gemini`);
          await geminiLive.sendEnrolledPeople(session.sessionId, session.enrolledPeople);
        }

        socket.emit('stream:started', { sessionId: session.sessionId });
      } catch (error) {
        logger.error('Error starting stream:', error);
        socket.emit('stream:error', { error: error.message });
      }
    });

    // Receive video frame
    socket.on('stream:video', async (data) => {
      if (!session.geminiSession) {
        return;
      }

      try {
        await geminiLive.sendVideoFrame(session.sessionId, data.frame);
      } catch (error) {
        logger.error('Error processing video frame:', error);
      }
    });

    // Receive audio chunk
    socket.on('stream:audio', async (data) => {
      if (!session.geminiSession) {
        return;
      }

      try {
        await geminiLive.sendAudioChunk(session.sessionId, data.audio);
      } catch (error) {
        logger.error('Error processing audio chunk:', error);
      }
    });

    // Receive combined video + audio
    socket.on('stream:multimodal', async (data) => {
      if (!session.geminiSession) {
        return;
      }

      try {
        await geminiLive.sendMultimodalChunk(
          session.sessionId,
          data.video,
          data.audio
        );
      } catch (error) {
        logger.error('Error processing multimodal chunk:', error);
      }
    });

    // Stop streaming
    socket.on('stream:stop', () => {
      this.stopStream(session);
      socket.emit('stream:stopped');
    });

    // Get current state
    socket.on('stream:getState', () => {
      socket.emit('stream:state', session.currentState);
    });
  }

  /**
   * Handle function calls from Gemini
   */
  async handleFunctionCall(socket, session, functionName, args) {
    logger.info(`Handling function call: ${functionName}`, args);

    try {
      switch (functionName) {
        case 'updateStatus':
          return await this.handleUpdateStatus(socket, session, args);

        case 'identifyPerson':
          return await this.handleIdentifyPerson(socket, session, args);

        case 'confirmVerbalAgreement':
          return await this.handleConfirmVerbalAgreement(socket, session, args);

        case 'confirmHandshake':
          return await this.handleConfirmHandshake(socket, session, args);

        case 'executeTransaction':
          return await this.handleExecuteTransaction(socket, session, args);

        default:
          logger.warn(`Unknown function: ${functionName}`);
          return { error: 'Unknown function' };
      }
    } catch (error) {
      logger.error(`Error handling function ${functionName}:`, error);
      return { error: error.message };
    }
  }

  /**
   * Handle status updates
   */
  async handleUpdateStatus(socket, session, args) {
    socket.emit('status:update', {
      visual: args.visual_observation,
      audio: args.audio_observation,
      person: args.person_description
    });

    return { acknowledged: true };
  }

  /**
   * Handle person identification
   */
  async handleIdentifyPerson(socket, session, args) {
    const { description, confidence } = args;

    // Find matching person by description
    const matchedPerson = await this.findPersonByDescription(
      session.enrolledPeople,
      description
    );

    if (matchedPerson) {
      session.currentState.personIdentified = true;
      session.currentState.personData = matchedPerson;

      socket.emit('person:identified', {
        name: matchedPerson.name,
        wallet: matchedPerson.wallet_address,
        confidence: confidence
      });

      logger.info(`Person identified: ${matchedPerson.name}`);

      return {
        identified: true,
        name: matchedPerson.name,
        wallet: matchedPerson.wallet_address
      };
    } else {
      session.currentState.personIdentified = false;
      session.currentState.personData = null;

      socket.emit('person:unknown', { description });

      return {
        identified: false,
        message: 'No matching enrolled person found'
      };
    }
  }

  /**
   * Handle verbal agreement confirmation
   */
  async handleConfirmVerbalAgreement(socket, session, args) {
    const { agreed, amount, quote, confidence } = args;

    session.currentState.verbalAgreement = agreed;
    session.currentState.amount = amount;

    socket.emit('verbal:confirmed', {
      agreed,
      amount,
      quote,
      confidence
    });

    logger.info(`Verbal agreement: ${agreed ? 'YES' : 'NO'}, amount: $${amount}`);

    // Check if ready for transaction
    this.checkTransactionReady(socket, session);

    return {
      acknowledged: true,
      status: agreed ? 'Agreement confirmed' : 'Agreement retracted'
    };
  }

  /**
   * Handle handshake confirmation
   */
  async handleConfirmHandshake(socket, session, args) {
    const { handshake_active, description, confidence, stable_duration } = args;

    session.currentState.handshakeActive = handshake_active;

    socket.emit('handshake:confirmed', {
      active: handshake_active,
      description,
      confidence,
      duration: stable_duration
    });

    logger.info(`Handshake: ${handshake_active ? 'ACTIVE' : 'INACTIVE'}, duration: ${stable_duration}s`);

    // Check if ready for transaction
    this.checkTransactionReady(socket, session);

    return {
      acknowledged: true,
      status: handshake_active ? 'Handshake detected' : 'Handshake lost'
    };
  }

  /**
   * Handle transaction execution
   */
  async handleExecuteTransaction(socket, session, args) {
    const {
      person_description,
      amount,
      verbal_confirmation_quote,
      handshake_confirmed,
      overall_confidence
    } = args;

    // Validation: Check all conditions
    if (!session.currentState.personIdentified) {
      logger.warn('Transaction blocked: Person not identified');
      socket.emit('transaction:blocked', { reason: 'Person not identified' });
      return { error: 'Person must be identified first' };
    }

    if (!session.currentState.verbalAgreement) {
      logger.warn('Transaction blocked: No verbal agreement');
      socket.emit('transaction:blocked', { reason: 'No verbal agreement' });
      return { error: 'Verbal agreement required' };
    }

    if (!session.currentState.handshakeActive) {
      logger.warn('Transaction blocked: No active handshake');
      socket.emit('transaction:blocked', { reason: 'No active handshake' });
      return { error: 'Handshake required' };
    }

    if (session.transactionExecuted) {
      logger.warn('Transaction blocked: Already executed');
      socket.emit('transaction:blocked', { reason: 'Transaction already executed' });
      return { error: 'Transaction already executed for this session' };
    }

    if (overall_confidence < 0.7) {
      logger.warn('Transaction blocked: Low confidence');
      socket.emit('transaction:blocked', { reason: 'Confidence too low' });
      return { error: 'Confidence too low for transaction' };
    }

    // All checks passed - prepare transaction
    session.currentState.readyForTransaction = true;

    const transactionData = {
      sessionId: session.sessionId,
      recipient: session.currentState.personData,
      amount: amount,
      verbalQuote: verbal_confirmation_quote,
      confidence: overall_confidence
    };

    socket.emit('transaction:ready', transactionData);

    logger.info(`Transaction ready for ${session.currentState.personData.name}: $${amount}`);

    // Mark as executed to prevent duplicate transactions
    session.transactionExecuted = true;

    return {
      success: true,
      message: 'Transaction prepared and ready for user confirmation',
      transactionData
    };
  }

  /**
   * Check if all conditions are met for transaction
   */
  checkTransactionReady(socket, session) {
    const ready =
      session.currentState.personIdentified &&
      session.currentState.verbalAgreement &&
      session.currentState.handshakeActive;

    session.currentState.readyForTransaction = ready;

    if (ready && !session.transactionExecuted) {
      socket.emit('transaction:conditions-met', {
        person: session.currentState.personData,
        amount: session.currentState.amount
      });
    }
  }

  /**
   * Find person by description (simple matching for hackathon)
   */
  async findPersonByDescription(enrolledPeople, description) {
    // For hackathon: simple keyword matching
    // In production: use embeddings or more sophisticated matching

    const lowerDesc = description.toLowerCase();

    for (const person of enrolledPeople) {
      // Check if person's name is in description
      if (lowerDesc.includes(person.name.toLowerCase())) {
        return person;
      }

      // If person has stored description metadata, check for matches
      // (This would be populated during enrollment)
    }

    // If no match found by name, return first person (for demo purposes)
    // In production, this should return null or ask user to confirm
    if (enrolledPeople.length > 0) {
      logger.warn(`No exact match for description, using first enrolled person: ${enrolledPeople[0].name}`);
      return enrolledPeople[0];
    }

    return null;
  }

  /**
   * Stop streaming session
   */
  stopStream(session) {
    if (session.geminiSession) {
      geminiLive.closeSession(session.sessionId);
      session.geminiSession = null;
    }

    // Reset state
    session.currentState = {
      personIdentified: false,
      personData: null,
      verbalAgreement: false,
      amount: null,
      handshakeActive: false,
      readyForTransaction: false
    };

    logger.info(`Stream stopped for session ${session.sessionId}`);
  }

  /**
   * Handle disconnection
   */
  handleDisconnection(socket) {
    const session = this.activeSessions.get(socket.id);

    if (session) {
      this.stopStream(session);
      this.activeSessions.delete(socket.id);
      logger.info(`Session ${session.sessionId} disconnected`);
    }
  }
}

module.exports = new StreamController();
