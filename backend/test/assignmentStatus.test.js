const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/db');
const analytics = require('../src/services/analytics');

const statuses = ['not_started', 'in_progress', 'completed', 'submitted'];

for (const platform of [null, 'Google Classroom']) {
  for (const previous of statuses) {
    for (const next of statuses) {
      test(`${platform || 'manual'}: ${previous} -> ${next}`, async (t) => {
        t.mock.method(analytics, 'safeTrackEvent', async () => {});
        const updates = [];
        t.mock.method(pool, 'query', async (sql, params) => {
          if (sql.includes('SELECT a.assignment_id, d.status, c.platform_source')) {
            assert.deepEqual(params, [42, 7]);
            return [[{ assignment_id: 42, status: previous, platform_source: platform }]];
          }
          if (sql.includes('INSERT INTO Assignment_Detail')) {
            updates.push(params);
            return [{ affectedRows: 1 }];
          }
          return [[{ assignment_id: 42, status: next, platform_source: platform }]];
        });
        const routePath = require.resolve('../src/routes/assignments');
        delete require.cache[routePath];
        const router = require(routePath);
        const route = router.stack.find((layer) => layer.route?.path === '/api/assignments/:id/status').route;
        const res = {
          statusCode: 200,
          status(code) { this.statusCode = code; return this; },
          json(body) { this.body = body; return this; },
        };
        await route.stack.at(-1).handle({
          params: { id: '42' }, session: { userId: 7 }, body: { status: next },
        }, res);
        const blocked = platform && previous !== next && (previous === 'submitted' || next === 'submitted');
        assert.equal(res.statusCode, blocked ? 400 : 200);
        assert.deepEqual(updates, blocked ? [] : [[42, next]]);
      });
    }
  }
}
