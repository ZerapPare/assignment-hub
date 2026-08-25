const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CLIENT_EVENTS,
  AnalyticsValidationError,
  normalizeMetadata,
  validateEventPayload,
} = require('../src/services/analytics');
const { normalizeRange } = require('../src/services/businessMetrics');

test('client event whitelist contains only client-owned interactions', () => {
  assert.deepEqual([...CLIENT_EVENTS].sort(), [
    'assignment.filter_used',
    'assignment.search_used',
    'dashboard.viewed',
  ]);
});

test('metadata keeps only safe controlled filter values', () => {
  assert.deepEqual(
    normalizeMetadata('assignment.filter_used', {
      filter_type: 'status',
      filter_value: 'completed',
    }),
    { filter_type: 'status', filter_value: 'completed' }
  );
  assert.throws(
    () => normalizeMetadata('assignment.filter_used', { filter_type: 'course', filter_value: 'private course' }),
    AnalyticsValidationError
  );
  assert.throws(
    () => normalizeMetadata('assignment.search_used', { query: 'private coursework' }),
    AnalyticsValidationError
  );
});

test('event validation rejects arbitrary results and metadata', () => {
  assert.throws(
    () => validateEventPayload({ eventName: 'dashboard.viewed', result: 'success', metadata: { secret: true } }),
    AnalyticsValidationError
  );
  assert.throws(
    () => validateEventPayload({ eventName: 'not.allowed' }),
    AnalyticsValidationError
  );
});

test('business ranges accept only the supported windows', () => {
  assert.equal(normalizeRange('7d'), 7);
  assert.equal(normalizeRange('30d'), 30);
  assert.equal(normalizeRange('90d'), 90);
  assert.equal(normalizeRange(undefined), 30);
  assert.equal(normalizeRange('365d'), null);
});
