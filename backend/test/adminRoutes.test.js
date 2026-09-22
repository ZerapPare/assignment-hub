// Walks the admin routers and checks that every endpoint asks for the
// permission it is supposed to. Catches the obvious regression — someone adds
// an admin endpoint and forgets the guard, leaving it open to any administrator
// regardless of role.
//
// No database: requiring a route module only builds the router, and the mysql
// pool does not connect until something queries it.

const test = require('node:test');
const assert = require('node:assert/strict');
const adminRouter = require('../src/routes/admin');
const adminBusinessRouter = require('../src/routes/adminBusiness');
const { PERMISSIONS: P } = require('../src/rbac/permissions');

const EXPECTED = {
  'get /api/admin/dashboard': P.DASHBOARD_VIEW,
  'get /api/admin/users': P.USER_READ,
  'get /api/admin/users/:id': P.USER_READ,
  'patch /api/admin/users/:id/status': P.USER_SUSPEND,
  'get /api/admin/errors': P.ERROR_LOG_READ,
  'get /api/admin/errors/:id': P.ERROR_LOG_READ,
  'get /api/admin/system/health': P.SYSTEM_HEALTH_READ,
};

function routeGuards(router) {
  const found = new Map();
  for (const layer of router.stack) {
    if (!layer.route) continue;
    const method = Object.keys(layer.route.methods)[0];
    const codes = layer.route.stack
      .map((handler) => handler.handle?.permissionCode)
      .filter(Boolean);
    found.set(`${method} ${layer.route.path}`, codes);
  }
  return found;
}

test('every admin endpoint requires its permission', () => {
  const guards = routeGuards(adminRouter);

  for (const [route, expected] of Object.entries(EXPECTED)) {
    assert.ok(guards.has(route), `route ${route} disappeared — update this test`);
    assert.deepEqual(guards.get(route), [expected], `wrong guard on ${route}`);
  }
});

test('no admin endpoint is left unguarded', () => {
  for (const [route, codes] of routeGuards(adminRouter)) {
    assert.ok(
      codes.length > 0,
      `${route} has no requirePermission — every admin endpoint needs one`
    );
  }
});

// This one is guarded by router.use rather than per route, because the router
// owns /api/admin/business outright and every endpoint under it needs the same
// permission. The prefix guard in admin.js cannot do the same: its /api/admin
// prefix also matches these paths.
test('business analytics is guarded at the router', () => {
  const prefixGuards = adminBusinessRouter.stack
    .filter((layer) => !layer.route)
    .map((layer) => layer.handle?.permissionCode)
    .filter(Boolean);

  assert.deepEqual(prefixGuards, [P.BUSINESS_ANALYTICS_READ]);
});
