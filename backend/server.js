const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// MySQL connection pool (reads config from docker-compose env vars)
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root123',
  database: process.env.DB_NAME || 'assignment_hub',
  waitForConnections: true,
  connectionLimit: 10,
});

// Health check — also verifies the DB connection is up
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'unavailable', message: err.message });
  }
});

// List all assignments joined with their course + detail info
app.get('/api/assignments', async (req, res) => {
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

// Current student — login is UI-only, so we treat the first student as the
// logged-in user (powers the dashboard greeting + sidebar profile).
app.get('/api/student', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.user_id,
             s.student_name,
             s.university_email,
             u.university_name
      FROM Student s
      LEFT JOIN University u ON s.university_id = u.university_id
      ORDER BY s.user_id
      LIMIT 1
    `);
    res.json(rows[0] || null);
  } catch (err) {
    res.status(503).json({ error: 'Database not ready', message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});
