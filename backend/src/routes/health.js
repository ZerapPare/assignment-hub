const express = require('express');
const pool = require('../db');
const { logError } = require('../services/errorLogger');

const router = express.Router();

router.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    void logError(err, req, { source: 'database', statusCode: 503, level: 'warn' });
    res.status(503).json({ status: 'error', db: 'unavailable', request_id: req.requestId });
  }
});

module.exports = router;
