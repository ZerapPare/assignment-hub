const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// อ่านเวลาเริ่มทำงานของผู้ใช้ แล้วคืนข้อมูลครบทั้ง 7 วัน
router.get('/api/user/working-hours', requireAuth, async (req, res) => {
	try {
		const [rows] = await pool.query(
			'SELECT day_of_week, start_time FROM Working_Hours WHERE user_id = ?',
			[req.session.userId]
		);
		const result = {};
		for (let d = 0; d < 7; d++) {
			// วันที่ไม่มีแถวในฐานข้อมูลจะเป็น null เพื่อแทนวันหยุด
			const found = rows.find((r) => r.day_of_week === d);
			result[d] = found ? found.start_time : null;
		}
		res.json(result);
	} catch (err) {
		console.error('[working-hours] get failed:', err.code || err.message);
		res.status(503).json({ error: 'Database not ready' });
	}
});

// บันทึกเวลาเริ่มทำงานของแต่ละวัน; เวลาสิ้นสุดการทำงานกำหนดคงที่ที่ 23:59
router.put('/api/user/working-hours', requireAuth, async (req, res) => {
	const hours = req.body;
	if (!hours || typeof hours !== 'object') {
		return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
	}

	const conn = await pool.getConnection();
	try {
		// ลบและเพิ่มรายการใน transaction เดียว เพื่อไม่ให้ข้อมูลค้างครึ่งชุด
		await conn.beginTransaction();
		await conn.query('DELETE FROM Working_Hours WHERE user_id = ?', [req.session.userId]);

		const inserts = [];
		const timeRe = /^\d{2}:\d{2}(:\d{2})?$/;

		for (let d = 0; d < 7; d++) {
			const t = hours[String(d)];
			if (!t) continue;
			// ข้ามค่าที่ไม่ตรงรูปแบบเวลา และเติมวินาทีให้รูปแบบ HH:MM
			if (!timeRe.test(t)) continue;

			const normalized = t.length === 5 ? `${t}:00` : t;
			inserts.push([req.session.userId, d, normalized, '23:59:00']);
		}

		if (inserts.length > 0) {
			// เพิ่มเฉพาะวันที่ผู้ใช้เปิดทำงาน
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