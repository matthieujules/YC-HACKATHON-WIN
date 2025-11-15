const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Create a new person (enrollment)
 * POST /api/enroll
 */
router.post('/', async (req, res) => {
  try {
    const { name, wallet_address, description, photos } = req.body;

    // Validation
    if (!name || !wallet_address) {
      return res.status(400).json({
        error: 'Name and wallet_address are required'
      });
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return res.status(400).json({
        error: 'Invalid wallet address format'
      });
    }

    // Check if wallet already exists
    const existingWallet = await db.query(
      'SELECT id FROM people WHERE wallet_address = $1',
      [wallet_address]
    );

    if (existingWallet.rows.length > 0) {
      return res.status(409).json({
        error: 'Wallet address already enrolled'
      });
    }

    // Generate a unique face_person_id
    const facePersonId = `person_${uuidv4()}`;

    // Store person description in metadata
    const metadata = {
      description: description || '',
      photos: photos || [],
      enrollmentDate: new Date().toISOString()
    };

    // Insert into database
    const result = await db.query(
      `INSERT INTO people (name, wallet_address, face_person_id, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, wallet_address, face_person_id, created_at`,
      [name, wallet_address, facePersonId, JSON.stringify(metadata)]
    );

    const person = result.rows[0];

    logger.info(`Person enrolled: ${name} (${wallet_address})`);

    res.status(201).json({
      success: true,
      person: {
        id: person.id,
        name: person.name,
        wallet: person.wallet_address,
        facePersonId: person.face_person_id,
        createdAt: person.created_at
      }
    });
  } catch (error) {
    logger.error('Error enrolling person:', error);
    res.status(500).json({
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
    const result = await db.query(
      `SELECT id, name, wallet_address, face_person_id, created_at, metadata
       FROM people
       ORDER BY created_at DESC`
    );

    const people = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      wallet: row.wallet_address,
      facePersonId: row.face_person_id,
      description: row.metadata?.description || '',
      createdAt: row.created_at
    }));

    res.json({
      success: true,
      count: people.length,
      people
    });
  } catch (error) {
    logger.error('Error listing people:', error);
    res.status(500).json({
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

    const result = await db.query(
      `SELECT id, name, wallet_address, face_person_id, created_at, metadata
       FROM people
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Person not found'
      });
    }

    const person = result.rows[0];

    res.json({
      success: true,
      person: {
        id: person.id,
        name: person.name,
        wallet: person.wallet_address,
        facePersonId: person.face_person_id,
        description: person.metadata?.description || '',
        createdAt: person.created_at
      }
    });
  } catch (error) {
    logger.error('Error getting person:', error);
    res.status(500).json({
      error: 'Failed to get person',
      message: error.message
    });
  }
});

/**
 * Update a person
 * PUT /api/enroll/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, wallet_address, description } = req.body;

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }

    if (wallet_address) {
      // Validate wallet address
      if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
        return res.status(400).json({
          error: 'Invalid wallet address format'
        });
      }
      updates.push(`wallet_address = $${paramCount++}`);
      values.push(wallet_address);
    }

    if (description) {
      updates.push(`metadata = metadata || $${paramCount++}::jsonb`);
      values.push(JSON.stringify({ description }));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No fields to update'
      });
    }

    values.push(id);

    const result = await db.query(
      `UPDATE people
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING id, name, wallet_address, face_person_id, created_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Person not found'
      });
    }

    const person = result.rows[0];

    logger.info(`Person updated: ${person.name}`);

    res.json({
      success: true,
      person: {
        id: person.id,
        name: person.name,
        wallet: person.wallet_address,
        facePersonId: person.face_person_id,
        createdAt: person.created_at
      }
    });
  } catch (error) {
    logger.error('Error updating person:', error);
    res.status(500).json({
      error: 'Failed to update person',
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

    const result = await db.query(
      'DELETE FROM people WHERE id = $1 RETURNING name',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Person not found'
      });
    }

    logger.info(`Person deleted: ${result.rows[0].name}`);

    res.json({
      success: true,
      message: 'Person deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting person:', error);
    res.status(500).json({
      error: 'Failed to delete person',
      message: error.message
    });
  }
});

module.exports = router;
