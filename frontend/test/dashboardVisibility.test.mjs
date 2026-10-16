import test from 'node:test';
import assert from 'node:assert/strict';
import { isDashboardHidden, isDashboardVisible } from '../src/dashboardVisibility.mjs';

const now = new Date('2026-10-17T12:00:00Z');

test('past deadlines are hidden, exact and future deadlines remain', () => {
  assert.equal(isDashboardVisible({ due: new Date(now - 1) }, now), false);
  assert.equal(isDashboardVisible({ due: new Date(now) }, now), true);
  assert.equal(isDashboardVisible({ due: new Date(+now + 1) }, now), true);
});

test('no deadline remains visible until explicitly hidden', () => {
  for (const dashboard_hidden of [false, 0, undefined]) {
    assert.equal(isDashboardVisible({ due: null, dashboard_hidden }, now), true);
    assert.equal(isDashboardHidden({ dashboard_hidden }), false);
  }
  for (const dashboard_hidden of [true, 1]) {
    assert.equal(isDashboardVisible({ due: null, dashboard_hidden }, now), false);
    assert.equal(isDashboardHidden({ dashboard_hidden }), true);
    assert.equal(isDashboardVisible({ due: new Date(+now + 1), dashboard_hidden }, now), false);
  }
});

test('restoring visibility does not bypass the deadline filter', () => {
  const a = { due: new Date(now - 1), dashboard_hidden: 1 };
  assert.equal(isDashboardVisible(a, now), false);
  assert.equal(isDashboardVisible({ ...a, dashboard_hidden: 0 }, now), false);
});

test('time passing removes a task without changing the source data', () => {
  const assignments = [{ due: new Date(+now + 1), dashboard_hidden: 0, status: 'not_started' }];
  const original = structuredClone(assignments);
  assert.equal(assignments.filter((a) => isDashboardVisible(a, now)).length, 1);
  assert.equal(assignments.filter((a) => isDashboardVisible(a, new Date(+now + 2))).length, 0);
  assert.deepEqual(assignments, original);
});
