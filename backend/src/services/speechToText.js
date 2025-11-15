const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class SpeechToTextService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    if (!process.env.OPENAI_API_KEY) {
      logger.warn('OpenAI API key not configured');
    }

    // Agreement keywords and patterns
    this.agreementKeywords = [
      'yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay',
      'agree', 'agreed', 'deal', 'confirmed', 'confirm',
      'accept', 'accepted', 'sounds good', 'fine', 'alright'
    ];

    this.negationKeywords = [
      'no', 'nope', 'never', 'don\'t', 'won\'t', 'cancel', 'stop'
    ];
  }

  /**
   * Transcribe audio using OpenAI Whisper
   * @param {Buffer|string} audioData - Audio file buffer or path
   * @param {string} filename - Filename for the audio
   * @returns {Promise<string>} Transcription text
   */
  async transcribe(audioData, filename = 'audio.webm') {
    try {
      let file;

      // If audioData is a buffer, write to temp file
      if (Buffer.isBuffer(audioData)) {
        const tempPath = path.join('/tmp', filename);
        fs.writeFileSync(tempPath, audioData);
        file = fs.createReadStream(tempPath);
      } else if (typeof audioData === 'string') {
        // If it's a file path
        file = fs.createReadStream(audioData);
      } else {
        file = audioData; // Assume it's already a stream
      }

      const response = await this.openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'en',
        response_format: 'verbose_json',
        timestamp_granularities: ['word']
      });

      logger.info(`Transcription: "${response.text}"`);

      return response;
    } catch (error) {
      logger.error('Error transcribing audio:', error.message);
      throw error;
    }
  }

  /**
   * Detect if transcript contains agreement
   * @param {string} transcript - Text to analyze
   * @returns {Object} Detection result with confidence
   */
  detectAgreement(transcript) {
    const lowerText = transcript.toLowerCase();

    // Check for negation first
    const hasNegation = this.negationKeywords.some(word =>
      lowerText.includes(word)
    );

    if (hasNegation) {
      return {
        detected: false,
        confidence: 0,
        reason: 'Negation detected',
        transcript
      };
    }

    // Check for agreement keywords
    const matchedKeywords = this.agreementKeywords.filter(word =>
      lowerText.includes(word)
    );

    if (matchedKeywords.length === 0) {
      return {
        detected: false,
        confidence: 0,
        reason: 'No agreement keywords found',
        transcript
      };
    }

    // Calculate confidence based on number of matches and context
    const confidence = Math.min(matchedKeywords.length * 0.3 + 0.4, 1.0);

    return {
      detected: true,
      confidence,
      matchedKeywords,
      transcript,
      reason: `Agreement detected: ${matchedKeywords.join(', ')}`
    };
  }

  /**
   * Extract monetary amount from transcript
   * @param {string} transcript - Text to analyze
   * @returns {Object|null} Extracted amount or null
   */
  extractAmount(transcript) {
    // Pattern 1: $XX or $XX.XX
    const dollarPattern = /\$(\d+(?:\.\d{2})?)/g;
    const dollarMatches = [...transcript.matchAll(dollarPattern)];

    if (dollarMatches.length > 0) {
      return {
        amount: parseFloat(dollarMatches[0][1]),
        currency: 'USD',
        raw: dollarMatches[0][0]
      };
    }

    // Pattern 2: XX dollars/bucks
    const numberPattern = /(\d+(?:\.\d{2})?)\s*(dollars?|bucks?|usd)/gi;
    const numberMatches = [...transcript.matchAll(numberPattern)];

    if (numberMatches.length > 0) {
      return {
        amount: parseFloat(numberMatches[0][1]),
        currency: 'USD',
        raw: numberMatches[0][0]
      };
    }

    // Pattern 3: Word numbers (twenty, fifty, etc.)
    const wordNumbers = {
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
      'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
      'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
      'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
      'eighty': 80, 'ninety': 90, 'hundred': 100, 'thousand': 1000
    };

    const lowerText = transcript.toLowerCase();
    for (const [word, value] of Object.entries(wordNumbers)) {
      const wordPattern = new RegExp(`\\b${word}\\b\\s*(dollars?|bucks?|usd)?`, 'i');
      const match = lowerText.match(wordPattern);
      if (match) {
        return {
          amount: value,
          currency: 'USD',
          raw: match[0]
        };
      }
    }

    return null;
  }

  /**
   * Analyze complete conversation for transaction intent
   * @param {string} transcript - Full conversation transcript
   * @returns {Object} Analysis result
   */
  analyzeTransactionIntent(transcript) {
    const agreementResult = this.detectAgreement(transcript);
    const amountResult = this.extractAmount(transcript);

    return {
      hasAgreement: agreementResult.detected,
      agreementConfidence: agreementResult.confidence,
      amount: amountResult?.amount || null,
      currency: amountResult?.currency || null,
      transcript,
      readyForTransaction: agreementResult.detected && amountResult !== null,
      details: {
        agreement: agreementResult,
        amount: amountResult
      }
    };
  }

  /**
   * Real-time transcription buffer management
   * For handling chunked audio streams
   */
  createTranscriptionBuffer() {
    let buffer = [];
    let fullTranscript = '';

    return {
      add: async (audioChunk, filename) => {
        try {
          const result = await this.transcribe(audioChunk, filename);
          buffer.push(result);
          fullTranscript += ' ' + result.text;

          // Keep only last 10 chunks in buffer
          if (buffer.length > 10) {
            buffer = buffer.slice(-10);
          }

          return {
            latest: result.text,
            full: fullTranscript.trim(),
            analysis: this.analyzeTransactionIntent(fullTranscript)
          };
        } catch (error) {
          logger.error('Error adding to transcription buffer:', error);
          throw error;
        }
      },

      getFullTranscript: () => fullTranscript.trim(),

      analyze: () => this.analyzeTransactionIntent(fullTranscript),

      clear: () => {
        buffer = [];
        fullTranscript = '';
      }
    };
  }
}

module.exports = new SpeechToTextService();
