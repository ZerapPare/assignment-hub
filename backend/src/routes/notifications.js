const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { logError } = require('../services/errorLogger');
const { safeTrackEvent } = require('../services/analytics');
const { sendMail } = require('../services/mailer');
const { buildSubject, buildBody } = require('../services/notificationSender');

const router = express.Router();

// 28 days. Anything longer is almost certainly a typo, and the sender would
// have to look that far back on every pass.
const MAX_LEAD_MINUTES = 40320;
const MAX_LEAD_TIMES = 10;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// What a student who has never opened this panel gets. Returned rather than
// inserted, so "no row" still means "never saved settings".
const DEFAULTS = {
  enabled: true,
  lead_times: [1440],
  daily_repeat: false,
  daily_repeat_time: '08:00',
  announcement_notify: true,
  last_custom_minutes: null,
};

// MySQL hands back TIME as 'HH:MM:SS'; the <input type="time"> wants 'HH:MM'.
function toHhMm(value) {
  if (!value) return DEFAULTS.daily_repeat_time;
  return String(value).slice(0, 5);
}

// A notification hangs off either an assignment or an announcement, so the
// owning student is reached through whichever one is set — both routes end at
// Course. A failed send is one with sent_at stamped but is_sent still false;
// see MARK_FAILED_SQL in services/notificationSender.js.
async function readFailures(userId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS failed_count, MAX(n.sent_at) AS last_failed_at
     FROM Notification n
     LEFT JOIN Assignment a    ON a.assignment_id = n.assignment_id
     LEFT JOIN Announcement an ON an.announcement_id = n.announcement_id
     JOIN Course c             ON c.course_id = COALESCE(a.course_id, an.course_id)
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
    `SELECT enabled, daily_repeat, daily_repeat_time, announcement_notify, last_custom_minutes
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
    // A saved row with no lead times is a real state — the student cleared them
    // all — so this stays empty instead of falling back to DEFAULTS.
    lead_times: leadTimes.map((r) => r.minutes),
    daily_repeat: Boolean(row.daily_repeat),
    daily_repeat_time: toHhMm(row.daily_repeat_time),
    announcement_notify: Boolean(row.announcement_notify),
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

// Numbers only: Number(true) is 1, which would sneak a boolean through as a
// one-minute lead time.
function parseLeadMinutes(value) {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < 1 || value > MAX_LEAD_MINUTES) return null;
  return value;
}

// The panel always sends its whole state, so this replaces rather than merges.
router.put('/api/notification-settings', requireAuth, async (req, res) => {
  const {
    enabled,
    daily_repeat: dailyRepeat,
    daily_repeat_time: dailyRepeatTime,
    announcement_notify: announcementNotify,
  } = req.body ?? {};

  if (
    typeof enabled !== 'boolean'
    || typeof dailyRepeat !== 'boolean'
    || typeof announcementNotify !== 'boolean'
  ) {
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

  // Both tables move together: half-applied lead times would silently change
  // when the student gets reminded.
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO Notification_Setting
         (user_id, enabled, daily_repeat, daily_repeat_time, announcement_notify, last_custom_minutes)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         enabled = VALUES(enabled),
         daily_repeat = VALUES(daily_repeat),
         daily_repeat_time = VALUES(daily_repeat_time),
         announcement_notify = VALUES(announcement_notify),
         last_custom_minutes = VALUES(last_custom_minutes)`,
      [req.session.userId, enabled, dailyRepeat, `${dailyRepeatTime}:00`, announcementNotify, lastCustom]
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

  void safeTrackEvent({
    userId: req.session.userId,
    eventName: 'notification.settings_updated',
    result: 'success',
    metadata: {
      enabled,
      daily_repeat: dailyRepeat,
      lead_time_count: leadTimes.length,
    },
  });

  // Same shape as GET, so the panel can drop the response straight into state.
  try {
    res.json(await readSettings(req.session.userId));
  } catch (err) {
    void logError(err, req, { source: 'notifications', statusCode: 503 });
    res.status(503).json({ error: 'Database not ready', request_id: req.requestId });
  }
});

// Built by the same two functions the scheduler uses, so a test that arrives
// proves the real thing will. Writes no Notification row: this is not a
// reminder for any task, and assignment_id is NOT NULL.
router.post('/api/notification-settings/test', requireAuth, async (req, res) => {
  let student;
  let sample;
  try {
    const [students] = await pool.query(
      'SELECT full_name, email FROM User_Account WHERE user_id = ? LIMIT 1',
      [req.session.userId]
    );
    student = students[0];
    if (!student) return res.status(404).json({ error: 'ไม่พบบัญชีผู้ใช้' });

    // The nearest real deadline makes the test mail look like the real one.
    const [samples] = await pool.query(
      `SELECT a.assignment_id, a.title, a.origin_link, c.course_name, d.due_date
       FROM Course c
       JOIN Assignment a        ON a.course_id = c.course_id
       JOIN Assignment_Detail d ON d.assignment_id = a.assignment_id
       WHERE c.student_id = ? AND d.due_date IS NOT NULL AND d.due_date > NOW()
       ORDER BY d.due_date
       LIMIT 1`,
      [req.session.userId]
    );
    sample = samples[0];
  } catch (err) {
    void logError(err, req, { source: 'notifications', statusCode: 503 });
    return res.status(503).json({ error: 'Database not ready', request_id: req.requestId });
  }

  // An account that has synced nothing yet still gets a realistic-looking mail.
  const task = sample || {
    assignment_id: 0,
    title: 'ตัวอย่างงาน — ทดสอบการแจ้งเตือน',
    course_name: 'วิชาตัวอย่าง',
    due_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
    origin_link: null,
  };

  let delivery;
  try {
    delivery = await sendMail({
      to: student.email,
      subject: buildSubject({ title: task.title, dueDate: task.due_date }),
      text: buildBody({
        studentName: student.full_name,
        title: task.title,
        courseName: task.course_name,
        dueDate: task.due_date,
        assignmentId: task.assignment_id,
        originLink: task.origin_link,
      }),
    });
  } catch (err) {
    void logError(err, req, { source: 'notifications', statusCode: 502, level: 'warn' });
    console.error('[notifications] test email failed:', req.requestId, err.code || 'unknown');
    return res.status(502).json({ error: 'ส่งอีเมลทดสอบไม่สำเร็จ', request_id: req.requestId });
  }

  // delivered:false means no SMTP account is configured and the mail only went
  // to the log. Saying "sent" instead would send people hunting an empty inbox.
  res.json({ ok: true, to: student.email, delivered: delivery.delivered !== false });
});

// DEFAULTS rides along so a test can hold it against the sender's own idea of
// the same defaults — the panel promising a reminder nobody sends is exactly
// the bug that made the sender start from User_Account instead of this table.
module.exports = router;
module.exports.DEFAULTS = DEFAULTS;
