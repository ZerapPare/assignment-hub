const express = require('express');
const router = express.Router();
const db = require('../db');
const { validateTask } = require('../middleware/validateTask');
const pool = require('../db');

// GET /api/tasks
router.get('/', async (req, res, next) => {
	try {
		const [rows] = await db.query(
			'SELECT * FROM tasks WHERE user_id = ?',
			[req.user.id]
		);
		res.json(sortByPriority(rows));
	} catch (e) { next(e); }
});


// POST /api/tasks/sync-classroom
router.post('/sync-classroom', async (req, res, next) => {
	try {
		// ดึงงานจาก GC (ใช้ token ที่เก็บไว้ตอน login)
		const gcTasks = await classroomService.fetchCourseWork(req.user.id);

		const inserted = [];
		for (const t of gcTasks) {
			// Map: dueDate → deadline, default duration 60 นาที
			const [result] = await db.query(
				`INSERT INTO tasks 
          (user_id, title, description, start_time, duration_min, deadline, source, external_id)
         VALUES (?, ?, ?, ?, ?, ?, 'classroom', ?)
         ON DUPLICATE KEY UPDATE 
           title = VALUES(title), deadline = VALUES(deadline)`,
				[
					req.user.id,
					t.title,
					t.description || null,
					t.dueDate || new Date(),          // start_time ชั่วคราว ให้ user แก้ทีหลัง
					60,                               // default 60 นาที
					t.dueDate,
					t.id,
				]
			);
			inserted.push(result.insertId || result.insertId);
		}

		res.json({ synced: inserted.length });
	} catch (e) { next(e); }
});

// PUT /api/tasks/:id
router.put('/:id', async (req, res) => {
	try {
		const { title, start_time, duration_min, deadline, priority } = req.body;
		await db.query(
			`UPDATE tasks SET title=?, start_time=?, duration_min=?, deadline=?, priority=?
       WHERE id=? AND user_id=?`,
			[title, start_time, duration_min, deadline, priority, req.params.id, req.user.id]
		);
		res.json({ success: true });
	} catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
	await db.query('DELETE FROM tasks WHERE id=? AND user_id=?',
		[req.params.id, req.user.id]);
	res.json({ success: true });
});

// PATCH /api/tasks/:id/duration — ตั้งระยะเวลาที่คาดว่าจะใช้ (นาที)
router.patch('/:id/duration', async (req, res, next) => {
	const id = Number(req.params.id);
	const duration = Number(req.body?.time_estimate);

	if (!Number.isInteger(id) || id <= 0) {
		return res.status(400).json({ error: 'invalid id' });
	}
	if (!Number.isInteger(duration) || duration <= 0 || duration > 1440) {
		return res.status(400).json({ error: 'time_estimate ต้องเป็น 1-1440 นาที' });
	}

	try {
		// ตรวจว่าเป็นงานของผู้ใช้คนนี้
		const [owned] = await pool.query(
			`SELECT a.assignment_id FROM Assignment a
       JOIN Course c ON a.course_id = c.course_id
       WHERE a.assignment_id = ? AND c.student_id = ?`,
			[id, req.session.userId]
		);
		if (!owned.length) return res.status(404).json({ error: 'not found' });

		// UPSERT ใน Assignment_Detail
		await pool.query(
			`INSERT INTO Assignment_Detail (assignment_id, time_estimate)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE time_estimate = VALUES(time_estimate)`,
			[id, duration]
		);

		// ถ้ามี Schedule อยู่แล้ว → อัปเดต time_estimate ด้วย
		await pool.query(
			`UPDATE Schedule SET time_estimate = ? WHERE assignment_id = ?`,
			[duration, id]
		);

		res.json({ success: true, time_estimate: duration });
	} catch (err) {
		next(err);
	}
});

module.exports = router;