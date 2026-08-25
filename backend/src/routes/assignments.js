// routes/assignments.js[cite: 11]
const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { logError } = require('../services/errorLogger');
const { parseDueDate } = require('../utils/dueDate');
const { safeTrackEvent } = require('../services/analytics');

const router = express.Router();

const TASK_TYPES = ['homework', 'project', 'quiz', 'exam', 'reading', 'other'];

const TASK_STATUSES = ['not_started', 'in_progress', 'submitted', 'completed'];

const MANUAL_COURSE_NAME = 'งานที่เพิ่มเอง';

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
         d.priority_score,
         d.max_points,
         d.assigned_grade
  FROM Assignment a
  JOIN Course c                 ON a.course_id = c.course_id
  LEFT JOIN Assignment_Detail d ON a.assignment_id = d.assignment_id
`;

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

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

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

    void safeTrackEvent({
      userId: req.session.userId,
      eventName: 'assignment.manual_created',
      result: 'success',
      ...(taskType ? { metadata: { task_type: taskType } } : {}),
    });

    const [rows] = await conn.query(`${ASSIGNMENT_SELECT} WHERE a.assignment_id = ?`, [
      created.insertId,
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (_) { }
    }
    void logError(err, req, { source: 'assignments', statusCode: 500 });
    console.error('[assignments] create failed:', req.requestId, err.code || 'unknown');
    res.status(500).json({ error: 'เพิ่มงานไม่สำเร็จ', request_id: req.requestId });
  } finally {
    if (conn) conn.release();
  }
});

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
    void safeTrackEvent({
      userId: req.session.userId,
      eventName: 'assignment.manual_updated',
      result: 'success',
    });
    res.json(rows[0]);
  } catch (err) {
    void logError(err, req, { source: 'assignments', statusCode: 503 });
    console.error('[assignments] update failed:', req.requestId, err.code || 'unknown');
    res.status(503).json({ error: 'Database not ready', request_id: req.requestId });
  }
});

router.patch('/api/assignments/:id/status', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'not found' });

  const status = req.body?.status ? String(req.body.status) : null;
  if (!status || !TASK_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
  }

  try {
    const [owned] = await pool.query(
      `SELECT a.assignment_id, d.status
       FROM Assignment a
       JOIN Course c ON a.course_id = c.course_id
       LEFT JOIN Assignment_Detail d ON d.assignment_id = a.assignment_id
       WHERE a.assignment_id = ? AND c.student_id = ?
       LIMIT 1`,
      [id, req.session.userId]
    );
    if (!owned.length) return res.status(404).json({ error: 'not found' });
    const previousStatus = owned[0].status || 'not_started';

    await pool.query(
      `INSERT INTO Assignment_Detail (assignment_id, status, status_updated_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE status = VALUES(status), status_updated_at = NOW()`,
      [id, status]
    );

    const [rows] = await pool.query(`${ASSIGNMENT_SELECT} WHERE a.assignment_id = ?`, [id]);
    if (previousStatus !== status) {
      void safeTrackEvent({
        userId: req.session.userId,
        eventName: 'assignment.status_changed',
        result: 'success',
        metadata: {
          from: previousStatus,
          to: status,
        },
      });
    }
    res.json(rows[0]);
  } catch (err) {
    void logError(err, req, { source: 'assignments', statusCode: 503 });
    console.error('[assignments] status update failed:', req.requestId, err.code || 'unknown');
    res.status(503).json({ error: 'Database not ready', request_id: req.requestId });
  }
});

router.delete('/api/assignments/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'not found' });

  try {
    const [owned] = await pool.query(
      `SELECT a.assignment_id FROM Assignment a
       JOIN Course c ON a.course_id = c.course_id
       WHERE a.assignment_id = ? AND c.student_id = ? AND c.platform_source IS NULL
       LIMIT 1`,
      [id, req.session.userId]
    );
    if (!owned.length) return res.status(404).json({ error: 'not found' });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM Assignment_Detail WHERE assignment_id = ?', [id]);
      await conn.query('DELETE FROM Assignment WHERE assignment_id = ?', [id]);
      await conn.commit();
      void safeTrackEvent({
        userId: req.session.userId,
        eventName: 'assignment.manual_deleted',
        result: 'success',
      });
      res.status(204).send();
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