const pool = require('../db');

// The university comes from the email domain and its row is created on the
// first sign-in from that domain, so a new institution needs no seed data. The
// name starts as the domain — nothing more accurate exists until someone says.
async function findOrCreateUniversity(email) {
  const domain = (email.split('@')[1] || '').toLowerCase();
  if (!domain) return null;
  // ON DUPLICATE KEY ... LAST_INSERT_ID stops two simultaneous first-logins
  // from one domain creating two rows, and returns the existing id either way.
  const [res] = await pool.query(
    `INSERT INTO University (university_name, email_domain) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE university_id = LAST_INSERT_ID(university_id)`,
    [domain, domain]
  );
  return res.insertId || null;
}

// Thai universities commonly issue <student id>@<domain>, so an all-digit local
// part is the student id. Anything else is left for the settings page rather
// than guessed at.
function studentIdFromEmail(email) {
  const local = (email.split('@')[0] || '').trim();
  return /^\d+$/.test(local) ? local : null;
}

// Writes a derived student id, but only into an empty column and only if free.
// UNIQUE (student_id, university_id) means it can collide with someone already
// registered — a data problem for settings, not a reason to refuse entry.
async function trySetStudentId(userId, studentId) {
  if (!studentId) return;
  try {
    await pool.query(
      'UPDATE User_Account SET student_id = ? WHERE user_id = ? AND student_id IS NULL',
      [studentId, userId]
    );
  } catch (err) {
    if (err.code !== 'ER_DUP_ENTRY') throw err;
    console.warn(`[auth] student_id ${studentId} already taken at this university — leaving NULL`);
  }
}

module.exports = { findOrCreateUniversity, studentIdFromEmail, trySetStudentId };
