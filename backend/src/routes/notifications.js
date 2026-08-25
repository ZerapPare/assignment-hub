const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { logError } = require('../services/errorLogger');

const router = express.Router();

// 28 days. Anything longer is almost certainly a typo (a student entering
// "10000" meaning minutes when they meant hours), and the sender would have to
// look that far back on every pass.
const MAX_LEAD_MINUTES = 40320;
const MAX_LEAD_TIMES = 10;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// What a student who has never opened this panel gets. Deliberately returned
// rather than inserted: an empty Notification_Setting table means "nobody has
// saved settings", which is worth being able to tell.
const DEFAULTS = {
  enabled: true,
  lead_times: [1440],
  daily_repeat: false,
  daily_repeat_time: '08:00',
  last_custom_minutes: null,
};

// MySQL hands back TIME as 'HH:MM:SS'; the <input type="time"> wants 'HH:MM'.
function toHhMm(value) {
  if (!value) return DEFAULTS.daily_repeat_time;
  return String(value).slice(0, 5);
}

// Notification rows hang off Assignment_Detail, so reaching the owning student
// means walking up to Course — the same join the assignments list uses to scope
// itself. A send that was attempted and failed is one with a sent_at stamp but
// is_sent still false.
//
// Nothing writes Notification yet, so this is 0 for everyone; it is here so the
// banner has a real source the moment the sender lands.
async function readFailures(userId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS failed_count, MAX(n.sent_at) AS last_failed_at
     FROM Notification n
     JOIN Assignment_Detail d ON n.assignment_id = d.assignment_id
     JOIN Assignment a        ON d.assignment_id = a.assignment_id
     JOIN Course c            ON a.course_id = c.course_id
     WHERE c.student_id = ? AND n.is_sent = FALSE AND n.sent_at IS NOT NULL`,
    [userId]
  );
  return {
    failed_count: rows[0]?.failed_count ?? 0,
    last_failed_at: rows[0]?.last_failed_at ?? null,
  };
}

async function readSettings(userId) {
  const [settings] = await pool.query(
    `SELECT enabled, daily_repeat, daily_repeat_time, last_custom_minutes
     FROM Notification_Setting WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  const failures = await readFailures(userId);

  if (!settings.length) return { ...DEFAULTS, ...failures };

  const [leadTimes] = await pool.query(
    'SELECT minutes FROM Notification_Lead_Time WHERE user_id = ? ORDER BY minutes',
    [userId]
  );

  const row = settings[0];
  return {
    enabled: Boolean(row.enabled),
    // A saved row with no lead times is a real state (the student cleared them
    // all), so this stays empty instead of falling back to DEFAULTS.
    lead_times: leadTimes.map((r) => r.minutes),
    daily_repeat: Boolean(row.daily_repeat),
    daily_repeat_time: toHhMm(row.daily_repeat_time),
    last_custom_minutes: row.last_custom_minutes,
    ...failures,
  };
}

router.get('/api/notification-settings', requireAuth, async (req, res) => {
  try {
    res.json(await readSettings(req.session.userId));
  } catch (err) {
    void logError(err, req, { source: 'notifications', statusCode: 503 });
    res.status(503).json({ error: 'Database not ready', request_id: req.requestId });
  }
});

// Numbers only — Number(true) is 1, which would otherwise sneak a boolean
// through as a one-minute lead time.
function parseLeadMinutes(value) {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < 1 || value > MAX_LEAD_MINUTES) return null;
  return value;
}

// The panel always sends its whole state, so this replaces rather than merges.
router.put('/api/notification-settings', requireAuth, async (req, res) => {
  const { enabled, daily_repeat: dailyRepeat, daily_repeat_time: dailyRepeatTime } = req.body ?? {};

  if (typeof enabled !== 'boolean' || typeof dailyRepeat !== 'boolean') {
    return res.status(400).json({ error: 'ค่าเปิด/ปิดการแจ้งเตือนไม่ถูกต้อง' });
  }
  if (typeof dailyRepeatTime !== 'string' || !TIME_RE.test(dailyRepeatTime)) {
    return res.status(400).json({ error: 'รูปแบบเวลาแจ้งเตือนซ้ำรายวันไม่ถูกต้อง' });
  }
  if (!Array.isArray(req.body?.lead_times)) {
    return res.status(400).json({ error: 'ช่วงเวลาแจ้งเตือนล่วงหน้าไม่ถูกต้อง' });
  }

  const leadTimes = [];
  for (const raw of req.body.lead_times) {
    const minutes = parseLeadMinutes(raw);
    if (minutes === null) {
      return res.status(400).json({ error: 'ช่วงเวลาแจ้งเตือนล่วงหน้าไม่ถูกต้อง' });
    }
    if (!leadTimes.includes(minutes)) leadTimes.push(minutes);
  }
  if (leadTimes.length > MAX_LEAD_TIMES) {
    return res.status(400).json({ error: `เลือกช่วงเวลาได้ไม่เกิน ${MAX_LEAD_TIMES} ค่า` });
  }

  let lastCustom = null;
  if (req.body?.last_custom_minutes !== undefined && req.body.last_custom_minutes !== null) {
    lastCustom = parseLeadMinutes(req.body.last_custom_minutes);
    if (lastCustom === null) {
      return res.status(400).json({ error: 'ค่าที่กำหนดเองไม่ถูกต้อง' });
    }
  }

  // Both tables move together: a settings row whose lead times half-applied
  // would silently change when the student gets reminded.
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO Notification_Setting
         (user_id, enabled, daily_repeat, daily_repeat_time, last_custom_minutes)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         enabled = VALUES(enabled),
         daily_repeat = VALUES(daily_repeat),
         daily_repeat_time = VALUES(daily_repeat_time),
         last_custom_minutes = VALUES(last_custom_minutes)`,
      [req.session.userId, enabled, dailyRepeat, `${dailyRepeatTime}:00`, lastCustom]
    );

    await conn.query('DELETE FROM Notification_Lead_Time WHERE user_id = ?', [req.session.userId]);
    if (leadTimes.length) {
      await conn.query('INSERT INTO Notification_Lead_Time (user_id, minutes) VALUES ?', [
        leadTimes.map((minutes) => [req.session.userId, minutes]),
      ]);
    }

    await conn.commit();
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (_) { /* connection may not have started a transaction */ }
    }
    void logError(err, req, { source: 'notifications', statusCode: 503 });
    console.error('[notifications] save failed:', req.requestId, err.code || 'unknown');
    return res.status(503).json({ error: 'บันทึกการตั้งค่าไม่สำเร็จ', request_id: req.requestId });
  } finally {
    if (conn) conn.release();
  }

  // Same shape as GET, so the panel can drop the response straight into state.
  try {
    res.json(await readSettings(req.session.userId));
  } catch (err) {
    void logError(err, req, { source: 'notifications', statusCode: 503 });
    res.status(503).json({ error: 'Database not ready', request_id: req.requestId });
  }
});

module.exports = router;
