const express = require('express');
const { jwtVerify } = require('jose');
const {
  FRONTEND_URL,
  CLIENT_ID,
  CLIENT_SECRET,
  oauth2,
  MS_CLIENT_ID,
  MS_CLIENT_SECRET,
  MS_REDIRECT_URL,
  MS_AUTHORIZE_URL,
  MS_TOKEN_URL,
  msJwks,
} = require('../config');
const { beginOAuth, checkState, completeLogin, finishOAuth } = require('../services/oauthSession');

const router = express.Router();

// ?link=1 connects Google to the account already in the session instead of
// signing in as a (possibly different) Google identity.
router.get('/api/auth/google', (req, res) => {
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',      // ask for a refresh token (stored for future Classroom sync)
    prompt: 'consent',
    state: beginOAuth(req),
    scope: [
      'openid', 'email', 'profile',
      'https://www.googleapis.com/auth/classroom.courses.readonly',
      // read/write variant: the readonly scope can't be declared on the
      // consent screen (console rejects it), and Google drops undeclared
      // scopes from grants — the app itself never writes coursework
      'https://www.googleapis.com/auth/classroom.coursework.me',
      'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
    ],
  });
  res.redirect(url);
});

router.get('/api/auth/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) return res.redirect(`${FRONTEND_URL}/login?error=oauth`);
  if (!checkState(req)) return res.redirect(`${FRONTEND_URL}/login?error=state`);

  try {
    const { tokens } = await oauth2.getToken(code);
    const ticket = await oauth2.verifyIdToken({ idToken: tokens.id_token, audience: CLIENT_ID });
    const payload = ticket.getPayload();
    const email = payload.email;

    req.session.userId = await completeLogin({
      req,
      provider: 'google',
      email,
      name: payload.name || email,
      tokens,
    });
    finishOAuth(req, res, 'google');
  } catch (err) {
    console.error('[auth] callback error:', err.message);
    res.redirect(`${FRONTEND_URL}/login?error=oauth`);
  }
});

// ?link=1 connects Microsoft to the account already in the session instead
// of signing in as a (possibly different) Microsoft identity.
router.get('/api/auth/microsoft', (req, res) => {
  const url = new URL(MS_AUTHORIZE_URL);
  url.searchParams.set('client_id', MS_CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', MS_REDIRECT_URL);
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('state', beginOAuth(req));
  // offline_access is what gets Microsoft to return a refresh_token (like Google's access_type: 'offline').
  url.searchParams.set('scope', 'openid email profile offline_access User.Read');
  res.redirect(url.toString());
});

router.get('/api/auth/microsoft/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) return res.redirect(`${FRONTEND_URL}/login?error=oauth`);
  if (!checkState(req)) return res.redirect(`${FRONTEND_URL}/login?error=state`);

  try {
    const tokenRes = await fetch(MS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET,
        code,
        redirect_uri: MS_REDIRECT_URL,
        grant_type: 'authorization_code',
        scope: 'openid email profile offline_access User.Read',
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.id_token) {
      throw new Error(tokens.error_description || 'token exchange failed');
    }

    const { payload } = await jwtVerify(tokens.id_token, msJwks, { audience: MS_CLIENT_ID });
    const email = payload.email || payload.preferred_username;

    req.session.userId = await completeLogin({
      req,
      provider: 'microsoft',
      email,
      name: payload.name || email,
      tokens,
    });
    finishOAuth(req, res, 'microsoft');
  } catch (err) {
    console.error('[auth] microsoft callback error:', err.message);
    res.redirect(`${FRONTEND_URL}/login?error=oauth`);
  }
});

router.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

module.exports = router;
