const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { logError } = require('../services/errorLogger');
const { parseDueDate } = require('../utils/dueDate');

const router = express.Router();

const TASK_TYPES = ['homework', 'project', 'quiz', 'exam', 'reading', 'other'];

// The four statuses a student can pick (UC-5). 'submitted' means handed in,
// 'completed' means the student considers the work finished — only they set it.
// classroom.js writes 'submitted' / 'not_started' from Google's submission
// state; keep the two lists in step if this one ever changes.
const TASK_STATUSES = ['not_started', 'in_progress', 'submitted', 'completed'];

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
         d.status_updated_at,
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
    void logError(err, req, { source: 'assignments', statusCode: 503 });
    res.status(503).json({ error: 'Database not ready', request_id: req.requestId });
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
  let conn;
  try {
    conn = await pool.getConnection();
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
    if (conn) {
      try { await conn.rollback(); } catch (_) { /* connection may not have started a transaction */ }
    }
    void logError(err, req, { source: 'assignments', statusCode: 500 });
    console.error('[assignments] create failed:', req.requestId, err.code || 'unknown');
    res.status(500).json({ error: 'เพิ่มงานไม่สำเร็จ', request_id: req.requestId });
  } finally {
    if (conn) conn.release();
  }
});

// Edit a manually added task (UR07) — most often to move its deadline.
//
// Called by EditTaskModal, which also sends course_name. That field is not
// accepted here, so it is dropped: moving a task between courses would mean
// find-or-creating another Course row, which this route doesn't do.
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
    void logError(err, req, { source: 'assignments', statusCode: 503 });
    console.error('[assignments] update failed:', req.requestId, err.code || 'unknown');
    res.status(503).json({ error: 'Database not ready', request_id: req.requestId });
  }
});

// Change a task's status (UC-5).
//
// Deliberately a separate route from PATCH /:id rather than another field on
// it: that one is restricted to manual work because UR05 says a task's own
// data must never diverge from Classroom/Teams. Status is different — it is
// the student's private progress marker (A3.3), so it is allowed on synced
// coursework too, and the ownership check below drops the platform_source
// predicate on purpose.
router.patch('/api/assignments/:id/status', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'not found' });

  const status = req.body?.status ? String(req.body.status) : null;
  if (!status || !TASK_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
  }

  try {
    const [owned] = await pool.query(
      `SELECT a.assignment_id FROM Assignment a
       JOIN Course c ON a.course_id = c.course_id
       WHERE a.assignment_id = ? AND c.student_id = ?
       LIMIT 1`,
      [id, req.session.userId]
    );
    if (!owned.length) return res.status(404).json({ error: 'not found' });

    // Upsert rather than UPDATE: the list query LEFT JOINs Assignment_Detail,
    // so a row without one is possible and a plain UPDATE would touch nothing
    // and silently report status: null back.
    await pool.query(
      `INSERT INTO Assignment_Detail (assignment_id, status, status_updated_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE status = VALUES(status), status_updated_at = NOW()`,
      [id, status]
    );

    const [rows] = await pool.query(`${ASSIGNMENT_SELECT} WHERE a.assignment_id = ?`, [id]);
    res.json(rows[0]);
  } catch (err) {
    void logError(err, req, { source: 'assignments', statusCode: 503 });
    console.error('[assignments] status update failed:', req.requestId, err.code || 'unknown');
    res.status(503).json({ error: 'Database not ready', request_id: req.requestId });
  }
});

// Delete a manually added task (UR08)
router.delete('/api/assignments/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'not found' });

  try {
    // 1. Verify ownership and that it's manual
    const [owned] = await pool.query(
      `SELECT a.assignment_id FROM Assignment a
       JOIN Course c ON a.course_id = c.course_id
       WHERE a.assignment_id = ? AND c.student_id = ? AND c.platform_source IS NULL
       LIMIT 1`,
      [id, req.session.userId]
    );
    if (!owned.length) return res.status(404).json({ error: 'not found' });

    // 2. Delete in transaction (no ON DELETE CASCADE)
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM Assignment_Detail WHERE assignment_id = ?', [id]);
      await conn.query('DELETE FROM Assignment WHERE assignment_id = ?', [id]);
      await conn.commit();
      res.status(204).send(); // No content
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    void logError(err, req, { source: 'assignments', statusCode: 503 });
    console.error('[assignments] delete failed:', req.requestId, err.code || 'unknown');
    res.status(503).json({ error: 'Database not ready', request_id: req.requestId });
  }
});

module.exports = router;