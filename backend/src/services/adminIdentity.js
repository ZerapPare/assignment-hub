// Identity normalisation helpers.
//
// completeAdminLogin used to live here, looking administrators up in the `Admin`
// allowlist. Migration 013 folded that table away and roles replaced the
// allowlist. The normalisers stay: they keep an email or a Microsoft object id
// comparable however a provider spells it.

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
