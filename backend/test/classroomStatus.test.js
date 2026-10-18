const test = require('node:test');
const assert = require('node:assert/strict');
const { google } = require('googleapis');
const pool = require('../src/db');
const analytics = require('../src/services/analytics');

for (const [state, previous, expected] of [
  ['TURNED_IN', 'completed', 'submitted'],
  ['RETURNED', 'in_progress', 'submitted'],
  ['RECLAIMED_BY_STUDENT', 'submitted', 'completed'],
  ['CREATED', 'submitted', 'completed'],
  ['CREATED', 'completed', 'completed'],
  ['NEW', 'in_progress', 'in_progress'],
  [null, 'submitted', 'submitted'],
]) {
  test(`Classroom ${state}: ${previous} -> ${expected}, including manually edited work`, async (t) => {
    t.mock.method(analytics, 'safeTrackEvent', async () => {});
    t.mock.method(google, 'classroom', () => ({ courses: {
      list: async () => ({ data: { courses: [{ id: 'c1', name: 'Course' }] } }),
      courseWork: {
        list: async () => ({ data: { courseWork: [{ id: 'w1', title: 'Work', state: 'PUBLISHED' }] } }),
        studentSubmissions: { list: async () => ({ data: { studentSubmissions: [{ state }] } }) },
      },
      announcements: { list: async () => ({ data: {} }) },
    } }));
    let current = previous;
    t.mock.method(pool, 'query', async (sql, params) => {
      if (sql.includes('SELECT gg_refresh_token')) return [[{ gg_refresh_token: 'fake-token' }]];
      if (sql.includes('SELECT course_id')) return [[{ course_id: 10 }]];
      if (sql.includes('SELECT assignment_id')) return [[{ assignment_id: 42 }]];
      if (sql.startsWith('UPDATE Assignment_Detail SET status')) {
        assert.doesNotMatch(sql, /status_updated_at IS NULL/);
        if (!sql.includes("AND status = 'submitted'") || current === 'submitted') current = params[0];
      }
      return [{ affectedRows: 1 }];
    });
    const routePath = require.resolve('../src/routes/classroom');
    delete require.cache[routePath];
    const router = require(routePath);
    const handler = router.stack.find((layer) => layer.route?.path === '/api/classroom/sync').route.stack.at(-1).handle;
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await handler({ session: { userId: 7 }, body: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(current, expected);
  });
}
