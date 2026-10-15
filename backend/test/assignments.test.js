const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/db');
const analytics = require('../src/services/analytics');
const errorLogger = require('../src/services/errorLogger');

function setup(t, { owned = true, schedule = false, notification = false, failAt } = {}) {
  const calls = [];
  const rows = new Set(['Assignment', 'Assignment_Detail']);
  if (schedule) rows.add('Schedule');
  if (notification) rows.add('Notification');
  const original = new Set(rows);
  const conn = {
    async beginTransaction() { calls.push('begin'); },
    async query(sql, params) {
      assert.deepEqual(params, [42]);
      const table = /^DELETE FROM (\w+) WHERE assignment_id = \?$/.exec(sql)?.[1];
      assert.ok(table, `unexpected query: ${sql}`);
      calls.push(table);
      if (table === failAt) throw new Error('query failed');
      if (table === 'Assignment_Detail') {
        assert.ok(!rows.has('Schedule') && !rows.has('Notification'), 'dependent rows block deletion');
      }
      if (table === 'Assignment') assert.ok(!rows.has('Assignment_Detail'));
      rows.delete(table);
      return [{ affectedRows: 1 }];
    },
    async commit() { calls.push('commit'); },
    async rollback() {
      calls.push('rollback');
      rows.clear();
      for (const table of original) rows.add(table);
    },
    release() { calls.push('release'); },
  };
  t.mock.method(pool, 'query', async (sql, params) => {
    assert.match(sql, /c\.student_id = \? AND c\.platform_source IS NULL/);
    assert.deepEqual(params, [42, 7]);
    calls.push('ownership');
    return [owned ? [{ assignment_id: 42 }] : []];
  });
  t.mock.method(pool, 'getConnection', async () => {
    calls.push('connection');
    return conn;
  });
  const track = t.mock.method(analytics, 'safeTrackEvent', async () => {});
  const log = t.mock.method(errorLogger, 'logError', async () => {});
  t.mock.method(console, 'error', () => {});
  const routePath = require.resolve('../src/routes/assignments');
  delete require.cache[routePath];
  const router = require(routePath);
  const route = router.stack.find((layer) => layer.route?.methods.delete).route;
  const handler = route.stack.at(-1).handle;
  const req = { params: { id: '42' }, session: { userId: 7 }, requestId: 'test-delete' };
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send() { return this; },
  };
  return { calls, rows, original, track, log, req, res, handler, route };
}

for (const [schedule, notification] of [[false, false], [true, false], [false, true], [true, true]]) {
  test(`manual assignment deletion succeeds (schedule=${schedule}, notification=${notification})`, async (t) => {
    const ctx = setup(t, { schedule, notification });
    await ctx.handler(ctx.req, ctx.res);
    assert.equal(ctx.res.statusCode, 204);
    assert.equal(ctx.rows.size, 0);
    assert.deepEqual(ctx.calls, [
      'ownership', 'connection', 'begin', 'Notification', 'Schedule',
      'Assignment_Detail', 'Assignment', 'commit', 'release',
    ]);
    assert.equal(ctx.track.mock.callCount(), 1);
    assert.deepEqual(ctx.track.mock.calls[0].arguments[0], {
      userId: 7, eventName: 'assignment.manual_deleted', result: 'success',
    });
  });
}

for (const failAt of ['Notification', 'Schedule', 'Assignment_Detail', 'Assignment']) {
  test(`deletion rolls back and releases the connection when ${failAt} deletion fails`, async (t) => {
    const ctx = setup(t, { schedule: true, notification: true, failAt });
    await ctx.handler(ctx.req, ctx.res);
    assert.equal(ctx.res.statusCode, 500);
    assert.equal(ctx.res.body.error, 'ลบงานไม่สำเร็จ กรุณาลองอีกครั้ง');
    assert.equal(ctx.res.body.request_id, ctx.req.requestId);
    assert.deepEqual(ctx.rows, ctx.original);
    assert.deepEqual(ctx.calls.slice(-2), ['rollback', 'release']);
    assert.ok(!ctx.calls.includes('commit'));
    assert.equal(ctx.track.mock.callCount(), 0);
    assert.equal(ctx.log.mock.callCount(), 1);
  });
}

test('an assignment outside the owned manual scope is not deleted', async (t) => {
  const ctx = setup(t, { owned: false });
  await ctx.handler(ctx.req, ctx.res);
  assert.equal(ctx.res.statusCode, 404);
  assert.deepEqual(ctx.calls, ['ownership']);
  assert.equal(ctx.track.mock.callCount(), 0);
});

test('an invalid assignment id is rejected before querying the database', async (t) => {
  const ctx = setup(t);
  ctx.req.params.id = 'invalid';
  await ctx.handler(ctx.req, ctx.res);
  assert.equal(ctx.res.statusCode, 404);
  assert.deepEqual(ctx.calls, []);
});

test('deletion requires authentication', (t) => {
  const ctx = setup(t);
  const { requireAuth } = require('../src/middleware/auth');
  assert.equal(ctx.route.stack[0].handle, requireAuth);
});
