const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidOptionalTimeRange } = require('../src/utils/timeRange');

test('allows lunch to be disabled when both times are null', () => {
  assert.equal(isValidOptionalTimeRange(null, null), true);
});

test('accepts a valid time range with or without seconds', () => {
  assert.equal(isValidOptionalTimeRange('12:00', '13:00'), true);
  assert.equal(isValidOptionalTimeRange('12:00:30', '12:00:45'), true);
});

test('accepts midnight as the next-day end time', () => {
  assert.equal(isValidOptionalTimeRange('13:00', '00:00'), true);
  assert.equal(isValidOptionalTimeRange('23:59:00', '00:00:00'), true);
});

test('rejects equal or reversed time ranges', () => {
  assert.equal(isValidOptionalTimeRange('12:00', '12:00'), false);
  assert.equal(isValidOptionalTimeRange('13:00', '12:00'), false);
  assert.equal(isValidOptionalTimeRange('00:00', '00:00'), false);
});

test('rejects invalid or partially configured time ranges', () => {
  assert.equal(isValidOptionalTimeRange('24:00', '25:00'), false);
  assert.equal(isValidOptionalTimeRange('12:00', null), false);
  assert.equal(isValidOptionalTimeRange(null, '13:00'), false);
});
