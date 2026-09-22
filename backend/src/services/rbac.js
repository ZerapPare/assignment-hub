const pool = require('../db');

// Best-effort, like trySetStudentId next to it in the login path: a missing
// role is something to fix in the database, not a reason to refuse somebody
// entry. Signing in is what creates the account; the grant is what decides
// what it can reach, and failing to record it must not cost the login.
//
// Takes an optional executor so a caller already inside a transaction — the dev
// seeder, for instance — can keep the grant on its own connection.
async function tryGrantRole(userId, roleCode, executor = pool) {
  if (!userId) return;
  try {
    await executor.query(
      `INSERT IGNORE INTO User_Role (user_id, role_id)
       SELECT ?, role_id FROM Role WHERE role_code = ?`,
      [userId, roleCode]
    );
  } catch (err) {
    console.error('[rbac] role grant failed:', userId, roleCode, err.code || err.message);
  }
}

module.exports = { tryGrantRole };
