const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');
const { OAuth2Client } = require('google-auth-library');
const { createRemoteJWKSet, jwtVerify } = require('jose');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Google OAuth config (from env / .env.local) ---
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const REDIRECT_URL = process.env.OAUTH_REDIRECT_URL || `${FRONTEND_URL}/api/auth/google/callback`;
const oauth2 = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn('[auth] GOOGLE_CLIENT_ID/SECRET not set — Google login will fail until .env.local is filled.');
}

// --- Microsoft OAuth config (from env / .env.local) ---
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

app.use(express.json());

// Session cookie (dev: in-memory store; resets when the server restarts).
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // dev over http
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

// MySQL connection pool (reads config from docker-compose env vars)
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root123',
  database: process.env.DB_NAME || 'assignment_hub',
  waitForConnections: true,
  connectionLimit: 10,
});

// Blocks a route unless there is a logged-in session.
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'not authenticated' });
  }
  next();
}

// Health check — also verifies the DB connection is up
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'unavailable', message: err.message });
  }
});

// --- Google OAuth (Authorization Code flow) ---

// Step 1: send the user to Google's consent screen.
app.get('/api/auth/google', (req, res) => {
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',      // ask for a refresh token (stored for future Classroom sync)
    prompt: 'consent',
    scope: ['openid', 'email', 'profile'],
  });
  res.redirect(url);
});

// Step 2: Google redirects back here with a code → exchange it, upsert the
// student + tokens, start a session, then bounce to the dashboard.
app.get('/api/auth/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) return res.redirect(`${FRONTEND_URL}/login?error=oauth`);

  try {
    const { tokens } = await oauth2.getToken(code);
    const ticket = await oauth2.verifyIdToken({ idToken: tokens.id_token, audience: CLIENT_ID });
    const payload = ticket.getPayload();
    const email = payload.email;
    const name = payload.name || email;

    // Match the university by the email domain (nullable if unknown).
    const domain = (email.split('@')[1] || '').toLowerCase();
    const [unis] = await pool.query(
      'SELECT university_id FROM University WHERE email_domain = ? LIMIT 1',
      [domain]
    );
    const universityId = unis.length ? unis[0].university_id : null;

    // Upsert the student keyed on the unique email; keep the old refresh
    // token if Google doesn't return a new one this time.
    const [existing] = await pool.query(
      'SELECT user_id, gg_refresh_token FROM Student WHERE university_email = ? LIMIT 1',
      [email]
    );

    let userId;
    if (existing.length) {
      userId = existing[0].user_id;
      const refresh = tokens.refresh_token || existing[0].gg_refresh_token || null;
      await pool.query(
        'UPDATE Student SET student_name = ?, gg_access_token = ?, gg_refresh_token = ? WHERE user_id = ?',
        [name, tokens.access_token || null, refresh, userId]
      );
    } else {
      const [ins] = await pool.query(
        `INSERT INTO Student (student_name, university_email, university_id, gg_access_token, gg_refresh_token)
         VALUES (?, ?, ?, ?, ?)`,
        [name, email, universityId, tokens.access_token || null, tokens.refresh_token || null]
      );
      userId = ins.insertId;
    }

    req.session.userId = userId;
    res.redirect(`${FRONTEND_URL}/home`);
  } catch (err) {
    console.error('[auth] callback error:', err.message);
    res.redirect(`${FRONTEND_URL}/login?error=oauth`);
  }
});

// --- Microsoft OAuth (Authorization Code flow) ---

// Step 1: send the user to Microsoft's consent screen.
app.get('/api/auth/microsoft', (req, res) => {
  const url = new URL(MS_AUTHORIZE_URL);
  url.searchParams.set('client_id', MS_CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', MS_REDIRECT_URL);
  url.searchParams.set('response_mode', 'query');
  // offline_access is what gets Microsoft to return a refresh_token (like Google's access_type: 'offline').
  url.searchParams.set('scope', 'openid email profile offline_access User.Read');
  res.redirect(url.toString());
});

// Step 2: Microsoft redirects back here with a code → exchange it, upsert the
// student + tokens, start a session, then bounce to the dashboard.
app.get('/api/auth/microsoft/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) return res.redirect(`${FRONTEND_URL}/login?error=oauth`);

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
    const name = payload.name || email;

    // Match the university by the email domain (nullable if unknown).
    const domain = (email.split('@')[1] || '').toLowerCase();
    const [unis] = await pool.query(
      'SELECT university_id FROM University WHERE email_domain = ? LIMIT 1',
      [domain]
    );
    const universityId = unis.length ? unis[0].university_id : null;

    // Upsert the student keyed on the unique email; keep the old refresh
    // token if Microsoft doesn't return a new one this time.
    const [existing] = await pool.query(
      'SELECT user_id, ms_refresh_token FROM Student WHERE university_email = ? LIMIT 1',
      [email]
    );

    let userId;
    if (existing.length) {
      userId = existing[0].user_id;
      const refresh = tokens.refresh_token || existing[0].ms_refresh_token || null;
      await pool.query(
        'UPDATE Student SET student_name = ?, ms_access_token = ?, ms_refresh_token = ? WHERE user_id = ?',
        [name, tokens.access_token || null, refresh, userId]
      );
    } else {
      const [ins] = await pool.query(
        `INSERT INTO Student (student_name, university_email, university_id, ms_access_token, ms_refresh_token)
         VALUES (?, ?, ?, ?, ?)`,
        [name, email, universityId, tokens.access_token || null, tokens.refresh_token || null]
      );
      userId = ins.insertId;
    }

    req.session.userId = userId;
    res.redirect(`${FRONTEND_URL}/home`);
  } catch (err) {
    console.error('[auth] microsoft callback error:', err.message);
    res.redirect(`${FRONTEND_URL}/login?error=oauth`);
  }
});

// The logged-in student (greeting + sidebar profile).
app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.user_id, s.student_name, s.university_email, u.university_name
       FROM Student s
       LEFT JOIN University u ON s.university_id = u.university_id
       WHERE s.user_id = ? LIMIT 1`,
      [req.session.userId]
    );
    if (!rows.length) return res.status(401).json({ error: 'not authenticated' });
    res.json(rows[0]);
  } catch (err) {
    res.status(503).json({ error: 'Database not ready', message: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// List all assignments joined with their course + detail info (login required).
app.get('/api/assignments', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.assignment_id,
             a.title,
             a.origin_link,
             c.course_name,
             c.platform_source,
             d.description,
             d.due_date,
             d.status,
             d.priority_score
      FROM Assignment a
      JOIN Course c            ON a.course_id = c.course_id
      LEFT JOIN Assignment_Detail d ON a.assignment_id = d.assignment_id
      ORDER BY d.due_date
    `);
    res.json(rows);
  } catch (err) {
    res.status(503).json({ error: 'Database not ready', message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});
