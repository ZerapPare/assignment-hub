const { OAuth2Client } = require('google-auth-library');
const { createRemoteJWKSet } = require('jose');

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URL = process.env.OAUTH_REDIRECT_URL || `${FRONTEND_URL}/api/auth/google/callback`;
const oauth2 = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
const ADMIN_GOOGLE_REDIRECT_URL = process.env.ADMIN_GOOGLE_REDIRECT_URL || `${FRONTEND_URL}/api/admin/auth/google/callback`;
const adminOauth2 = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, ADMIN_GOOGLE_REDIRECT_URL);

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn('[auth] GOOGLE_CLIENT_ID/SECRET not set — Google login will fail until .env.local is filled.');
}

const MS_CLIENT_ID = process.env.MS_CLIENT_ID;
const MS_CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
// 'organizations' = work/school (Azure AD) accounts only — matches this app's
// registration (not enabled for personal Microsoft/consumer accounts) and fits
// a university-login use case anyway.
const MS_TENANT = process.env.MS_TENANT_ID || 'organizations';
const MS_TENANT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MS_ADMIN_TENANT_IDS = [...new Set(
  String(process.env.MS_ADMIN_TENANT_IDS || (MS_TENANT_ID_PATTERN.test(MS_TENANT) ? MS_TENANT : ''))
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => MS_TENANT_ID_PATTERN.test(value))
)];
const MS_REDIRECT_URL = process.env.MS_OAUTH_REDIRECT_URL || `${FRONTEND_URL}/api/auth/microsoft/callback`;
const MS_ADMIN_REDIRECT_URL = process.env.MS_ADMIN_OAUTH_REDIRECT_URL || `${FRONTEND_URL}/api/admin/auth/microsoft/callback`;
const MS_AUTHORIZE_URL = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/authorize`;
const MS_TOKEN_URL = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`;
const msJwks = createRemoteJWKSet(
  new URL(`https://login.microsoftonline.com/${MS_TENANT}/discovery/v2.0/keys`)
);

if (!MS_CLIENT_ID || !MS_CLIENT_SECRET) {
  console.warn('[auth] MS_CLIENT_ID/SECRET not set — Microsoft login will fail until .env.local is filled.');
}

module.exports = {
  PORT,
  FRONTEND_URL,
  SESSION_SECRET,
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URL,
  oauth2,
  adminOauth2,
  ADMIN_GOOGLE_REDIRECT_URL,
  MS_CLIENT_ID,
  MS_CLIENT_SECRET,
  MS_TENANT,
  MS_ADMIN_TENANT_IDS,
  MS_REDIRECT_URL,
  MS_ADMIN_REDIRECT_URL,
  MS_AUTHORIZE_URL,
  MS_TOKEN_URL,
  msJwks,
};
