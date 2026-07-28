const express = require('express');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { CLIENT_ID, CLIENT_SECRET } = require('../config');
const { toMysqlDateTime, listCourseWorkSince } = require('../services/classroomSync');

const router = express.Router();

// --- Google Classroom sync ---

// Pull the logged-in student's Classroom courses + coursework and upsert
// them into Course / Assignment / Assignment_Detail, keyed on Classroom's
// own ids (external_course_id / external_assignment_id) so re-syncing
// doesn't create duplicates.
router.post('/api/classroom/sync', requireAuth, async (req, res) => {
  try {
    // Optional: only bring in assignments due on/after this date. Skips old
    // finished semesters instead of importing everything, and (via
    // listCourseWorkSince) cuts the Classroom API calls short too.
    const cutoffDate = req.body?.cutoffDate ? new Date(req.body.cutoffDate) : null;

    const [rows] = await pool.query(
      'SELECT gg_refresh_token FROM Student WHERE user_id = ? LIMIT 1',
      [req.session.userId]
    );
    const refreshToken = rows[0]?.gg_refresh_token;
    if (!refreshToken) {
      return res.status(400).json({
        error: 'No Google Classroom access — log out and log back in with Google to grant it.',
      });
    }

    const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET);
    client.setCredentials({ refresh_token: refreshToken });
    const classroom = google.classroom({ version: 'v1', auth: client });

    // Remove previously-synced Classroom assignments that now fall before
    // the cutoff (e.g. you moved the cutoff forward, or old semesters were
    // synced before this feature existed). Scoped to this student's own
    // Google Classroom courses only — manual entries and Microsoft Teams
    // assignments are never touched here.
    let deletedCount = 0;
    if (cutoffDate) {
      const [toDelete] = await pool.query(
        `SELECT a.assignment_id
         FROM Assignment a
         JOIN Course c            ON a.course_id = c.course_id
         JOIN Assignment_Detail d ON a.assignment_id = d.assignment_id
         WHERE c.student_id = ? AND c.platform_source = 'Google Classroom' AND d.due_date < ?`,
        [req.session.userId, cutoffDate]
      );
      const ids = toDelete.map((r) => r.assignment_id);
      if (ids.length) {
        // Child tables first to satisfy the foreign key constraints.
        await pool.query('DELETE FROM Notification WHERE assignment_id IN (?)', [ids]);
        await pool.query('DELETE FROM Schedule WHERE assignment_id IN (?)', [ids]);
        await pool.query('DELETE FROM Assignment_Detail WHERE assignment_id IN (?)', [ids]);
        await pool.query('DELETE FROM Assignment WHERE assignment_id IN (?)', [ids]);
        deletedCount = ids.length;
      }
    }

    // studentId 'me' — only courses this user attends as a student.
    // courses.list otherwise also returns courses they *teach* (e.g.
    // self-created classrooms), whose coursework the coursework.me scope
    // can't read (403 — that needs the teacher-facing coursework.students).
    const { data: { courses = [] } } = await classroom.courses.list({ courseStates: ['ACTIVE'], studentId: 'me' });

    let coursesSynced = 0;
    let assignmentsSynced = 0;
    const skippedCourses = [];

    for (const course of courses) {
      // Course rows in this schema belong to one student, so match on
      // (external_course_id, student_id) rather than external id alone.
      const [existingCourse] = await pool.query(
        'SELECT course_id FROM Course WHERE external_course_id = ? AND student_id = ? LIMIT 1',
        [course.id, req.session.userId]
      );

      let courseId;
      if (existingCourse.length) {
        courseId = existingCourse[0].course_id;
        await pool.query('UPDATE Course SET course_name = ? WHERE course_id = ?', [course.name, courseId]);
      } else {
        const [ins] = await pool.query(
          `INSERT INTO Course (course_name, external_course_id, platform_source, student_id)
           VALUES (?, ?, 'Google Classroom', ?)`,
          [course.name, course.id, req.session.userId]
        );
        courseId = ins.insertId;
      }
      coursesSynced++;

      // One unreadable course must not abort the whole sync — skip it and
      // keep going so every other course's assignments still come in.
      let courseWork;
      try {
        courseWork = await listCourseWorkSince(classroom, course.id, cutoffDate);
      } catch (workErr) {
        console.warn('[classroom] skipping course %s (%s): courseWork.list failed: %s',
          course.id, course.name, workErr.message);
        skippedCourses.push(course.name);
        continue;
      }

      for (const work of courseWork) {
        // Look up whether *this student* has already turned this in.
        // 'me' works because the request is authenticated as the student.
        let submissionState = null;
        try {
          const { data: { studentSubmissions = [] } } = await classroom.courses.courseWork.studentSubmissions.list({
            courseId: course.id,
            courseWorkId: work.id,
            userId: 'me',
          });
          submissionState = studentSubmissions[0]?.state || null;
        } catch (subErr) {
          console.warn('[classroom] could not read submission state for', work.id, subErr.message);
        }
        const isFinished = submissionState === 'TURNED_IN' || submissionState === 'RETURNED';

        const dueDateTime = toMysqlDateTime(work.dueDate, work.dueTime);

        const [existingAssignment] = await pool.query(
          'SELECT assignment_id FROM Assignment WHERE external_assignment_id = ? LIMIT 1',
          [work.id]
        );

        if (existingAssignment.length) {
          const assignmentId = existingAssignment[0].assignment_id;
          await pool.query(
            'UPDATE Assignment SET title = ?, origin_link = ? WHERE assignment_id = ?',
            [work.title, work.alternateLink || null, assignmentId]
          );
          if (isFinished) {
            // Now turned in/returned — mark it done, overriding any manual status.
            await pool.query(
              'UPDATE Assignment_Detail SET description = ?, due_date = ?, status = ? WHERE assignment_id = ?',
              [work.description || null, dueDateTime, 'completed', assignmentId]
            );
          } else {
            // Still unfinished — refresh details but leave the student's own
            // status/priority (not_started / in_progress) alone.
            await pool.query(
              'UPDATE Assignment_Detail SET description = ?, due_date = ? WHERE assignment_id = ?',
              [work.description || null, dueDateTime, assignmentId]
            );
          }
        } else {
          // Brand new coursework: bring it in either way, just start it at
          // the right status so already-turned-in work shows as ส่งแล้ว
          // instead of never appearing at all.
          const initialStatus = isFinished ? 'completed' : 'not_started';

          const [ins] = await pool.query(
            `INSERT INTO Assignment (external_assignment_id, title, origin_link, course_id)
             VALUES (?, ?, ?, ?)`,
            [work.id, work.title, work.alternateLink || null, courseId]
          );
          await pool.query(
            `INSERT INTO Assignment_Detail (assignment_id, description, due_date, status, priority_score)
             VALUES (?, ?, ?, ?, 0)`,
            [ins.insertId, work.description || null, dueDateTime, initialStatus]
          );
        }
        assignmentsSynced++;
      }
    }

    res.json({ ok: true, coursesSynced, assignmentsSynced, deletedCount, skippedCourses });
  } catch (err) {
    // Google API errors carry the real reason in err.response.data — log
    // and surface that instead of just err.message, which is often just "Bad Request".
    const googleDetail = err.response?.data?.error || err.errors || null;
    console.error('[classroom] sync error:', err.message, googleDetail ? JSON.stringify(googleDetail) : '');
    res.status(500).json({
      error: 'Classroom sync failed',
      message: err.message,
      detail: googleDetail,
    });
  }
});

module.exports = router;
