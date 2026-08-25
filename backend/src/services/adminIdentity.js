const pool = require('../db');

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email && email.length <= 255 ? email : null;
}

function normalizeMicrosoftId(value) {
  const id = String(value || '').trim().toLowerCase();
  return GUID_PATTERN.test(id) ? id : null;
}

async function completeAdminLogin({
  provider = 'google',
  email,
  name,
  microsoftTenantId,
  microsoftObjectId,
}) {
  const normalizedEmail = normalizeEmail(email);
  let rows;

  if (provider === 'microsoft') {
    const tenantId = normalizeMicrosoftId(microsoftTenantId);
    const objectId = normalizeMicrosoftId(microsoftObjectId);
    if (!tenantId || !objectId) return null;

    [rows] = await pool.query(
      `SELECT admin_id, email, display_name, is_active
       FROM Admin
       WHERE microsoft_tenant_id = ? AND microsoft_object_id = ?
       LIMIT 1`,
      [tenantId, objectId]
    );
  } else if (provider === 'google') {
    if (!normalizedEmail || !normalizedEmail.includes('@')) return null;
    [rows] = await pool.query(
      `SELECT admin_id, email, display_name, is_active
       FROM Admin
       WHERE email = ?
       LIMIT 1`,
      [normalizedEmail]
    );
  } else {
    return null;
  }

  const admin = rows[0];
  if (!admin || Number(admin.is_active) !== 1) return null;

  const displayName = String(name || '').trim().slice(0, 255) || null;
  await pool.query(
    `UPDATE Admin
     SET last_login_at = NOW(),
         display_name = COALESCE(display_name, ?)
     WHERE admin_id = ?`,
    [displayName, admin.admin_id]
  );

  return {
    admin_id: Number(admin.admin_id),
    email: normalizeEmail(admin.email),
    display_name: admin.display_name || displayName || null,
  };
}

module.exports = { completeAdminLogin, normalizeEmail, normalizeMicrosoftId };
