// backend/src/routes/teams.js
const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { msToMysqlDateTime, refreshMsToken, getMsClasses, getMsAssignments } = require('../services/teamsSync');

const router = express.Router();

router.post('/api/teams/sync', requireAuth, async (req, res) => {
  try {
    // 1. ดึง Refresh Token จาก Database
    const [rows] = await pool.query(
      'SELECT ms_refresh_token FROM Student WHERE user_id = ? LIMIT 1',
      [req.session.userId]
    );
    const refreshToken = rows[0]?.ms_refresh_token;
    
    if (!refreshToken) {
      return res.status(400).json({
        error: 'No Microsoft Teams access — log out and log back in with Microsoft to grant it.',
      });
    }

    // 2. ขอ Access Token ใหม่เพื่อใช้ดึงข้อมูล
    const tokenData = await refreshMsToken(refreshToken);
    const accessToken = tokenData.access_token;

    // (Optionally) อัปเดต refresh_token ใหม่ลง DB ถ้า Microsoft ส่งอันใหม่มาให้
    if (tokenData.refresh_token) {
        await pool.query('UPDATE Student SET ms_refresh_token = ? WHERE user_id = ?', 
        [tokenData.refresh_token, req.session.userId]);
    }

    let coursesSynced = 0;
    let assignmentsSynced = 0;
    const skippedCourses = [];

    // 3. ดึงรายวิชา (Classes) จาก MS Teams
    const classes = await getMsClasses(accessToken);

    for (const msClass of classes) {
      // เช็กว่าวิชานี้มีใน DB หรือยัง
      const [existingCourse] = await pool.query(
        'SELECT course_id FROM Course WHERE external_course_id = ? AND student_id = ? LIMIT 1',
        [msClass.id, req.session.userId]
      );

      let courseId;
      if (existingCourse.length) {
        courseId = existingCourse[0].course_id;
        await pool.query('UPDATE Course SET course_name = ? WHERE course_id = ?', [msClass.displayName, courseId]);
      } else {
        const [ins] = await pool.query(
          `INSERT INTO Course (course_name, external_course_id, platform_source, student_id)
           VALUES (?, ?, 'Microsoft Teams', ?)`,
          [msClass.displayName, msClass.id, req.session.userId]
        );
        courseId = ins.insertId;
      }
      coursesSynced++;

      // 4. ดึงงาน (Assignments) ในวิชานั้นๆ
      let assignments;
      try {
        assignments = await getMsAssignments(accessToken, msClass.id);
      } catch (workErr) {
        console.warn('[teams] skipping class %s (%s): failed: %s', msClass.id, msClass.displayName, workErr.message);
        skippedCourses.push(msClass.displayName);
        continue;
      }

      for (const work of assignments) {
        if (work.status !== 'published') continue; // ข้ามงานที่อาจารย์ยังไม่ปล่อย

        const dueDateTime = msToMysqlDateTime(work.dueDateTime);
        // ใน Graph API สถานะการส่งงานต้องเช็กจาก Submissions (ตรงนี้ทำแบบเบื้องต้นไปก่อน)
        const initialStatus = 'not_started'; 

        const [existingAssignment] = await pool.query(
          'SELECT assignment_id FROM Assignment WHERE external_assignment_id = ? AND course_id = ? LIMIT 1',
          [work.id, courseId]
        );

        if (existingAssignment.length) {
          const assignmentId = existingAssignment[0].assignment_id;
          await pool.query(
            'UPDATE Assignment SET title = ?, origin_link = ? WHERE assignment_id = ?',
            [work.displayName, work.webUrl || null, assignmentId]
          );
          await pool.query(
            'UPDATE Assignment_Detail SET due_date = ? WHERE assignment_id = ?',
            [dueDateTime, assignmentId]
          );
        } else {
          const [ins] = await pool.query(
            `INSERT INTO Assignment (external_assignment_id, title, origin_link, course_id)
             VALUES (?, ?, ?, ?)`,
            [work.id, work.displayName, work.webUrl || null, courseId]
          );
          await pool.query(
            `INSERT INTO Assignment_Detail (assignment_id, description, due_date, status, priority_score)
             VALUES (?, ?, ?, ?, 0)`,
            [ins.insertId, work.instructions?.content || null, dueDateTime, initialStatus]
          );
        }
        assignmentsSynced++;
      }
    }

    res.json({ ok: true, coursesSynced, assignmentsSynced, skippedCourses });
  } catch (err) {
    console.error('[teams] sync error:', err.message);
    res.status(500).json({
      error: 'Microsoft Teams sync failed',
      message: err.message,
    });
  }
});

module.exports = router;