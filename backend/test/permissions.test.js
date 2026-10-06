const test = require('node:test');
const assert = require('node:assert/strict');
const { PERMISSIONS, ALL_PERMISSION_CODES, hasPermission } = require('../src/rbac/permissions');
const { requirePermission } = require('../src/middleware/permissions');

function fakeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
}

test('hasPermission accepts both a Set and an array', () => {
  assert.equal(hasPermission(new Set(['user.read']), 'user.read'), true);
  assert.equal(hasPermission(['user.read'], 'user.read'), true);
  assert.equal(hasPermission(new Set(['user.read']), 'user.suspend'), false);
  assert.equal(hasPermission(null, 'user.read'), false);
  assert.equal(hasPermission(undefined, 'user.read'), false);
});

test('permission codes are unique', () => {
  assert.equal(new Set(ALL_PERMISSION_CODES).size, ALL_PERMISSION_CODES.length);
});

test('a permitted admin passes straight through', () => {
  const req = { permissions: new Set([PERMISSIONS.USER_READ]), requestId: 'req-1' };
  const res = fakeRes();
  let nextArg = 'not called';

  requirePermission(PERMISSIONS.USER_READ)(req, res, (err) => { nextArg = err; });

  assert.equal(nextArg, undefined);
  assert.equal(res.statusCode, null);
});

// This body is the contract the admin console reads to tell "you lack this
// permission" apart from "you are not an admin" — keep it pinned.
test('an admin without the permission gets 403 PERMISSION_DENIED', () => {
  const req = { permissions: new Set([PERMISSIONS.USER_READ]), requestId: 'req-1' };
  const res = fakeRes();
  let nextCalled = false;

  requirePermission(PERMISSIONS.USER_SUSPEND)(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    error: 'permission denied',
    code: 'PERMISSION_DENIED',
    required_permission: 'user.suspend',
    request_id: 'req-1',
  });
});

test('an admin with no roles at all is denied', () => {
  const req = { permissions: new Set(), requestId: 'req-2' };
  const res = fakeRes();

  requirePermission(PERMISSIONS.DASHBOARD_VIEW)(req, res, () => {});

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'PERMISSION_DENIED');
});

// Fail closed and loudly: a route wired without requireAdmin is our bug, and a
// quiet 403 would hide it behind what looks like a permissions problem.
test('using the guard without requireAdmin raises instead of answering 403', () => {
  const req = { requestId: 'req-3' };
  const res = fakeRes();
  let nextArg = null;

  requirePermission(PERMISSIONS.USER_READ)(req, res, (err) => { nextArg = err; });

  assert.ok(nextArg instanceof Error);
  assert.match(nextArg.message, /without requireAdmin/);
  assert.equal(res.statusCode, null);
});
