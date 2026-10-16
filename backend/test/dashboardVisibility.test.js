const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/db');
const analytics = require('../src/services/analytics');
const errorLogger = require('../src/services/errorLogger');
const { requireAuth } = require('../src/middleware/auth');

function setup(t, query, method = 'patch') {
  t.mock.method(pool, 'query', query);
  t.mock.method(analytics, 'safeTrackEvent', async () => {});
  t.mock.method(errorLogger, 'logError', async () => {});
  const path = require.resolve('../src/routes/assignments');
  delete require.cache[path];
  const router = require(path);
  const route = router.stack.find((layer) => layer.route?.path ===
    (method === 'get' ? '/api/assignments' : '/api/assignments/:id')
    && layer.route.methods[method]).route;
  const req = { params: { id: '42' }, session: { userId: 7 }, query: {}, body: {} };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  return { req, res, route, handler: route.stack.at(-1).handle };
}

for (const platform of [null, 'Google Classroom']) {
  for (const hidden of [true, false]) {
    test(`visibility=${hidden} for ${platform || 'manual'} work`, async (t) => {
      let calls = 0;
      const row = { assignment_id: 42, platform_source: platform, status: 'in_progress', dashboard_hidden: Number(hidden) };
      const ctx = setup(t, async (sql, params) => {
        calls++;
        if (calls === 1) {
          assert.match(sql, /c\.student_id = \?/);
          assert.doesNotMatch(sql, /platform_source IS NULL/);
          assert.deepEqual(params, [42, 7]);
          return [[{ assignment_id: 42 }]];
        }
        if (calls === 2) {
          assert.match(sql, /INSERT INTO Assignment_Detail \(assignment_id, dashboard_hidden\)/);
          assert.match(sql, /ON DUPLICATE KEY UPDATE dashboard_hidden = VALUES\(dashboard_hidden\)/);
          assert.doesNotMatch(sql, /status|due_date|description/);
          assert.deepEqual(params, [42, hidden]);
          return [{ affectedRows: 1 }];
        }
        assert.match(sql, /COALESCE\(d.dashboard_hidden, 0\) AS dashboard_hidden/);
        return [[row]];
      });
      ctx.req.body = { dashboard_hidden: hidden };
      await ctx.handler(ctx.req, ctx.res);
      assert.equal(ctx.res.statusCode, 200);
      assert.deepEqual(ctx.res.body, row);
      assert.equal(calls, 3);
      assert.equal(ctx.route.stack[0].handle, requireAuth);
    });
  }
}

for (const body of [
  { dashboard_hidden: null }, { dashboard_hidden: 'false' }, { dashboard_hidden: 0 },
  { dashboard_hidden: true, title: 'changed' },
  { dashboard_hidden: false, due_date: null },
]) {
  test(`reject invalid/mixed visibility: ${JSON.stringify(body)}`, async (t) => {
    const ctx = setup(t, async () => assert.fail('must not query or mutate'));
    ctx.req.body = body;
    await ctx.handler(ctx.req, ctx.res);
    assert.equal(ctx.res.statusCode, 400);
  });
}

test('visibility cannot be changed outside the owned scope', async (t) => {
  let calls = 0;
  const ctx = setup(t, async (sql, params) => {
    calls++;
    assert.deepEqual(params, [42, 7]);
    assert.match(sql, /c\.student_id = \?/);
    return [[]];
  });
  ctx.req.body = { dashboard_hidden: true };
  await ctx.handler(ctx.req, ctx.res);
  assert.equal(ctx.res.statusCode, 404);
  assert.equal(calls, 1);
});

test('invalid ids are rejected before querying', async (t) => {
  const ctx = setup(t, async () => assert.fail('must not query'));
  ctx.req.params.id = 'invalid';
  ctx.req.body = { dashboard_hidden: true };
  await ctx.handler(ctx.req, ctx.res);
  assert.equal(ctx.res.statusCode, 404);
});

for (const failAt of [1, 2]) {
  test(`visibility reports database failure at query ${failAt}`, async (t) => {
    let calls = 0;
    const ctx = setup(t, async () => {
      if (++calls === failAt) throw new Error('offline');
      return [[{ assignment_id: 42 }]];
    });
    ctx.req.body = { dashboard_hidden: false };
    await ctx.handler(ctx.req, ctx.res);
    assert.equal(ctx.res.statusCode, 503);
  });
}

test('Classroom content edits remain outside the editable scope', async (t) => {
  const ctx = setup(t, async (sql) => {
    assert.match(sql, /c\.student_id = \? AND c\.platform_source IS NULL/);
    return [[]];
  });
  ctx.req.body = { title: 'changed' };
  await ctx.handler(ctx.req, ctx.res);
  assert.equal(ctx.res.statusCode, 404);
});

test('manual content edits still follow the original path', async (t) => {
  let calls = 0;
  const ctx = setup(t, async (sql) => {
    if (++calls === 1) {
      assert.match(sql, /c\.platform_source IS NULL/);
      return [[{ assignment_id: 42 }]];
    }
    if (calls === 2) {
      assert.match(sql, /UPDATE Assignment SET title = \?/);
      return [{ affectedRows: 1 }];
    }
    return [[{ assignment_id: 42, title: 'changed', dashboard_hidden: 1 }]];
  });
  ctx.req.body = { title: 'changed' };
  await ctx.handler(ctx.req, ctx.res);
  assert.equal(ctx.res.statusCode, 200);
  assert.equal(ctx.res.body.dashboard_hidden, 1);
  assert.equal(calls, 3);
});

test('the unfiltered list still returns hidden and overdue assignments', async (t) => {
  const rows = [{ assignment_id: 42, dashboard_hidden: 1, due_date: '2020-01-01' }];
  const ctx = setup(t, async (sql) => {
    assert.match(sql, /COALESCE\(d.dashboard_hidden, 0\) AS dashboard_hidden/);
    assert.doesNotMatch(sql.slice(sql.indexOf('WHERE')), /dashboard_hidden|NOW\(|CURRENT_TIMESTAMP/);
    return [rows];
  }, 'get');
  await ctx.handler(ctx.req, ctx.res);
  assert.deepEqual(ctx.res.body, rows);
});
