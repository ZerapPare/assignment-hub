const crypto = require('crypto');
const pool = require('../db');
const { FRONTEND_URL } = require('../config');
const { findOrCreateUniversity, studentIdFromEmail, trySetStudentId } = require('./identity');
const { safeTrackEvent } = require('./analytics');

const PROVIDERS = {
  google: { accessCol: 'gg_access_token', refreshCol: 'gg_refresh_token' },
  microsoft: { accessCol: 'ms_access_token', refreshCol: 'ms_refresh_token' },
};

// `state` ties a callback to the browser session that started the flow.
// Without it anyone can feed a victim a crafted callback URL — which under
// ?link=1 would bind the attacker's platform account to the victim's.
function beginOAuth(req) {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  // Link mode only means anything for someone already logged in.
  req.session.linkMode = Boolean(req.query.link && req.session.userId);
  return state;
}

function checkState(req) {
  const expected = req.session.oauthState;
  delete req.session.oauthState;
  return Boolean(expected) && req.query.state === expected;
}

// Link mode finds the row by session, never by email — a personal Google
// address rarely matches a university Microsoft one, and matching on email
// would create a second Student instead of connecting the existing one.
async function completeLogin({ req, provider, email, name, tokens, linkMode = Boolean(req.session.linkMode) }) {
  const { accessCol, refreshCol } = PROVIDERS[provider];
  const access = tokens.access_token || null;
  let userId;

  // Link mode finds the row by session, never by email — a personal Google
  // address rarely matches a university Microsoft one, and matching on email
  // would create a second Student instead of connecting the existing one.
  if (linkMode && req.session.userId) {
    userId = req.session.userId;
    const [[existing = {}]] = await pool.query(
      `SELECT ${refreshCol} AS refresh FROM Student WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    await pool.query(
      `UPDATE Student
       SET ${accessCol} = ?, ${refreshCol} = ?, last_login_at = NOW(), last_seen_at = NOW()
       WHERE user_id = ?`,
      [access, tokens.refresh_token || existing.refresh || null, userId]
    );
  } else {
    const universityId = await findOrCreateUniversity(email);

    const [rows] = await pool.query(
      `SELECT user_id, ${refreshCol} AS refresh FROM Student WHERE university_email = ? LIMIT 1`,
      [email]
    );

    if (rows.length) {
      userId = rows[0].user_id;
      // university_id is refreshed on every login so accounts created before
      // their University row existed get backfilled instead of staying NULL.
      // The refresh token is kept when the provider doesn't return a new one.
      await pool.query(
        `UPDATE Student
         SET student_name = ?, university_id = ?, ${accessCol} = ?, ${refreshCol} = ?,
             last_login_at = NOW(), last_seen_at = NOW()
         WHERE user_id = ?`,
        [name, universityId, access, tokens.refresh_token || rows[0].refresh || null, userId]
      );
    } else {
      const [ins] = await pool.query(
        `INSERT INTO Student
           (student_name, university_email, university_id, ${accessCol}, ${refreshCol}, last_login_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [name, email, universityId, access, tokens.refresh_token || null]
      );
      userId = ins.insertId;
    }

    // Separate from the insert above so a taken id can't fail the whole login.
    await trySetStudentId(userId, studentIdFromEmail(email));
  }

  // Track only after the account write succeeds. Link mode is an integration
  // action; a normal OAuth callback is an authenticated login.
  void safeTrackEvent({
    userId,
    eventName: linkMode ? `integration.${provider}_connected` : 'auth.login_success',
    result: 'success',
    ...(linkMode ? { metadata: { provider } } : {}),
  });
  return userId;
}

function finishOAuth(req, res, provider) {
  const wasLink = Boolean(req.session.linkMode);
  delete req.session.linkMode;
  res.redirect(wasLink ? `${FRONTEND_URL}/settings?linked=${provider}` : `${FRONTEND_URL}/home`);
}

module.exports = { PROVIDERS, beginOAuth, checkState, completeLogin, finishOAuth };
