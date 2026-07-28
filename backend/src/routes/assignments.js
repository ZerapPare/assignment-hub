const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { parseDueDate } = require('../utils/dueDate');

const router = express.Router();

const TASK_TYPES = ['homework', 'project', 'quiz', 'exam', 'reading', 'other'];

// Where manually added work goes when the student doesn't name a subject.
const MANUAL_COURSE_NAME = 'งานที่เพิ่มเอง';

// One row shape for every assignment response, so a task created by POST can
// be appended client-side without refetching the whole list.
const ASSIGNMENT_SELECT = `
  SELECT a.assignment_id,
         a.title,
         a.task_type,
         a.origin_link,
         c.course_name,
         c.platform_source,
         d.description,
         d.due_date,
         d.status,
         d.priority_score
  FROM Assignment a
  JOIN Course c                 ON a.course_id = c.course_id
  LEFT JOIN Assignment_Detail d ON a.assignment_id = d.assignment_id
`;

// Course rows carry the owning student, so that join is what scopes the list
// to whoever is logged in.
router.get('/api/assignments', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(`${ASSIGNMENT_SELECT} WHERE c.student_id = ? ORDER BY d.due_date`, [
      req.session.userId,
    ]);
    res.json(rows);
  } catch (err) {
    res.status(503).json({ error: 'Database not ready', message: err.message });
  }
});

// Add a task by hand (UR05/UR06) — work that never came from Classroom or Teams.
router.post('/api/assignments', requireAuth, async (req, res) => {
  const title = String(req.body?.title ?? '').trim();
  if (!title) return res.status(400).json({ error: 'ต้องระบุชื่องาน' });

  const taskType = req.body?.task_type ? String(req.body.task_type) : null;
  if (taskType && !TASK_TYPES.includes(taskType)) {
    return res.status(400).json({ error: 'ประเภทงานไม่ถูกต้อง' });
  }

  const dueDate = parseDueDate(req.body?.due_date);
  if (dueDate === false) {
    return res.status(400).json({ error: 'รูปแบบวันเวลากำหนดส่งไม่ถูกต้อง' });
  }

  const courseName = String(req.body?.course_name ?? '').trim() || MANUAL_COURSE_NAME;
  const description = String(req.body?.description ?? '').trim() || null;

  // The two inserts go together: the schema has no ON DELETE actions, so an
  // Assignment left without its Detail would have to be cleaned up by hand.
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // A manual course is one with no platform_source — exactly what the
    // "เพิ่มเอง" filter and the sync's platform checks key on.
    const [courses] = await conn.query(
      `SELECT course_id FROM Course
       WHERE student_id = ? AND course_name = ? AND platform_source IS NULL LIMIT 1`,
      [req.session.userId, courseName]
    );
    let courseId = courses[0]?.course_id;
    if (!courseId) {
      const [ins] = await conn.query(
        'INSERT INTO Course (course_name, platform_source, student_id) VALUES (?, NULL, ?)',
        [courseName, req.session.userId]
      );
      courseId = ins.insertId;
    }

    const [created] = await conn.query(
      'INSERT INTO Assignment (title, task_type, course_id) VALUES (?, ?, ?)',
      [title, taskType, courseId]
    );
    await conn.query(
      `INSERT INTO Assignment_Detail (assignment_id, description, due_date, status)
       VALUES (?, ?, ?, 'not_started')`,
      [created.insertId, description, dueDate]
    );

    await conn.commit();

    const [rows] = await conn.query(`${ASSIGNMENT_SELECT} WHERE a.assignment_id = ?`, [
      created.insertId,
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    await conn.rollback();
    console.error('[assignments] create failed:', err.message);
    res.status(500).json({ error: 'เพิ่มงานไม่สำเร็จ', message: err.message });
  } finally {
    conn.release();
  }
});

// Edit a manually added task (UR07) — most often to move its deadline.
//
// Nothing in the frontend calls this yet: the dashboard can create tasks but
// has no edit affordance. Kept deliberately, not by oversight — UR07 is a
// real requirement and this is the endpoint the edit UI will use.
router.patch('/api/assignments/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'not found' });

  const assignmentSet = [];
  const assignmentVals = [];
  const detailSet = [];
  const detailVals = [];

  if (req.body?.title !== undefined) {
    const title = String(req.body.title).trim();
    if (!title) return res.status(400).json({ error: 'ต้องระบุชื่องาน' });
    assignmentSet.push('title = ?');
    assignmentVals.push(title);
  }
  if (req.body?.task_type !== undefined) {
    const taskType = req.body.task_type || null;
    if (taskType && !TASK_TYPES.includes(taskType)) {
      return res.status(400).json({ error: 'ประเภทงานไม่ถูกต้อง' });
    }
    assignmentSet.push('task_type = ?');
    assignmentVals.push(taskType);
  }
  if (req.body?.description !== undefined) {
    detailSet.push('description = ?');
    detailVals.push(String(req.body.description).trim() || null);
  }
  if (req.body?.due_date !== undefined) {
    const dueDate = parseDueDate(req.body.due_date);
    if (dueDate === false) {
      return res.status(400).json({ error: 'รูปแบบวันเวลากำหนดส่งไม่ถูกต้อง' });
    }
    detailSet.push('due_date = ?');
    detailVals.push(dueDate);
  }
  if (!assignmentSet.length && !detailSet.length) {
    return res.status(400).json({ error: 'ไม่มีข้อมูลที่จะแก้ไข' });
  }

  try {
    // Ownership and "is this manual?" in one check. Synced coursework is
    // read-only here — Classroom and Teams stay the source of truth (UR05).
    const [owned] = await pool.query(
      `SELECT a.assignment_id FROM Assignment a
       JOIN Course c ON a.course_id = c.course_id
       WHERE a.assignment_id = ? AND c.student_id = ? AND c.platform_source IS NULL
       LIMIT 1`,
      [id, req.session.userId]
    );
    if (!owned.length) return res.status(404).json({ error: 'not found' });

    if (assignmentSet.length) {
      await pool.query(
        `UPDATE Assignment SET ${assignmentSet.join(', ')} WHERE assignment_id = ?`,
        [...assignmentVals, id]
      );
    }
    if (detailSet.length) {
      await pool.query(
        `UPDATE Assignment_Detail SET ${detailSet.join(', ')} WHERE assignment_id = ?`,
        [...detailVals, id]
      );
    }

    const [rows] = await pool.query(`${ASSIGNMENT_SELECT} WHERE a.assignment_id = ?`, [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('[assignments] update failed:', err.message);
    res.status(503).json({ error: 'Database not ready', message: err.message });
  }
});

module.exports = router;
