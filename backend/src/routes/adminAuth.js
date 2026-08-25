const crypto = require('crypto');
const express = require('express');
const { jwtVerify } = require('jose');
const {
  CLIENT_ID,
  FRONTEND_URL,
  MS_ADMIN_REDIRECT_URL,
  MS_AUTHORIZE_URL,
  MS_CLIENT_ID,
  MS_CLIENT_SECRET,
  MS_TOKEN_URL,
  MS_ADMIN_TENANT_IDS,
  adminOauth2,
  msJwks,
} = require('../config');
const { logError } = require('../services/errorLogger');
const { completeAdminLogin, normalizeMicrosoftId } = require('../services/adminIdentity');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const ADMIN_OAUTH_PURPOSE = 'admin_login';

function beginAdminOAuth(req, provider) {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.adminOAuthState = state;
  req.session.adminOAuthPurpose = ADMIN_OAUTH_PURPOSE;
  req.session.adminOAuthProvider = provider;
  return state;
}

function checkAdminOAuthState(req, provider) {
  const expected = req.session.adminOAuthState;
  const purpose = req.session.adminOAuthPurpose;
  const expectedProvider = req.session.adminOAuthProvider;
  delete req.session.adminOAuthState;
  delete req.session.adminOAuthPurpose;
  delete req.session.adminOAuthProvider;
  return Boolean(expected)
    && purpose === ADMIN_OAUTH_PURPOSE
    && expectedProvider === provider
    && req.query.state === expected;
}

function adminLoginRedirect(res, error) {
  return res.redirect(`${FRONTEND_URL}/admin/login?error=${encodeURIComponent(error)}`);
}

function getTrustedMicrosoftIdentity(payload) {
  const tenantId = normalizeMicrosoftId(payload?.tid);
  const objectId = normalizeMicrosoftId(payload?.oid);
  if (!tenantId || !objectId || !MS_ADMIN_TENANT_IDS.includes(tenantId)) return null;

  const expectedIssuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
  if (String(payload?.iss || '').toLowerCase() !== expectedIssuer) return null;
  return { tenantId, objectId };
}

function establishAdminSession(req, admin) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenerateError) => {
      if (regenerateError) return reject(regenerateError);
      req.session.userId = null;
      req.session.adminId = admin.admin_id;
      req.session.authType = 'admin';
      req.session.save((saveError) => {
        if (saveError) return reject(saveError);
        resolve();
      });
    });
  });
}

router.get('/api/admin/auth/google', (req, res) => {
  const url = adminOauth2.generateAuthUrl({
    access_type: 'online',
    prompt: 'select_account',
    state: beginAdminOAuth(req, 'google'),
    scope: ['openid', 'email', 'profile'],
  });
  res.redirect(url);
});

router.get('/api/admin/auth/google/callback', async (req, res) => {
  if (!checkAdminOAuthState(req, 'google')) return adminLoginRedirect(res, 'state');
  if (req.query.error || !req.query.code) return adminLoginRedirect(res, 'oauth');

  try {
    const { tokens } = await adminOauth2.getToken(req.query.code);
    const ticket = await adminOauth2.verifyIdToken({
      idToken: tokens.id_token,
      audience: CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (payload.email_verified !== true) return adminLoginRedirect(res, 'forbidden');

    const admin = await completeAdminLogin({
      provider: 'google',
      email: payload.email,
      name: payload.name || payload.email,
    });
    if (!admin) return adminLoginRedirect(res, 'forbidden');

    await establishAdminSession(req, admin);
    return res.redirect(`${FRONTEND_URL}/admin`);
  } catch (err) {
    void logError(err, req, { source: 'admin-auth', statusCode: 500 });
    console.error('[admin-auth] Google callback failed:', req.requestId, err.code || 'unknown');
    return adminLoginRedirect(res, 'oauth');
  }
});

router.get('/api/admin/auth/microsoft', (req, res) => {
  const url = new URL(MS_AUTHORIZE_URL);
  url.searchParams.set('client_id', MS_CLIENT_ID || '');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', MS_ADMIN_REDIRECT_URL);
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('state', beginAdminOAuth(req, 'microsoft'));
  url.searchParams.set('scope', 'openid email profile');
  res.redirect(url.toString());
});

router.get('/api/admin/auth/microsoft/callback', async (req, res) => {
  if (!checkAdminOAuthState(req, 'microsoft')) return adminLoginRedirect(res, 'state');
  if (req.query.error || !req.query.code) return adminLoginRedirect(res, 'oauth');

  try {
    const tokenRes = await fetch(MS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: MS_CLIENT_ID || '',
        client_secret: MS_CLIENT_SECRET || '',
        code: req.query.code,
        redirect_uri: MS_ADMIN_REDIRECT_URL,
        grant_type: 'authorization_code',
        scope: 'openid email profile',
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.id_token) {
      throw new Error('admin Microsoft token exchange failed');
    }

    const { payload } = await jwtVerify(tokens.id_token, msJwks, { audience: MS_CLIENT_ID });
    const identity = getTrustedMicrosoftIdentity(payload);
    if (!identity) return adminLoginRedirect(res, 'forbidden');
    const email = payload.email || payload.preferred_username;
    const admin = await completeAdminLogin({
      provider: 'microsoft',
      email,
      name: payload.name || email,
      microsoftTenantId: identity.tenantId,
      microsoftObjectId: identity.objectId,
    });
    if (!admin) return adminLoginRedirect(res, 'forbidden');

    await establishAdminSession(req, admin);
    return res.redirect(`${FRONTEND_URL}/admin`);
  } catch (err) {
    void logError(err, req, { source: 'admin-auth', statusCode: 500 });
    console.error('[admin-auth] Microsoft callback failed:', req.requestId, err.code || 'unknown');
    return adminLoginRedirect(res, 'oauth');
  }
});

router.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({
    admin_id: Number(req.admin.admin_id),
    email: req.admin.email,
    display_name: req.admin.display_name || null,
  });
});

router.post('/api/admin/auth/logout', (req, res) => {
  if (req.session?.authType !== 'admin' || !Number.isSafeInteger(Number(req.session?.adminId))) {
    return res.status(401).json({ error: 'not authenticated', request_id: req.requestId });
  }
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'logout failed', request_id: req.requestId });
    res.clearCookie('connect.sid');
    return res.json({ ok: true });
  });
});

module.exports = router;
