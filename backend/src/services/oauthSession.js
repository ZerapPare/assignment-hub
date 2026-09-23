const crypto = require('crypto');
const pool = require('../db');
const { FRONTEND_URL } = require('../config');
const { findOrCreateUniversity, studentIdFromEmail, trySetStudentId } = require('./identity');
const { tryGrantRole } = require('./rbac');
const { ADMIN_PERMISSION_CODES, ROLES } = require('../rbac/permissions');
const { loadAccount } = require('../middleware/auth');
const { safeTrackEvent } = require('./analytics');

const PROVIDERS = {
  google: { accessCol: 'gg_access_token', refreshCol: 'gg_refresh_token' },
  microsoft: { accessCol: 'ms_access_token', refreshCol: 'ms_refresh_token' },
};

// `state` ties a callback to the session that started the flow. Without it a
// crafted callback URL under ?link=1 binds an attacker's account to the victim's.
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

async function completeLogin({ req, provider, email, name, tokens, linkMode = Boolean(req.session.linkMode) }) {
  const { accessCol, refreshCol } = PROVIDERS[provider];
  const access = tokens.access_token || null;
  let userId;

  // Link mode finds the row by session, never by email: a personal Google
  // address rarely matches a university Microsoft one, and matching on email
  // would create a second account instead of connecting the existing one.
  if (linkMode && req.session.userId) {
    userId = req.session.userId;
    const [[existing = {}]] = await pool.query(
      `SELECT ${refreshCol} AS refresh FROM User_Account WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    await pool.query(
      `UPDATE User_Account
       SET ${accessCol} = ?, ${refreshCol} = ?, last_login_at = NOW(), last_seen_at = NOW()
       WHERE user_id = ?`,
      [access, tokens.refresh_token || existing.refresh || null, userId]
    );
  } else {
    const universityId = await findOrCreateUniversity(email);

    const [rows] = await pool.query(
      `SELECT user_id, ${refreshCol} AS refresh FROM User_Account WHERE email = ? LIMIT 1`,
      [email]
    );

    if (rows.length) {
      userId = rows[0].user_id;
      // university_id is refreshed every login so accounts created before their
      // University row existed get backfilled. The refresh token is kept when
      // the provider returns no new one.
      await pool.query(
        `UPDATE User_Account
         SET full_name = ?, university_id = ?, ${accessCol} = ?, ${refreshCol} = ?,
             last_login_at = NOW(), last_seen_at = NOW()
         WHERE user_id = ?`,
        [name, universityId, access, tokens.refresh_token || rows[0].refresh || null, userId]
      );
    } else {
      const [ins] = await pool.query(
        `INSERT INTO User_Account
           (full_name, email, user_type, university_id, ${accessCol}, ${refreshCol}, last_login_at, last_seen_at)
         VALUES (?, ?, 'student', ?, ?, ?, NOW(), NOW())`,
        [name, email, universityId, access, tokens.refresh_token || null]
      );
      userId = ins.insertId;

      // Signing in makes an ordinary account and nothing more. The admin console
      // needs a role granted afterwards — what replaced the old allowlist.
      await tryGrantRole(userId, ROLES.STUDENT);
    }

    // Separate from the insert above so a taken id can't fail the whole login.
    await trySetStudentId(userId, studentIdFromEmail(email));
  }

  // Tracked only after the account write succeeds. Link mode is an integration
  // action; a normal callback is a login.
  void safeTrackEvent({
    userId,
    eventName: linkMode ? `integration.${provider}_connected` : 'auth.login_success',
    result: 'success',
    ...(linkMode ? { metadata: { provider } } : {}),
  });
  return userId;
}

async function finishOAuth(req, res, provider) {
  const wasLink = Boolean(req.session.linkMode);
  delete req.session.linkMode;
  if (wasLink) {
    res.redirect(`${FRONTEND_URL}/settings?linked=${provider}`);
    return;
  }

  const account = await loadAccount(req.session.userId);
  const isAdmin = account?.permissions?.some((permission) =>
    ADMIN_PERMISSION_CODES.includes(permission)
  );
  res.redirect(`${FRONTEND_URL}${isAdmin ? '/admin' : '/home'}`);
}

module.exports = { PROVIDERS, beginOAuth, checkState, completeLogin, finishOAuth };
