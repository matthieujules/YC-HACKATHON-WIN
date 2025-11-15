const axios = require('axios');
const FormData = require('form-data');
const logger = require('../utils/logger');

class FaceRecognitionService {
  constructor() {
    this.apiKey = process.env.AZURE_FACE_API_KEY;
    this.endpoint = process.env.AZURE_FACE_ENDPOINT;
    this.personGroupId = process.env.AZURE_FACE_PERSON_GROUP_ID || 'rayban-users';

    if (!this.apiKey || !this.endpoint) {
      logger.warn('Azure Face API credentials not configured');
    }

    this.headers = {
      'Ocp-Apim-Subscription-Key': this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Initialize person group (run once during setup)
   */
  async initializePersonGroup() {
    try {
      const url = `${this.endpoint}/face/v1.0/persongroups/${this.personGroupId}`;

      // Try to get existing person group
      try {
        await axios.get(url, { headers: this.headers });
        logger.info('Person group already exists');
        return true;
      } catch (error) {
        if (error.response && error.response.status === 404) {
          // Create new person group
          await axios.put(
            url,
            {
              name: 'Ray-Ban Users',
              userData: 'Face recognition for Ray-Ban payments',
              recognitionModel: 'recognition_04'
            },
            { headers: this.headers }
          );
          logger.info('Person group created successfully');
          return true;
        }
        throw error;
      }
    } catch (error) {
      logger.error('Error initializing person group:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create a new person in the person group
   * @param {string} name - Person's name
   * @param {string} userData - Additional metadata (e.g., wallet address)
   * @returns {Promise<string>} Person ID
   */
  async createPerson(name, userData = '') {
    try {
      const url = `${this.endpoint}/face/v1.0/persongroups/${this.personGroupId}/persons`;

      const response = await axios.post(
        url,
        {
          name,
          userData
        },
        { headers: this.headers }
      );

      logger.info(`Person created: ${name} (ID: ${response.data.personId})`);
      return response.data.personId;
    } catch (error) {
      logger.error('Error creating person:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Add a face image to a person
   * @param {string} personId - Azure Person ID
   * @param {Buffer|string} imageData - Image buffer or base64 string
   * @returns {Promise<string>} Persisted Face ID
   */
  async addPersonFace(personId, imageData) {
    try {
      const url = `${this.endpoint}/face/v1.0/persongroups/${this.personGroupId}/persons/${personId}/persistedFaces`;

      let requestConfig = { headers: { ...this.headers } };
      let data;

      // Handle base64 image
      if (typeof imageData === 'string') {
        // Remove data:image/jpeg;base64, prefix if present
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        data = Buffer.from(base64Data, 'base64');
        requestConfig.headers['Content-Type'] = 'application/octet-stream';
      } else {
        // Handle buffer
        data = imageData;
        requestConfig.headers['Content-Type'] = 'application/octet-stream';
      }

      const response = await axios.post(url, data, requestConfig);

      logger.info(`Face added to person ${personId}: ${response.data.persistedFaceId}`);
      return response.data.persistedFaceId;
    } catch (error) {
      logger.error('Error adding face:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Train the person group (required after adding faces)
   */
  async trainPersonGroup() {
    try {
      const url = `${this.endpoint}/face/v1.0/persongroups/${this.personGroupId}/train`;

      await axios.post(url, {}, { headers: this.headers });
      logger.info('Person group training started');

      // Wait for training to complete
      return await this.waitForTraining();
    } catch (error) {
      logger.error('Error training person group:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Wait for training to complete
   */
  async waitForTraining(maxAttempts = 30) {
    const url = `${this.endpoint}/face/v1.0/persongroups/${this.personGroupId}/training`;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await axios.get(url, { headers: this.headers });
        const status = response.data.status;

        logger.debug(`Training status: ${status}`);

        if (status === 'succeeded') {
          logger.info('Training completed successfully');
          return true;
        }

        if (status === 'failed') {
          throw new Error('Training failed');
        }

        // Wait 1 second before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logger.error('Error checking training status:', error.response?.data || error.message);
        throw error;
      }
    }

    throw new Error('Training timeout');
  }

  /**
   * Detect faces in an image
   * @param {Buffer|string} imageData - Image buffer or base64 string
   * @returns {Promise<Array>} Array of face IDs
   */
  async detectFaces(imageData) {
    try {
      const url = `${this.endpoint}/face/v1.0/detect`;

      let requestConfig = {
        headers: { ...this.headers },
        params: {
          returnFaceId: true,
          returnFaceLandmarks: false,
          returnFaceAttributes: 'age,gender,emotion',
          recognitionModel: 'recognition_04',
          detectionModel: 'detection_03'
        }
      };

      let data;

      // Handle base64 image
      if (typeof imageData === 'string') {
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        data = Buffer.from(base64Data, 'base64');
        requestConfig.headers['Content-Type'] = 'application/octet-stream';
      } else {
        data = imageData;
        requestConfig.headers['Content-Type'] = 'application/octet-stream';
      }

      const response = await axios.post(url, data, requestConfig);
      return response.data;
    } catch (error) {
      logger.error('Error detecting faces:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Identify faces in an image
   * @param {Array<string>} faceIds - Face IDs from detect operation
   * @returns {Promise<Array>} Array of identification results
   */
  async identifyFaces(faceIds) {
    try {
      const url = `${this.endpoint}/face/v1.0/identify`;

      const response = await axios.post(
        url,
        {
          personGroupId: this.personGroupId,
          faceIds,
          maxNumOfCandidatesReturned: 1,
          confidenceThreshold: 0.5
        },
        { headers: this.headers }
      );

      return response.data;
    } catch (error) {
      logger.error('Error identifying faces:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Full recognition pipeline: detect + identify
   * @param {Buffer|string} imageData - Image buffer or base64 string
   * @returns {Promise<Object|null>} Recognition result or null if no match
   */
  async recognizePerson(imageData) {
    try {
      // Step 1: Detect faces
      const faces = await this.detectFaces(imageData);

      if (faces.length === 0) {
        logger.debug('No faces detected');
        return null;
      }

      if (faces.length > 1) {
        logger.warn(`Multiple faces detected (${faces.length}), using first face`);
      }

      const faceIds = faces.map(face => face.faceId);

      // Step 2: Identify faces
      const identifications = await this.identifyFaces(faceIds);

      if (identifications.length === 0 || identifications[0].candidates.length === 0) {
        logger.debug('No matching person found');
        return null;
      }

      const match = identifications[0].candidates[0];

      return {
        personId: match.personId,
        confidence: match.confidence,
        faceId: faceIds[0],
        faceRectangle: faces[0].faceRectangle,
        faceAttributes: faces[0].faceAttributes
      };
    } catch (error) {
      logger.error('Error recognizing person:', error.message);
      throw error;
    }
  }

  /**
   * Delete a person from the person group
   * @param {string} personId - Azure Person ID
   */
  async deletePerson(personId) {
    try {
      const url = `${this.endpoint}/face/v1.0/persongroups/${this.personGroupId}/persons/${personId}`;
      await axios.delete(url, { headers: this.headers });
      logger.info(`Person deleted: ${personId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting person:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * List all persons in the person group
   */
  async listPersons() {
    try {
      const url = `${this.endpoint}/face/v1.0/persongroups/${this.personGroupId}/persons`;
      const response = await axios.get(url, { headers: this.headers });
      return response.data;
    } catch (error) {
      logger.error('Error listing persons:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new FaceRecognitionService();
