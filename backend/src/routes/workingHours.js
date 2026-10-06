const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET ดึงเวลาเริ่มทำงาน 7 วัน
router.get('/api/user/working-hours', requireAuth, async (req, res) => {
	try {
		const [rows] = await pool.query(
			'SELECT day_of_week, start_time FROM Working_Hours WHERE user_id = ?',
			[req.session.userId]
		);
		const result = {};
		for (let d = 0; d < 7; d++) {
			const found = rows.find((r) => r.day_of_week === d);
			result[d] = found ? found.start_time : null;
		}
		res.json(result);
	} catch (err) {
		console.error('[working-hours] get failed:', err.code || err.message);
		res.status(503).json({ error: 'Database not ready' });
	}
});

// PUT — บันทึก (end_time = 23:59 คงที่)
router.put('/api/user/working-hours', requireAuth, async (req, res) => {
	const hours = req.body;
	if (!hours || typeof hours !== 'object') {
		return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
	}

	const conn = await pool.getConnection();
	try {
		await conn.beginTransaction();
		await conn.query('DELETE FROM Working_Hours WHERE user_id = ?', [req.session.userId]);

		const inserts = [];
		const timeRe = /^\d{2}:\d{2}(:\d{2})?$/;

		for (let d = 0; d < 7; d++) {
			const t = hours[String(d)];
			if (!t) continue;
			if (!timeRe.test(t)) continue;

			const normalized = t.length === 5 ? `${t}:00` : t;
			inserts.push([req.session.userId, d, normalized, '23:59:00']);
		}

		if (inserts.length > 0) {
			await conn.query(
				'INSERT INTO Working_Hours (user_id, day_of_week, start_time, end_time) VALUES ?',
				[inserts]
			);
		}

		await conn.commit();
		res.json({ success: true, saved: inserts.length });
	} catch (err) {
		await conn.rollback();
		console.error('[working-hours] save failed:', err.code || err.message);
		res.status(503).json({ error: 'บันทึกไม่สำเร็จ' });
	} finally {
		conn.release();
	}
});

module.exports = router;