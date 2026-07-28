const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');
const { OAuth2Client } = require('google-auth-library');
const { google } = require('googleapis');
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
    scope: [
      'openid', 'email', 'profile',
      'https://www.googleapis.com/auth/classroom.courses.readonly',
      'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
      'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
    ],
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

// --- Google Classroom sync ---

// Classroom's dueDate/dueTime are split objects like {year,month,day} and
// {hours,minutes} — combine into a MySQL DATETIME string (defaults to
// 23:59 if Classroom didn't set a specific time).
function toMysqlDateTime(dueDate, dueTime) {
  if (!dueDate) return null;
  const { year, month, day } = dueDate;
  const hours = dueTime?.hours ?? 23;
  const minutes = dueTime?.minutes ?? 59;
  const pad = (n) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(minutes)}:00`;
}

// Fetch a course's coursework newest-due-date-first, and stop paging the
// moment we pass the cutoff. Classroom's list API has no server-side date
// filter, but it does support ordering — so instead of fetching everything
// and filtering after the fact, we stop calling the API entirely once
// results are older than the cutoff. That's what actually cuts sync time,
// since each item also costs a follow-up submission-status API call.
// Coursework with no due date at all is always kept (there's no date to
// judge it by), and non-PUBLISHED items are dropped here too.
async function listCourseWorkSince(classroom, courseId, cutoffDate) {
  const results = [];
  let pageToken;
  do {
    const { data } = await classroom.courses.courseWork.list({
      courseId,
      orderBy: 'dueDate desc',
      pageSize: 50,
      pageToken,
    });
    const items = data.courseWork || [];

    for (const work of items) {
      if (work.state !== 'PUBLISHED') continue;
      if (cutoffDate && work.dueDate) {
        const due = new Date(work.dueDate.year, work.dueDate.month - 1, work.dueDate.day);
        if (due < cutoffDate) return results; // everything after this is even older — stop paging
      }
      results.push(work);
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return results;
}

// Pull the logged-in student's Classroom courses + coursework and upsert
// them into Course / Assignment / Assignment_Detail, keyed on Classroom's
// own ids (external_course_id / external_assignment_id) so re-syncing
// doesn't create duplicates.
app.post('/api/classroom/sync', requireAuth, async (req, res) => {
  try {
    // Optional: only bring in assignments due on/after this date. Skips old
    // finished semesters instead of importing everything, and (via
    // listCourseWorkSince) cuts the Classroom API calls short too.
    const cutoffDate = req.body?.cutoffDate ? new Date(req.body.cutoffDate) : null;

    const [rows] = await pool.query(
      'SELECT gg_refresh_token FROM Student WHERE user_id = ? LIMIT 1',
      [req.session.userId]
    );
    const refreshToken = rows[0]?.gg_refresh_token;
    if (!refreshToken) {
      return res.status(400).json({
        error: 'No Google Classroom access — log out and log back in with Google to grant it.',
      });
    }

    const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET);
    client.setCredentials({ refresh_token: refreshToken });
    const classroom = google.classroom({ version: 'v1', auth: client });

    // Remove previously-synced Classroom assignments that now fall before
    // the cutoff (e.g. you moved the cutoff forward, or old semesters were
    // synced before this feature existed). Scoped to this student's own
    // Google Classroom courses only — manual entries and Microsoft Teams
    // assignments are never touched here.
    let deletedCount = 0;
    if (cutoffDate) {
      const [toDelete] = await pool.query(
        `SELECT a.assignment_id
         FROM Assignment a
         JOIN Course c            ON a.course_id = c.course_id
         JOIN Assignment_Detail d ON a.assignment_id = d.assignment_id
         WHERE c.student_id = ? AND c.platform_source = 'Google Classroom' AND d.due_date < ?`,
        [req.session.userId, cutoffDate]
      );
      const ids = toDelete.map((r) => r.assignment_id);
      if (ids.length) {
        // Child tables first to satisfy the foreign key constraints.
        await pool.query('DELETE FROM Notification WHERE assignment_id IN (?)', [ids]);
        await pool.query('DELETE FROM Schedule WHERE assignment_id IN (?)', [ids]);
        await pool.query('DELETE FROM Assignment_Detail WHERE assignment_id IN (?)', [ids]);
        await pool.query('DELETE FROM Assignment WHERE assignment_id IN (?)', [ids]);
        deletedCount = ids.length;
      }
    }

    const { data: { courses = [] } } = await classroom.courses.list({ courseStates: ['ACTIVE'] });

    let coursesSynced = 0;
    let assignmentsSynced = 0;

    for (const course of courses) {
      // Course rows in this schema belong to one student, so match on
      // (external_course_id, student_id) rather than external id alone.
      const [existingCourse] = await pool.query(
        'SELECT course_id FROM Course WHERE external_course_id = ? AND student_id = ? LIMIT 1',
        [course.id, req.session.userId]
      );

      let courseId;
      if (existingCourse.length) {
        courseId = existingCourse[0].course_id;
        await pool.query('UPDATE Course SET course_name = ? WHERE course_id = ?', [course.name, courseId]);
      } else {
        const [ins] = await pool.query(
          `INSERT INTO Course (course_name, external_course_id, platform_source, student_id)
           VALUES (?, ?, 'Google Classroom', ?)`,
          [course.name, course.id, req.session.userId]
        );
        courseId = ins.insertId;
      }
      coursesSynced++;

      const courseWork = await listCourseWorkSince(classroom, course.id, cutoffDate);

      for (const work of courseWork) {
        // Look up whether *this student* has already turned this in.
        // 'me' works because the request is authenticated as the student.
        let submissionState = null;
        try {
          const { data: { studentSubmissions = [] } } = await classroom.courses.courseWork.studentSubmissions.list({
            courseId: course.id,
            courseWorkId: work.id,
            userId: 'me',
          });
          submissionState = studentSubmissions[0]?.state || null;
        } catch (subErr) {
          console.warn('[classroom] could not read submission state for', work.id, subErr.message);
        }
        const isFinished = submissionState === 'TURNED_IN' || submissionState === 'RETURNED';

        const dueDateTime = toMysqlDateTime(work.dueDate, work.dueTime);

        const [existingAssignment] = await pool.query(
          'SELECT assignment_id FROM Assignment WHERE external_assignment_id = ? LIMIT 1',
          [work.id]
        );

        if (existingAssignment.length) {
          const assignmentId = existingAssignment[0].assignment_id;
          await pool.query(
            'UPDATE Assignment SET title = ?, origin_link = ? WHERE assignment_id = ?',
            [work.title, work.alternateLink || null, assignmentId]
          );
          if (isFinished) {
            // Now turned in/returned — mark it done, overriding any manual status.
            await pool.query(
              'UPDATE Assignment_Detail SET description = ?, due_date = ?, status = ? WHERE assignment_id = ?',
              [work.description || null, dueDateTime, 'completed', assignmentId]
            );
          } else {
            // Still unfinished — refresh details but leave the student's own
            // status/priority (not_started / in_progress) alone.
            await pool.query(
              'UPDATE Assignment_Detail SET description = ?, due_date = ? WHERE assignment_id = ?',
              [work.description || null, dueDateTime, assignmentId]
            );
          }
        } else {
          // Brand new coursework: bring it in either way, just start it at
          // the right status so already-turned-in work shows as ส่งแล้ว
          // instead of never appearing at all.
          const initialStatus = isFinished ? 'completed' : 'not_started';

          const [ins] = await pool.query(
            `INSERT INTO Assignment (external_assignment_id, title, origin_link, course_id)
             VALUES (?, ?, ?, ?)`,
            [work.id, work.title, work.alternateLink || null, courseId]
          );
          await pool.query(
            `INSERT INTO Assignment_Detail (assignment_id, description, due_date, status, priority_score)
             VALUES (?, ?, ?, ?, 0)`,
            [ins.insertId, work.description || null, dueDateTime, initialStatus]
          );
        }
        assignmentsSynced++;
      }
    }

    res.json({ ok: true, coursesSynced, assignmentsSynced, deletedCount });
  } catch (err) {
    // Google API errors carry the real reason in err.response.data — log
    // and surface that instead of just err.message, which is often just "Bad Request".
    const googleDetail = err.response?.data?.error || err.errors || null;
    console.error('[classroom] sync error:', err.message, googleDetail ? JSON.stringify(googleDetail) : '');
    res.status(500).json({
      error: 'Classroom sync failed',
      message: err.message,
      detail: googleDetail,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});