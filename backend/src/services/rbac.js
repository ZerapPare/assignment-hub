const pool = require('../db');

// Best-effort, like trySetStudentId beside it in the login path: a missing role
// is a database problem to fix, not a reason to refuse entry.
//
// Takes an executor so a caller already in a transaction (the dev seeder) can
// keep the grant on its own connection.
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
