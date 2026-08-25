const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/announcements
// Fetches announcements scoped to the logged-in student, ordered by posting date (newest first).
router.get('/api/announcements', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT an.announcement_id,
              an.external_announcement_id,
              an.title,
              an.text_content,
              an.creator_name,
              an.creator_email,
              an.origin_link,
              an.posted_at,
              c.course_name,
              c.platform_source
       FROM Announcement an
       JOIN Course c ON an.course_id = c.course_id
       WHERE c.student_id = ?
       ORDER BY an.posted_at DESC`,
      [req.session.userId]
    );

    res.json(rows);
  } catch (err) {
    console.error('[announcements] fetch failed:', err.message);
    res.status(503).json({ error: 'Database not ready', message: err.message });
  }
});

module.exports = router;