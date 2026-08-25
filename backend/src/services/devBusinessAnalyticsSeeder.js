const MOCK_EVENT_MARKER = 'mock-business-analytics-v1';

const MOCK_EVENTS = [
  ['auth.login_success', 'authentication', 0],
  ['dashboard.viewed', 'dashboard', 0],
  ['integration.google_connected', 'integrations', 0],
  ['integration.microsoft_connected', 'integrations', 1],
  ['classroom.sync_requested', 'classroom_sync', 1],
  ['classroom.sync_success', 'classroom_sync', 1],
  ['assignment.manual_created', 'manual_task', 2],
  ['assignment.manual_updated', 'manual_task', 3],
  ['assignment.status_changed', 'task_status', 2],
  ['assignment.search_used', 'search_filter', 4],
  ['assignment.filter_used', 'search_filter', 5],
  ['notification.settings_updated', 'notification_settings', 6],
];

function daysAgo(now, days) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function eventMetadata(eventName) {
  const metadata = { mock_seed: MOCK_EVENT_MARKER };
  if (eventName.startsWith('integration.')) metadata.provider = eventName.split('.')[1].replace('_connected', '');
  if (eventName.startsWith('classroom.')) metadata.provider = 'google';
  if (eventName === 'assignment.manual_created' || eventName === 'assignment.manual_updated') metadata.task_type = 'homework';
  if (eventName === 'assignment.status_changed') {
    metadata.from = 'in_progress';
    metadata.to = 'completed';
  }
  if (eventName === 'assignment.search_used') metadata.has_query = true;
  if (eventName === 'assignment.filter_used') {
    metadata.filter_type = 'status';
    metadata.filter_value = 'in_progress';
  }
  if (eventName === 'notification.settings_updated') {
    metadata.enabled = true;
    metadata.daily_repeat = false;
    metadata.lead_time_count = 2;
  }
  return JSON.stringify(metadata);
}

async function seedMockBusinessAnalytics({ db, now = new Date() } = {}) {
  if (!db || typeof db.query !== 'function' || typeof db.getConnection !== 'function') {
    throw new Error('A MySQL pool is required to seed mock business analytics');
  }

  const [students] = await db.query(
    `SELECT user_id, university_email
     FROM Student
     WHERE student_id LIKE 'MOCK-%' AND university_email LIKE '%.test'`
  );
  if (!students.length) throw new Error('Seed mock users before mock business analytics');

  let connection;
  let transactionStarted = false;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const userIds = students.map((student) => student.user_id);
    await connection.query(
      `DELETE FROM Product_Event
       WHERE user_id IN (?) AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.mock_seed')) = ?`,
      [userIds, MOCK_EVENT_MARKER]
    );

    for (const student of students) {
      for (const [eventName, featureName, offset] of MOCK_EVENTS) {
        await connection.query(
          `INSERT INTO Product_Event
             (user_id, event_name, feature_name, event_result, metadata, created_at)
           VALUES (?, ?, ?, 'success', ?, ?)`,
          [student.user_id, eventName, featureName, eventMetadata(eventName), daysAgo(now, offset)]
        );
      }

      const courses = [
        { name: 'Mock Google Classroom', source: 'Google Classroom', key: 'google' },
        { name: 'Mock Manual Tasks', source: null, key: 'manual' },
        { name: 'Mock Microsoft Teams', source: 'Microsoft Teams', key: 'teams' },
      ];
      for (const course of courses) {
        const externalId = `MOCK-BUSINESS-${student.user_id}-${course.key}`;
        const [existingCourses] = await connection.query(
          'SELECT course_id FROM Course WHERE external_course_id = ? AND student_id = ? LIMIT 1 FOR UPDATE',
          [externalId, student.user_id]
        );
        let courseId = existingCourses[0]?.course_id;
        if (courseId) {
          await connection.query(
            'UPDATE Course SET course_name = ?, platform_source = ? WHERE course_id = ?',
            [course.name, course.source, courseId]
          );
        } else {
          const [result] = await connection.query(
            `INSERT INTO Course (course_name, external_course_id, platform_source, student_id)
             VALUES (?, ?, ?, ?)`,
            [course.name, externalId, course.source, student.user_id]
          );
          courseId = result.insertId;
        }
        const assignmentExternalId = `${externalId}-ASSIGNMENT`;
        const [existingAssignments] = await connection.query(
          'SELECT assignment_id FROM Assignment WHERE external_assignment_id = ? AND course_id = ? LIMIT 1 FOR UPDATE',
          [assignmentExternalId, courseId]
        );
        if (existingAssignments.length) continue;
        const [assignment] = await connection.query(
          `INSERT INTO Assignment (external_assignment_id, title, task_type, course_id)
           VALUES (?, ?, 'homework', ?)`,
          [assignmentExternalId, `${course.name} assignment`, courseId]
        );
        await connection.query(
          `INSERT INTO Assignment_Detail (assignment_id, status, due_date)
           VALUES (?, 'in_progress', ?)`,
          [assignment.insertId, daysAgo(now, -7)]
        );
      }
    }

    await connection.commit();
    transactionStarted = false;
    return { userCount: students.length, eventCount: students.length * MOCK_EVENTS.length };
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { MOCK_EVENT_MARKER, MOCK_EVENTS, seedMockBusinessAnalytics };
