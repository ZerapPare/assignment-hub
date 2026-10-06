const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmail, normalizeMicrosoftId } = require('../src/services/adminIdentity');

test('admin allowlist emails are normalized before lookup', () => {
  assert.equal(normalizeEmail('  Admin@Example.EDU '), 'admin@example.edu');
  assert.equal(normalizeEmail(''), null);
  assert.equal(normalizeEmail(null), null);
  assert.equal(normalizeEmail('a'.repeat(256) + '@example.edu'), null);
});

test('Microsoft admin identities require canonical GUIDs', () => {
  assert.equal(normalizeMicrosoftId('AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE'), 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  assert.equal(normalizeMicrosoftId('not-an-object-id'), null);
  assert.equal(normalizeMicrosoftId('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee'), null);
});
