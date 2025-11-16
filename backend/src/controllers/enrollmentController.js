const express = require('express');
const router = express.Router();
const jsonStorage = require('../services/jsonStorage');
const logger = require('../utils/logger');

/**
 * Create a new person (enrollment)
 * POST /api/enroll
 */
router.post('/', async (req, res) => {
  try {
    const { name, wallet_address, photos } = req.body;

    // Validation
    if (!name || !wallet_address) {
      return res.status(400).json({
        success: false,
        error: 'Name and wallet_address are required'
      });
    }

    if (!photos || photos.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'At least 3 photos are required'
      });
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format'
      });
    }

    // REMOVED wallet uniqueness check - multiple people can share the same wallet
    // This allows for testing, family accounts, or same person with different photos

    // Create person
    const person = await jsonStorage.createPerson(name, wallet_address, photos);

    logger.info(`Person enrolled: ${name} (${wallet_address})`);

    res.status(201).json({
      success: true,
      person: {
        id: person.id,
        name: person.name,
        wallet: person.wallet,
        photoCount: person.photoCount,
        createdAt: person.createdAt
      }
    });
  } catch (error) {
    logger.error('Error enrolling person:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enroll person',
      message: error.message
    });
  }
});

/**
 * List all enrolled people
 * GET /api/enroll/list
 */
router.get('/list', async (req, res) => {
  try {
    const people = await jsonStorage.getAllPeople();

    res.json({
      success: true,
      count: people.length,
      people: people.map(p => ({
        id: p.id,
        name: p.name,
        wallet: p.wallet,
        photoCount: p.photoCount,
        createdAt: p.createdAt
      }))
    });
  } catch (error) {
    logger.error('Error listing people:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list people',
      message: error.message
    });
  }
});

/**
 * Get a specific person
 * GET /api/enroll/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const person = await jsonStorage.getPersonById(id);

    if (!person) {
      return res.status(404).json({
        success: false,
        error: 'Person not found'
      });
    }

    res.json({
      success: true,
      person: {
        id: person.id,
        name: person.name,
        wallet: person.wallet,
        photos: person.photos,
        photoCount: person.photoCount,
        createdAt: person.createdAt
      }
    });
  } catch (error) {
    logger.error('Error getting person:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get person',
      message: error.message
    });
  }
});

/**
 * Delete a person
 * DELETE /api/enroll/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const person = await jsonStorage.getPersonById(id);
    if (!person) {
      return res.status(404).json({
        success: false,
        error: 'Person not found'
      });
    }

    const deleted = await jsonStorage.deletePerson(id);

    if (deleted) {
      logger.info(`Person deleted: ${person.name}`);
      res.json({
        success: true,
        message: 'Person deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Person not found'
      });
    }
  } catch (error) {
    logger.error('Error deleting person:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete person',
      message: error.message
    });
  }
});

module.exports = router;
