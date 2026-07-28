const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/api/me', requireAuth, async (req, res) => {
  try {
    // Connection state comes from the *refresh* tokens: those are what make
    // future syncing possible. The token values themselves never leave here.
    const [rows] = await pool.query(
      `SELECT s.user_id, s.student_id, s.student_name, s.university_email,
              u.university_name,
              s.gg_refresh_token IS NOT NULL AS google_connected,
              s.ms_refresh_token IS NOT NULL AS microsoft_connected
       FROM Student s
       LEFT JOIN University u ON s.university_id = u.university_id
       WHERE s.user_id = ? LIMIT 1`,
      [req.session.userId]
    );
    if (!rows.length) return res.status(401).json({ error: 'not authenticated' });
    res.json({
      ...rows[0],
      google_connected: Boolean(rows[0].google_connected),
      microsoft_connected: Boolean(rows[0].microsoft_connected),
    });
  } catch (err) {
    res.status(503).json({ error: 'Database not ready', message: err.message });
  }
});

// Set the student id when it couldn't be derived from the email address.
router.patch('/api/me', requireAuth, async (req, res) => {
  const studentId = String(req.body?.student_id ?? '').trim();
  if (!studentId) return res.status(400).json({ error: 'ต้องระบุรหัสนักศึกษา' });

  try {
    await pool.query('UPDATE Student SET student_id = ? WHERE user_id = ?', [
      studentId,
      req.session.userId,
    ]);
    res.json({ ok: true, student_id: studentId });
  } catch (err) {
    // Enforcing this is the whole point of UNIQUE (student_id, university_id).
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'รหัสนักศึกษานี้ถูกใช้แล้วในมหาวิทยาลัยเดียวกัน' });
    }
    res.status(503).json({ error: 'Database not ready', message: err.message });
  }
});

module.exports = router;
