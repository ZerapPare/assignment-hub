// Identity normalisation helpers.
//
// This module used to own completeAdminLogin, which looked an administrator up
// in the `Admin` allowlist during a login flow of its own. Migration 013 folded
// that table into User_Account and roles replaced the allowlist, so the lookup
// is gone; the normalisers stay because they are what keep an email address or
// a Microsoft object id comparable no matter how a provider spells it.

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email && email.length <= 255 ? email : null;
}

function normalizeMicrosoftId(value) {
  const id = String(value || '').trim().toLowerCase();
  return GUID_PATTERN.test(id) ? id : null;
}

module.exports = { normalizeEmail, normalizeMicrosoftId };
