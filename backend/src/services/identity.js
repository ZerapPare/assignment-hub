const pool = require('../db');

// --- Identity: university + student id ---

// A student's university is derived from their email domain, and its row is
// created the first time anyone from that domain signs in — so supporting a
// new institution needs no seed data or code change. The name starts as the
// domain itself; there's nothing more accurate to call it until someone says.
async function findOrCreateUniversity(email) {
  const domain = (email.split('@')[1] || '').toLowerCase();
  if (!domain) return null;
  // ON DUPLICATE KEY ... LAST_INSERT_ID keeps two simultaneous first-logins
  // from one domain creating two rows, and yields the existing id either way.
  const [res] = await pool.query(
    `INSERT INTO University (university_name, email_domain) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE university_id = LAST_INSERT_ID(university_id)`,
    [domain, domain]
  );
  return res.insertId || null;
}

// Thai universities commonly issue <student id>@<domain> addresses, so an
// all-digit local part is the student id. Anything else — name-based
// addresses, personal Google accounts — is left for the student to fill in
// on the settings page rather than guessed at.
function studentIdFromEmail(email) {
  const local = (email.split('@')[0] || '').trim();
  return /^\d+$/.test(local) ? local : null;
}

// Writes an auto-derived student id, but only into an empty column and only
// if it's free. The unique (student_id, university_id) set means a derived id
// can collide with someone already registered — that's a data problem to sort
// out in settings, not a reason to refuse someone entry.
async function trySetStudentId(userId, studentId) {
  if (!studentId) return;
  try {
    await pool.query(
      'UPDATE Student SET student_id = ? WHERE user_id = ? AND student_id IS NULL',
      [studentId, userId]
    );
  } catch (err) {
    if (err.code !== 'ER_DUP_ENTRY') throw err;
    console.warn(`[auth] student_id ${studentId} already taken at this university — leaving NULL`);
  }
}

module.exports = { findOrCreateUniversity, studentIdFromEmail, trySetStudentId };
