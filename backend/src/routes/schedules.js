const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function getStartOfWeek(date) {
	const d = new Date(date);
	const day = d.getDay();
	const diff = day === 0 ? 6 : day - 1;
	d.setDate(d.getDate() - diff);
	d.setHours(0, 0, 0, 0);
	return d;
}

router.get('/api/user/settings', requireAuth, async (req, res) => {
	try {
		const [rows] = await pool.query(
			'SELECT lunch_start, lunch_end, working_hours_start, working_hours_end FROM User_Settings WHERE user_id = ?',
			[req.session.userId]
		);
		if (rows.length === 0) {
			await pool.query(
				"INSERT INTO User_Settings (user_id, working_hours_start, working_hours_end) VALUES (?, '08:00:00', '18:00:00')",
				[req.session.userId]
			);
			return res.json({ lunch_start: null, lunch_end: null, working_hours_start: '08:00:00', working_hours_end: '18:00:00' });
		}
		res.json(rows[0]);
	} catch (err) {
		res.status(503).json({ error: 'Database not ready' });
	}
});

router.put('/api/user/settings', requireAuth, async (req, res) => {
	const { lunch_start, lunch_end, working_hours_start, working_hours_end } = req.body;
	try {
		await pool.query(
			`INSERT INTO User_Settings (user_id, lunch_start, lunch_end, working_hours_start, working_hours_end)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         lunch_start = VALUES(lunch_start), lunch_end = VALUES(lunch_end),
         working_hours_start = VALUES(working_hours_start), working_hours_end = VALUES(working_hours_end)`,
			[req.session.userId, lunch_start || null, lunch_end || null, working_hours_start || '08:00:00', working_hours_end || '18:00:00']
		);
		res.json({ success: true });
	} catch (err) {
		res.status(503).json({ error: 'Database not ready' });
	}
});

router.get('/api/schedule/weekly', requireAuth, async (req, res) => {
	const { week_start } = req.query;
	let startDate = week_start ? new Date(week_start) : getStartOfWeek(new Date());
	if (isNaN(startDate.getTime())) return res.status(400).json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' });
	const endDate = new Date(startDate);
	endDate.setDate(startDate.getDate() + 7);
	try {
		const [rows] = await pool.query(
			`SELECT a.assignment_id, a.title, a.task_type, a.origin_link,
              c.course_name, c.platform_source,
              ad.description, ad.due_date, ad.status, ad.status_updated_at, ad.priority_score,
              s.start_time, s.end_time, s.time_estimate AS duration_minutes, s.segments
       FROM Assignment a JOIN Course c ON a.course_id = c.course_id
       LEFT JOIN Assignment_Detail ad ON a.assignment_id = ad.assignment_id
       LEFT JOIN Schedule s ON a.assignment_id = s.assignment_id
       WHERE c.student_id = ? AND (
	     (s.end_time >= ? AND s.start_time < ?)     -- งานที่มี segment ในสัปดาห์
		 OR (ad.due_date >= ? AND ad.due_date < ?)    -- งานที่มี deadline ในสัปดาห์
		)
       ORDER BY s.start_time ASC`,
			[req.session.userId, startDate, endDate, startDate, endDate]
		);
		res.json(rows);
	} catch (err) {
		console.error('[schedule] weekly failed:', err.code || err.message, err.sqlMessage || '');
		res.status(503).json({ error: 'Database not ready' });
	}
});

router.post('/api/schedule/generate', requireAuth, async (req, res) => {
	const connection = await pool.getConnection();
	try {
		// 1. ลบ schedule เก่า
		await connection.query(
			`DELETE s FROM Schedule s
       JOIN Assignment a ON s.assignment_id = a.assignment_id
       JOIN Course c ON a.course_id = c.course_id
       WHERE c.student_id = ?`,
			[req.session.userId]
		);

		// 2. ดึงงาน
		const [assignments] = await connection.query(
			`SELECT a.assignment_id, a.title, ad.due_date, ad.priority_score,
              COALESCE(ad.time_estimate, 60) AS duration
       FROM Assignment a JOIN Course c ON a.course_id = c.course_id
       LEFT JOIN Assignment_Detail ad ON a.assignment_id = ad.assignment_id
       WHERE c.student_id = ? AND ad.due_date IS NOT NULL
         AND (ad.status IS NULL OR ad.status NOT IN ('submitted', 'completed'))
       ORDER BY ad.due_date ASC, duration DESC`,
			[req.session.userId]
		);

		if (assignments.length === 0) return res.json({ message: 'ไม่มีงานที่ต้องจัดตาราง', updated: [] });

		// 3. Working hours + lunch
		const [workingRows] = await connection.query(
			'SELECT day_of_week, start_time FROM Working_Hours WHERE user_id = ?',
			[req.session.userId]
		);
		const workingHours = {};
		workingRows.forEach((r) => { workingHours[r.day_of_week] = { start: r.start_time }; });

		const [settings] = await connection.query(
			'SELECT lunch_start, lunch_end FROM User_Settings WHERE user_id = ?',
			[req.session.userId]
		);
		const lunchStart = settings[0]?.lunch_start || null;
		const lunchEnd = settings[0]?.lunch_end || null;

		let currentSlot = new Date();

		const moveToNextWorkingDay = () => {
			let safety = 0;
			let probe = currentSlot.getTime();
			while (safety < 30) {
				probe += 24 * 60 * 60 * 1000;
				const probeThai = new Date(probe + 7 * 60 * 60 * 1000);
				const dow = probeThai.getUTCDay();

				if (workingHours[dow]) {
					const [h, m] = workingHours[dow].start.split(':').map(Number);
					const midnightThaiUTC = Date.UTC(
						probeThai.getUTCFullYear(),
						probeThai.getUTCMonth(),
						probeThai.getUTCDate()
					) - 7 * 60 * 60 * 1000;
					currentSlot = new Date(midnightThaiUTC + (h * 60 + m) * 60 * 1000);
					return true;
				}
				safety++;
			}
			return false;
		};

		const dow = currentSlot.getDay();
		if (!workingHours[dow]) {
			moveToNextWorkingDay();
		} else {
			const [h, m] = workingHours[dow].start.split(':').map(Number);
			if (currentSlot.getHours() >= h) currentSlot.setSeconds(0, 0);
			else currentSlot.setHours(h, m, 0, 0);
		}

		const scheduledIntervals = [];

		const hasConflict = (taskId, segStart, segEnd) =>
			scheduledIntervals.some((iv) => iv.id !== taskId && segStart < iv.end && segEnd > iv.start);

		const getConflictEnd = (taskId, segStart, segEnd) => {
			let maxEnd = null;
			for (const iv of scheduledIntervals) {
				if (iv.id !== taskId && segStart < iv.end && segEnd > iv.start) {
					if (!maxEnd || iv.end > maxEnd) maxEnd = iv.end;
				}
			}
			return maxEnd;
		};

		const updated = [];

		for (const assign of assignments) {
			const totalDuration = assign.duration;
			let remaining = totalDuration;
			const segments = [];
			let attempts = 0;

			while (remaining > 0 && attempts < 1000) {
				attempts++;
				const curDow = currentSlot.getDay();
				const wh = workingHours[curDow];

				if (!wh) { if (!moveToNextWorkingDay()) break; continue; }

				const dayStart = new Date(currentSlot);
				dayStart.setHours(0, 0, 0, 0);

				const [sh, sm] = wh.start.split(':').map(Number);
				const workStart = new Date(dayStart); workStart.setHours(sh, sm, 0, 0);
				const workEnd = new Date(dayStart); workEnd.setHours(23, 59, 59, 0);

				if (currentSlot < workStart) currentSlot = new Date(workStart);
				if (currentSlot >= workEnd) { if (!moveToNextWorkingDay()) break; continue; }

				let segmentEndLimit = workEnd;
				if (lunchStart && lunchEnd) {
					const [lh, lm] = lunchStart.split(':').map(Number);
					const [leh, lem] = lunchEnd.split(':').map(Number);
					const lunchS = new Date(dayStart); lunchS.setHours(lh, lm, 0, 0);
					const lunchE = new Date(dayStart); lunchE.setHours(leh, lem, 0, 0);
					if (currentSlot >= lunchS && currentSlot < lunchE) currentSlot = new Date(lunchE);
					else if (currentSlot < lunchS) segmentEndLimit = lunchS;
				}

				const availableMinutes = (segmentEndLimit.getTime() - currentSlot.getTime()) / 60000;
				const takeMinutes = Math.min(remaining, availableMinutes);
				if (takeMinutes <= 0) { currentSlot = new Date(segmentEndLimit); continue; }

				const segmentEnd = new Date(currentSlot.getTime() + takeMinutes * 60000);

				// ตรวจ conflict ใน JS
				if (hasConflict(assign.assignment_id, currentSlot, segmentEnd)) {
					const conflictEnd = getConflictEnd(assign.assignment_id, currentSlot, segmentEnd);
					// กระโดดไปหลัง conflict
					currentSlot = new Date(Math.ceil(conflictEnd.getTime() / 60000) * 60000);
					continue;
				}

				segments.push({ start: currentSlot.toISOString(), end: segmentEnd.toISOString() });
				remaining -= takeMinutes;
				currentSlot = new Date(segmentEnd);

				if (remaining <= 0) {
					const firstStart = new Date(segments[0].start);
					const lastEnd = new Date(segments[segments.length - 1].end);

					await connection.query(
						`INSERT INTO Schedule (assignment_id, start_time, end_time, time_estimate, segments)
						VALUES (?, ?, ?, ?, ?)
						ON DUPLICATE KEY UPDATE
							start_time = VALUES(start_time),
							end_time = VALUES(end_time),
							time_estimate = VALUES(time_estimate),
							segments = VALUES(segments)`,
						[assign.assignment_id, firstStart, lastEnd, totalDuration, JSON.stringify(segments)]
					);

					for (const seg of segments) {
						scheduledIntervals.push({ id: assign.assignment_id, start: new Date(seg.start), end: new Date(seg.end) });
					}

					updated.push({
						assignment_id: assign.assignment_id, title: assign.title,
						start_time: firstStart, end_time: lastEnd, duration: totalDuration, segments,
					});
				}
			}
		}

		const totalWanted = assignments.length;
		const totalScheduled = updated.length;
		const failed = totalWanted - totalScheduled;

		let message = 'จัดตารางเสร็จสิ้น';
		if (failed > 0) message = `จัดตารางแล้ว ${totalScheduled}/${totalWanted} งาน (มี ${failed} งานที่จัดไม่ได้)`;

		res.json({ message, updated, total: totalWanted, scheduled: totalScheduled, failed });
	} catch (err) {
		console.error('[schedule] generate failed:', err.code || err.message);
		res.status(500).json({ error: 'ไม่สามารถสร้างตารางอัตโนมัติได้' });
	} finally {
		connection.release();
	}
});

module.exports = router;