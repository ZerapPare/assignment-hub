const { OAuth2Client } = require('google-auth-library');
const { createRemoteJWKSet } = require('jose');

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URL = process.env.OAUTH_REDIRECT_URL || `${FRONTEND_URL}/api/auth/google/callback`;
const oauth2 = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn('[auth] GOOGLE_CLIENT_ID/SECRET not set — Google login will fail until .env.local is filled.');
}

const MS_CLIENT_ID = process.env.MS_CLIENT_ID;
const MS_CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
// 'organizations' = work/school (Azure AD) accounts only — matches this app's
// registration (not enabled for personal Microsoft/consumer accounts) and fits
// a university-login use case anyway.
const MS_TENANT = process.env.MS_TENANT_ID || 'organizations';
const MS_REDIRECT_URL = process.env.MS_OAUTH_REDIRECT_URL || `${FRONTEND_URL}/api/auth/microsoft/callback`;
const MS_AUTHORIZE_URL = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/authorize`;
const MS_TOKEN_URL = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`;
const msJwks = createRemoteJWKSet(
  new URL(`https://login.microsoftonline.com/${MS_TENANT}/discovery/v2.0/keys`)
);

if (!MS_CLIENT_ID || !MS_CLIENT_SECRET) {
  console.warn('[auth] MS_CLIENT_ID/SECRET not set — Microsoft login will fail until .env.local is filled.');
}

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
// Port 465 is implicit TLS; 587 and everything else upgrade with STARTTLS.
// SMTP_SECURE=1 forces it on for a provider that wants implicit TLS elsewhere.
const SMTP_SECURE = process.env.SMTP_SECURE === '1' || SMTP_PORT === 465;
const MAIL_FROM = process.env.MAIL_FROM || 'Assignment Hub <no-reply@assignment-hub.local>';

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.warn('[mailer] SMTP_HOST/USER/PASS not set — reminder emails will be logged instead of sent.');
}

module.exports = {
  PORT,
  FRONTEND_URL,
  SESSION_SECRET,
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URL,
  oauth2,
  MS_CLIENT_ID,
  MS_CLIENT_SECRET,
  MS_TENANT,
  MS_REDIRECT_URL,
  MS_AUTHORIZE_URL,
  MS_TOKEN_URL,
  msJwks,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_SECURE,
  MAIL_FROM,
};
