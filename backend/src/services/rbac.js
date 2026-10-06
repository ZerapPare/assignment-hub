const pool = require('../db');

// Best-effort, like trySetStudentId: a missing role is a database problem, not
// a reason to refuse entry. Takes an executor so a transaction can keep its own.
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
