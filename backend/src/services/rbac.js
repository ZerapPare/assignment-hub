const pool = require('../db');
const { ROLES } = require('../rbac/permissions');

// Student.user_id and Admin.user_id both reference User_Account, so the
// User_Account row has to exist before the subtype row does. This returns the
// id to insert the subtype row with.
//
// ON DUPLICATE KEY ... LAST_INSERT_ID mirrors findOrCreateUniversity: two
// simultaneous first-logins from the same address cannot create two rows, and
// either way the caller gets the existing id. It also means a User_Account left
// behind by a failed Student insert is picked back up on the retry instead of
// blocking it.
async function ensureUserAccount({ email, displayName, userType }) {
  const [res] = await pool.query(
    `INSERT INTO User_Account (email, display_name, user_type)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       user_id = LAST_INSERT_ID(user_id),
       display_name = COALESCE(VALUES(display_name), User_Account.display_name)`,
    [email, displayName || null, userType]
  );
  return res.insertId || null;
}

// Best-effort, like trySetStudentId: a missing role is a permissions problem to
// fix in the database, not a reason to refuse someone entry. Students are not
// permission-checked yet (requireAuth guards their routes), so a failure here
// costs nothing today and is visible in the logs.
async function tryGrantRole(userId, roleCode) {
  if (!userId) return;
  try {
    await pool.query(
      `INSERT IGNORE INTO User_Role (user_id, role_id)
       SELECT ?, role_id FROM Role WHERE role_code = ?`,
      [userId, roleCode]
    );
  } catch (err) {
    console.error('[rbac] role grant failed:', userId, roleCode, err.code || err.message);
  }
}

// Called on the new-student path of the OAuth callback and by the dev seeder.
async function createStudentAccount({ email, displayName }) {
  const userId = await ensureUserAccount({ email, displayName, userType: 'student' });
  await tryGrantRole(userId, ROLES.STUDENT);
  return userId;
}

module.exports = { ensureUserAccount, tryGrantRole, createStudentAccount };
