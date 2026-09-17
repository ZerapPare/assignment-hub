const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/settings
router.get('/', async (req, res) => {
	const [rows] = await db.query('SELECT * FROM user_settings WHERE user_id=?', [req.user.id]);
	res.json(rows[0] || {
		lunch_start: '12:00:00', lunch_end: '13:00:00',
		work_start: '08:00:00', work_end: '18:00:00',
	});
});

// PUT /api/settings/lunch
router.put('/lunch', async (req, res) => {
	const { lunch_start, lunch_end } = req.body;
	await db.query(
		`INSERT INTO user_settings (user_id, lunch_start, lunch_end)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE lunch_start=VALUES(lunch_start), lunch_end=VALUES(lunch_end)`,
		[req.user.id, lunch_start, lunch_end]
	);
	res.json({ success: true });
});

module.exports = router;