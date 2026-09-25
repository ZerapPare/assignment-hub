// Identity normalisation. 012 folded the `Admin` allowlist away and roles
// replaced it; these stay, keeping an address or object id comparable however
// a provider spells it.

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
