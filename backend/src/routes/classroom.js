const express = require('express');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { CLIENT_ID, CLIENT_SECRET } = require('../config');
const {
  toMysqlDateTime,
  isoToMysqlDateTime,
  listCourseWorkSince,
  listAnnouncementsSince,
  getCreatorProfile,
} = require('../services/classroomSync');

const router = express.Router();

router.post('/api/classroom/sync', requireAuth, async (req, res) => {
  try {
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

    let deletedCount = 0;
    if (cutoffDate) {
      // 1. Purge old assignments
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
        await pool.query('DELETE FROM Notification WHERE assignment_id IN (?)', [ids]);
        await pool.query('DELETE FROM Schedule WHERE assignment_id IN (?)', [ids]);
        await pool.query('DELETE FROM Assignment_Detail WHERE assignment_id IN (?)', [ids]);
        await pool.query('DELETE FROM Assignment WHERE assignment_id IN (?)', [ids]);
        deletedCount = ids.length;
      }

      // 2. Purge old announcements
      await pool.query(
        `DELETE an FROM Announcement an
         JOIN Course c ON an.course_id = c.course_id
         WHERE c.student_id = ? AND c.platform_source = 'Google Classroom' AND an.posted_at < ?`,
        [req.session.userId, cutoffDate]
      );
    }

    const { data: { courses = [] } } = await classroom.courses.list({ courseStates: ['ACTIVE'], studentId: 'me' });

    let coursesSynced = 0;
    let assignmentsSynced = 0;
    let announcementsSynced = 0;
    const skippedCourses = [];
    const profileCache = new Map();

    for (const course of courses) {
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

      // Sync CourseWork
      let courseWork = [];
      try {
        courseWork = await listCourseWorkSince(classroom, course.id, cutoffDate);
      } catch (workErr) {
        console.warn('[classroom] skipping course %s (%s): courseWork.list failed: %s',
          course.id, course.name, workErr.message);
        skippedCourses.push(course.name);
        continue;
      }

      for (const work of courseWork) {
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
          'SELECT assignment_id FROM Assignment WHERE external_assignment_id = ? AND course_id = ? LIMIT 1',
          [work.id, courseId]
        );

        if (existingAssignment.length) {
          const assignmentId = existingAssignment[0].assignment_id;
          await pool.query(
            'UPDATE Assignment SET title = ?, origin_link = ? WHERE assignment_id = ?',
            [work.title, work.alternateLink || null, assignmentId]
          );
          await pool.query(
            'UPDATE Assignment_Detail SET description = ?, due_date = ? WHERE assignment_id = ?',
            [work.description || null, dueDateTime, assignmentId]
          );
          if (isFinished) {
            await pool.query(
              'UPDATE Assignment_Detail SET status = ? WHERE assignment_id = ? AND status_updated_at IS NULL',
              ['submitted', assignmentId]
            );
          }
        } else {
          const initialStatus = isFinished ? 'submitted' : 'not_started';

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

      // Sync Announcements
      let announcements = [];
      try {
        announcements = await listAnnouncementsSince(classroom, course.id, cutoffDate);
      } catch (annErr) {
        console.warn('[classroom] could not list announcements for course %s (%s): %s',
          course.id, course.name, annErr.message);
      }

      for (const ann of announcements) {
        const creator = await getCreatorProfile(classroom, ann.creatorUserId, profileCache);
        const postedAt = isoToMysqlDateTime(ann.creationTime);

        const [existingAnn] = await pool.query(
          'SELECT announcement_id FROM Announcement WHERE external_announcement_id = ? AND course_id = ? LIMIT 1',
          [ann.id, courseId]
        );

        if (existingAnn.length) {
          await pool.query(
            `UPDATE Announcement
             SET text_content = ?, creator_name = ?, creator_email = ?, origin_link = ?, posted_at = ?
             WHERE announcement_id = ?`,
            [
              ann.text || '',
              creator.name,
              creator.email,
              ann.alternateLink || null,
              postedAt,
              existingAnn[0].announcement_id,
            ]
          );
        } else {
          await pool.query(
            `INSERT INTO Announcement (external_announcement_id, text_content, creator_name, creator_email, origin_link, posted_at, course_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              ann.id,
              ann.text || '',
              creator.name,
              creator.email,
              ann.alternateLink || null,
              postedAt,
              courseId,
            ]
          );
        }
        announcementsSynced++;
      }
    }

    res.json({ ok: true, coursesSynced, assignmentsSynced, announcementsSynced, deletedCount, skippedCourses });
  } catch (err) {
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