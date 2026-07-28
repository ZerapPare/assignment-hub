const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'unavailable', message: err.message });
  }
});

module.exports = router;
