const test = require('node:test');
const assert = require('node:assert/strict');
const { google } = require('googleapis');
const pool = require('../src/db');
const analytics = require('../src/services/analytics');

for (const state of ['CREATED', 'TURNED_IN', 'RETURNED']) {
  test(`sync keeps dashboard visibility on existing work (${state})`, async (t) => {
    t.mock.method(analytics, 'safeTrackEvent', async () => {});
    t.mock.method(google, 'classroom', () => ({
      courses: {
        list: async () => ({ data: { courses: [{ id: 'course1', name: 'Course' }] } }),
        courseWork: {
          list: async () => ({ data: { courseWork: [{ id: 'work1', title: 'Work', state: 'PUBLISHED' }] } }),
          studentSubmissions: {
            list: async () => ({ data: { studentSubmissions: [{ state }] } }),
          },
        },
        announcements: { list: async () => ({ data: {} }) },
      },
    }));
    const updates = [];
    t.mock.method(pool, 'query', async (sql) => {
      if (sql.includes('SELECT gg_refresh_token')) return [[{ gg_refresh_token: 'fake-token' }]];
      if (sql.includes('SELECT course_id')) return [[{ course_id: 10 }]];
      if (sql.includes('SELECT assignment_id')) return [[{ assignment_id: 42 }]];
      assert.match(sql, /^UPDATE /);
      assert.doesNotMatch(sql, /dashboard_hidden/);
      updates.push(sql);
      return [{ affectedRows: 1 }];
    });
    const path = require.resolve('../src/routes/classroom');
    delete require.cache[path];
    const router = require(path);
    const handler = router.stack.find((layer) => layer.route?.path === '/api/classroom/sync').route.stack.at(-1).handle;
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await handler({ session: { userId: 7 }, body: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.assignmentsSynced, 1);
    assert.ok(updates.some((sql) => sql.startsWith('UPDATE Assignment_Detail SET description')));
    assert.ok(updates.some((sql) => sql.startsWith('UPDATE Assignment_Detail SET status')));
  });
}
