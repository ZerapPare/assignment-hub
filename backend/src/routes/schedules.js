const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { isValidOptionalTimeRange } = require('../utils/timeRange');

const router = express.Router();
// จำกัดเวลาประมาณการต่อชิ้นให้ไม่เกิน 168 ชั่วโมง
const MAX_DURATION_MINUTES = 168 * 60;

// คืนวันเริ่มต้นของสัปดาห์ (วันจันทร์ เวลา 00:00) สำหรับช่วงปฏิทินรายสัปดาห์
function getStartOfWeek(date) {
	const d = new Date(date);
	const day = d.getDay();
	const diff = day === 0 ? 6 : day - 1;
	d.setDate(d.getDate() - diff);
	d.setHours(0, 0, 0, 0);
	return d;
}

// อ่านเวลาพักและเวลาทำงานของผู้ใช้; สร้างค่าเริ่มต้นหากยังไม่มีการตั้งค่า
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

// บันทึกการตั้งค่าพักและเวลาทำงาน โดยตรวจช่วงพักก่อนเขียนฐานข้อมูล
router.put('/api/user/settings', requireAuth, async (req, res) => {
	const { lunch_start, lunch_end, working_hours_start, working_hours_end } = req.body;
	// ช่องพักที่ว่างทั้งคู่หมายถึงปิดเวลาพัก จึงแทนค่าด้วย null
	const normalizedLunchStart = lunch_start === '' || lunch_start == null ? null : lunch_start;
	const normalizedLunchEnd = lunch_end === '' || lunch_end == null ? null : lunch_end;
	if (!isValidOptionalTimeRange(normalizedLunchStart, normalizedLunchEnd)) {
		return res.status(400).json({ error: 'เวลาเริ่มพักต้องก่อนเวลาสิ้นสุด' });
	}

	try {
		await pool.query(
		   `INSERT INTO User_Settings (user_id, lunch_start, lunch_end, working_hours_start, working_hours_end)
			VALUES (?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
			lunch_start = VALUES(lunch_start), lunch_end = VALUES(lunch_end),
			working_hours_start = VALUES(working_hours_start), working_hours_end = VALUES(working_hours_end)`,
			[req.session.userId, normalizedLunchStart, normalizedLunchEnd, working_hours_start || '08:00:00', working_hours_end || '18:00:00']
		);
		res.json({ success: true });
	} catch (err) {
		res.status(503).json({ error: 'Database not ready' });
	}
});

// โหลดงานที่มีตารางหรือกำหนดส่งในช่วงสัปดาห์ที่ร้องขอ
router.get('/api/schedule/weekly', requireAuth, async (req, res) => {
	const { week_start } = req.query;
	let startDate = week_start ? new Date(week_start) : getStartOfWeek(new Date());
	if (isNaN(startDate.getTime())) return res.status(400).json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' });
	// ใช้ขอบเขตปลายแบบ exclusive เพื่อไม่ให้วันถัดจากสัปดาห์ติดมาด้วย
	const endDate = new Date(startDate);
	endDate.setDate(startDate.getDate() + 7);
	try {
		const [rows] = await pool.query(
		   `SELECT a.assignment_id, a.title, a.task_type, a.origin_link,
			c.course_name, c.platform_source,
			ad.description, ad.due_date, ad.status, ad.status_updated_at, ad.priority_score,
			s.start_time, s.end_time,
			COALESCE(s.time_estimate, ad.time_estimate) AS duration_minutes,
			s.segments
			FROM Assignment a JOIN Course c ON a.course_id = c.course_id
			LEFT JOIN Assignment_Detail ad ON a.assignment_id = ad.assignment_id
			LEFT JOIN Schedule s ON a.assignment_id = s.assignment_id
			WHERE c.student_id = ? AND (
				(s.end_time >= ? AND s.start_time < ?)     -- งานที่มี segment ในสัปดาห์
				OR (
				ad.due_date >= ? AND ad.due_date < ?
				AND (ad.status IS NULL OR ad.status NOT IN ('submitted', 'completed'))
				)    -- deadline ของงานที่ยังไม่เสร็จในสัปดาห์
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

// สร้างตารางงานตามวันทำงาน เวลาพัก ระยะเวลางาน และช่วงเวลาที่ถูกจองแล้ว
router.post('/api/schedule/generate', requireAuth, async (req, res) => {
	let connection;
	try {
		connection = await pool.getConnection();

		const [settings] = await connection.query(
			'SELECT lunch_start, lunch_end FROM User_Settings WHERE user_id = ?',
			[req.session.userId]
		);
		const lunchStart = settings[0]?.lunch_start || null;
		const lunchEnd = settings[0]?.lunch_end || null;
		// ตรวจค่าก่อนลบตารางเดิม เพื่อเก็บตารางเดิมไว้หากการตั้งค่าผิด
		if (!isValidOptionalTimeRange(lunchStart, lunchEnd)) {
			return res.status(400).json({ error: 'เวลาเริ่มพักต้องก่อนเวลาสิ้นสุด' });
		}

		// 1. ดึงงานและตรวจสอบระยะเวลาก่อนลบตารางเดิม
		const [assignments] = await connection.query(
			`SELECT a.assignment_id, a.title, ad.due_date, ad.priority_score,
				COALESCE(ad.time_estimate, 60) AS duration
			FROM Assignment a JOIN Course c ON a.course_id = c.course_id
			LEFT JOIN Assignment_Detail ad ON a.assignment_id = ad.assignment_id
			WHERE c.student_id = ?
				AND (ad.status IS NULL OR ad.status NOT IN ('submitted', 'completed'))
			ORDER BY ad.due_date IS NULL, ad.due_date ASC, duration DESC`,
			[req.session.userId]
		);

		if (assignments.some((assignment) => Number(assignment.duration) > MAX_DURATION_MINUTES)) {
			return res.status(400).json({ error: 'ระยะเวลางานต้องไม่เกิน 168 ชั่วโมง' });
		}

		// ลบเฉพาะตารางของผู้ใช้ปัจจุบัน แล้วค่อยสร้างรายการใหม่
		await connection.query(
			`DELETE s FROM Schedule s
			JOIN Assignment a ON s.assignment_id = a.assignment_id
			JOIN Course c ON a.course_id = c.course_id
			WHERE c.student_id = ?`,
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

		let currentSlot = new Date();

		// เลื่อนไปวันทำงานถัดไป โดยจำกัดจำนวนวันที่ค้นหาเพื่อไม่วนลูปไม่สิ้นสุด
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

		// เก็บช่วงที่จัดไปแล้วในคำขอนี้ เพื่อป้องกันงานคนละชิ้นซ้อนทับกัน
		const scheduledIntervals = [];

		// ตรวจว่าช่วงที่กำลังพิจารณาทับกับงานอื่นที่จัดแล้วหรือไม่
		const hasConflict = (taskId, segStart, segEnd) =>
			scheduledIntervals.some((iv) => iv.id !== taskId && segStart < iv.end && segEnd > iv.start);

		// คืนเวลาสิ้นสุดที่ไกลที่สุดของช่วงที่ชน เพื่อเลื่อนตัวชี้เวลาไปต่อจากจุดนั้น
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
			// งานหนึ่งชิ้นอาจต้องแบ่งเป็นหลายช่วงตามเวลาทำงานและเวลาพัก
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
					const lunchE = new Date(dayStart);
					if (leh === 0 && lem === 0 && (lh > 0 || lm > 0)) {
						// เวลาสิ้นสุด 00:00 หลังเวลาเริ่มพักหมายถึงเที่ยงคืนของวันถัดไป
						lunchE.setDate(lunchE.getDate() + 1);
					}
					lunchE.setHours(leh, lem, 0, 0);
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
					// ขยับไปหลังช่วงที่ชน ปัดขึ้นเป็นต้นนาทีถัดไป
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

					const dueMs = assign.due_date ? new Date(assign.due_date).getTime() : null;
					// เปรียบเทียบเวลาสิ้นสุดงานกับกำหนดส่งเพื่อรายงานงานที่อาจไม่ทัน
					const isLate = dueMs !== null && lastEnd.getTime() > dueMs;
					const lateByMinutes = isLate
						? Math.round((lastEnd.getTime() - dueMs) / 60000)
						: 0;

					updated.push({
						assignment_id: assign.assignment_id,
						title: assign.title,
						start_time: firstStart,
						end_time: lastEnd,
						duration: totalDuration,
						segments,
						due_date: assign.due_date,
						late: isLate,
						lateByMinutes,
					});
				}
			}
		}

		const totalWanted = assignments.length;
		const totalScheduled = updated.length;
		const failed = totalWanted - totalScheduled;

		// สรุปผลการจัดและแยกรายการที่เลยกำหนดส่ง
		const lateTasks = updated.filter((t) => t.late);

		let message = 'จัดตารางเสร็จสิ้น';
		if (failed > 0) {
			message = `จัดตารางแล้ว ${totalScheduled}/${totalWanted} งาน (มี ${failed} งานที่จัดไม่ได้)`;
		} else if (lateTasks.length > 0) {
			message = `จัดตารางสำเร็จ แต่มี ${lateTasks.length} งานที่จะส่งไม่ทัน`;
		}

		res.json({
			message,
			updated,
			lateTasks,
			total: totalWanted,
			scheduled: totalScheduled,
			failed,
		});
	} catch (err) {
		console.error('[schedule] generate failed:', err.code || err.message);
		res.status(500).json({ error: 'ไม่สามารถสร้างตารางอัตโนมัติได้' });
	} finally {
		if (connection) connection.release();
	}
});

module.exports = router;