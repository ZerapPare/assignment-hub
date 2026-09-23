const pool = require('../db');
const { logError } = require('./errorLogger');
const { sendMail: mailerSendMail } = require('./mailer');
const { FRONTEND_URL } = require('../config');

const TICK_MS = 5 * 60 * 1000;

// How long a claim counts as in-flight, so a pass that dies before sending gets
// swept up later instead of losing the reminder.
const CLAIM_LEASE_MINUTES = 5;

// Retry delays in minutes (UC-8 7a.2), indexed by attempts already failed. An
// outage outlasting all three needs a person — that is what the banner is for.
const RETRY_MINUTES = [5, 30, 120];
const MAX_ATTEMPTS = RETRY_MINUTES.length + 1; // the first send, plus one per retry slot

// How far either side of today the daily repeat looks (FR-07.2). Without it,
// thirty unfinished tasks means thirty mails every morning — and a filter rule.
// Overdue work stays in range: it can usually still be handed in.
const DAILY_WINDOW_DAYS = 7;

// Finished, for FR-07.4. Keep in step with DONE in frontend/src/tasks.js.
const DONE_STATUSES = ['submitted', 'completed'];

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatThaiDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'ไม่ระบุกำหนดส่ง';
  return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())} น.`;
}

// 'YYYY-MM-DD HH:MM' wall-clock — short enough to keep trigger_type in VARCHAR(50).
function triggerStamp(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// The due date is in the key so moving a deadline re-arms the reminder.
function leadTriggerType(minutes, dueDate) {
  return `lead:${minutes}:${triggerStamp(dueDate)}`;
}

// Read from the key, not Notification_Lead_Time: the student may since have
// deselected the lead time this reminder was claimed for.
function leadMinutesFromTrigger(triggerType) {
  const match = /^lead:(\d+):/.exec(String(triggerType || ''));
  return match ? Number(match[1]) : null;
}

function minutesUntil(dueDate, now = new Date()) {
  return Math.round((new Date(dueDate).getTime() - now.getTime()) / 60000);
}

function dailyTriggerType(today) {
  return `daily:${today}`;
}

// Floors, because this is an arbitrary gap: "2 วัน" beats "3210 นาที".
function humanizeGap(minutes) {
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)} วัน`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)} ชั่วโมง`;
  return `${Math.max(minutes, 1)} นาที`;
}

function isOverdue(dueDate, now = new Date()) {
  return new Date(dueDate).getTime() < now.getTime();
}

// FR-07.6 — the subject alone carries task and due date, so it is actionable
// without opening the mail.
function buildSubject({ title, dueDate }) {
  return `[ใกล้ครบกำหนด] ${title} — ส่ง ${formatThaiDateTime(dueDate)}`;
}

// The daily repeat covers overdue work, and calling a passed deadline
// "coming up" is worse than silence.
function buildDailySubject({ title, dueDate }, now = new Date()) {
  const tag = isOverdue(dueDate, now) ? 'เลยกำหนดแล้ว' : 'งานค้าง';
  return `[${tag}] ${title} — ส่ง ${formatThaiDateTime(dueDate)}`;
}

// FR-07.3 again — the same three facts, framed as a standing reminder.
function buildDailyBody({ studentName, title, courseName, dueDate, assignmentId, originLink }, now = new Date()) {
  const minutes = Math.abs(minutesUntil(dueDate, now));
  const headline = isOverdue(dueDate, now)
    ? `งานนี้เลยกำหนดส่งมาแล้ว ${humanizeGap(minutes)} และยังไม่ถูกทำเครื่องหมายว่าเสร็จ`
    : `งานนี้ยังไม่เสร็จ เหลืออีก ${humanizeGap(minutes)} จะถึงกำหนดส่ง`;

  const lines = [
    `สวัสดี ${studentName || 'นักศึกษา'}`,
    '',
    headline,
    '',
    `งาน:       ${title}`,
    `วิชา:       ${courseName || 'ไม่ระบุวิชา'}`,
    `กำหนดส่ง:  ${formatThaiDateTime(dueDate)}`,
  ];
  if (originLink) lines.push('', `เปิดใน Google Classroom: ${originLink}`);
  lines.push(
    '',
    `ดูในระบบ: ${FRONTEND_URL}/assignments/${assignmentId}`,
    '',
    'ปิดการแจ้งเตือนซ้ำรายวันได้ที่หน้าตั้งค่า',
    '— Assignment Hub'
  );
  return lines.join('\n');
}

// FR-07.3 — task, course and due date must all be present.
//
// The countdown comes from the due date, not the lead time that triggered it: a
// retry two hours later would otherwise still say "1 day left", and the test
// mail has no lead time to echo.
function buildBody({ studentName, title, courseName, dueDate, assignmentId, originLink }, now = new Date()) {
  const lines = [
    `สวัสดี ${studentName || 'นักศึกษา'}`,
    '',
    `อีก ${humanizeGap(minutesUntil(dueDate, now))} จะถึงกำหนดส่งงานนี้`,
    '',
    `งาน:       ${title}`,
    `วิชา:       ${courseName || 'ไม่ระบุวิชา'}`,
    `กำหนดส่ง:  ${formatThaiDateTime(dueDate)}`,
  ];
  if (originLink) lines.push('', `เปิดใน Google Classroom: ${originLink}`);
  lines.push(
    '',
    `ดูในระบบ: ${FRONTEND_URL}/assignments/${assignmentId}`,
    '',
    'ปิดหรือปรับการแจ้งเตือนได้ที่หน้าตั้งค่า',
    '— Assignment Hub'
  );
  return lines.join('\n');
}

// Time conditions run in MySQL so there is one clock. due_date is wall-clock
// (utils/dueDate.js), so backend and db must share TZ — docker-compose.yml sets it.
const LEAD_REMINDER_SQL = `
  SELECT a.assignment_id, a.title, a.origin_link,
         c.course_name, d.due_date,
         s.email, s.full_name,
         lt.minutes
  FROM Notification_Setting ns
  JOIN User_Account s                 ON s.user_id = ns.user_id
  JOIN Notification_Lead_Time lt ON lt.user_id = ns.user_id
  JOIN Course c                  ON c.student_id = ns.user_id
  JOIN Assignment a              ON a.course_id = c.course_id
  JOIN Assignment_Detail d       ON d.assignment_id = a.assignment_id
  WHERE ns.enabled = TRUE
    AND s.account_status = 'active'
    AND d.due_date IS NOT NULL
    AND (d.status IS NULL OR d.status NOT IN (?, ?))
    AND NOW() >= DATE_SUB(d.due_date, INTERVAL lt.minutes MINUTE)
    AND NOW() <  d.due_date
  ORDER BY d.due_date
`;

// FR-07.2 — one mail per unfinished task after the chosen hour, deduplicated by
// the daily:<date> key. CURDATE() rides along so the key uses the database's
// clock: a pass crossing midnight must not straddle two dates.
const DAILY_REPEAT_SQL = `
  SELECT a.assignment_id, a.title, a.origin_link,
         c.course_name, d.due_date,
         s.email, s.full_name,
         DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today
  FROM Notification_Setting ns
  JOIN User_Account s           ON s.user_id = ns.user_id
  JOIN Course c            ON c.student_id = ns.user_id
  JOIN Assignment a        ON a.course_id = c.course_id
  JOIN Assignment_Detail d ON d.assignment_id = a.assignment_id
  WHERE ns.enabled = TRUE
    AND ns.daily_repeat = TRUE
    AND ns.daily_repeat_time IS NOT NULL
    AND CURTIME() >= ns.daily_repeat_time
    AND s.account_status = 'active'
    AND d.due_date IS NOT NULL
    AND (d.status IS NULL OR d.status NOT IN (?, ?))
    AND d.due_date BETWEEN DATE_SUB(NOW(), INTERVAL ? DAY) AND DATE_ADD(NOW(), INTERVAL ? DAY)
  ORDER BY d.due_date
`;

// The whole concurrency story: whoever inserts the row owns the send. A second
// pass or container gets affectedRows 0 and skips, so nothing is mailed twice.
const CLAIM_SQL = `
  INSERT IGNORE INTO Notification
    (assignment_id, trigger_type, is_sent, attempt_count, next_attempt_at)
  VALUES (?, ?, FALSE, 0, DATE_ADD(NOW(), INTERVAL ? MINUTE))
`;

const MARK_SENT_SQL = `
  UPDATE Notification
     SET sent_at = NOW(), is_sent = TRUE, next_attempt_at = NULL
   WHERE assignment_id = ? AND trigger_type = ?
`;

// Retries left. sent_at stays NULL, which keeps the row out of readFailures():
// the student sees nothing while the system is still trying (UC-8 7a.3).
const MARK_RETRY_SQL = `
  UPDATE Notification
     SET attempt_count = attempt_count + 1,
         next_attempt_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
   WHERE assignment_id = ? AND trigger_type = ?
`;

// Out of retries. sent_at set with is_sent false is what readFailures() counts,
// and what raises the banner in NotificationSettings.jsx.
const MARK_FAILED_SQL = `
  UPDATE Notification
     SET sent_at = NOW(), is_sent = FALSE,
         attempt_count = attempt_count + 1, next_attempt_at = NULL
   WHERE assignment_id = ? AND trigger_type = ?
`;

// Rows whose lease or retry delay expired. attempt_count 0 is included: that is
// a claim whose pass died before sending, and it deserves the same second chance.
const RETRY_SWEEP_SQL = `
  SELECT n.trigger_type, n.attempt_count,
         a.assignment_id, a.title, a.origin_link,
         c.course_name, d.due_date,
         s.email, s.full_name
  FROM Notification n
  JOIN Assignment_Detail d      ON d.assignment_id = n.assignment_id
  JOIN Assignment a             ON a.assignment_id = d.assignment_id
  JOIN Course c                 ON c.course_id = a.course_id
  JOIN User_Account s                ON s.user_id = c.student_id
  JOIN Notification_Setting ns  ON ns.user_id = s.user_id
  WHERE n.is_sent = FALSE
    AND n.sent_at IS NULL
    AND n.attempt_count < ?
    AND n.next_attempt_at IS NOT NULL
    AND n.next_attempt_at <= NOW()
    AND ns.enabled = TRUE
    AND s.account_status = 'active'
    AND (d.status IS NULL OR d.status NOT IN (?, ?))
  ORDER BY n.next_attempt_at
`;

// UC-8 5a.2 — a task finished before its reminder went out should not send one.
// Only unsent rows are dropped; history of what was already mailed stays.
const CANCEL_COMPLETED_SQL = `
  DELETE n FROM Notification n
  JOIN Assignment_Detail d ON n.assignment_id = d.assignment_id
  WHERE n.sent_at IS NULL AND d.status IN (?, ?)
`;

async function defaultLogFailure(err, context) {
  await logError(err, null, {
    source: 'notifications',
    level: 'warn',
    statusCode: 502,
    metadata: context,
  });
}

// The trigger key decides which mail this is, so a retry rebuilds the right one
// without having to remember which pass first claimed it.
function buildMessage(row, triggerType) {
  const common = {
    studentName: row.full_name,
    title: row.title,
    courseName: row.course_name,
    dueDate: row.due_date,
    assignmentId: row.assignment_id,
    originLink: row.origin_link,
  };

  // No lead time in the key means this is a daily repeat.
  if (leadMinutesFromTrigger(triggerType) === null) {
    return {
      subject: buildDailySubject({ title: row.title, dueDate: row.due_date }),
      text: buildDailyBody(common),
    };
  }
  return {
    subject: buildSubject({ title: row.title, dueDate: row.due_date }),
    text: buildBody(common),
  };
}

// Sends one reminder and records the outcome. Shared by the first attempt and
// every retry so the two cannot drift. `attemptsSoFar` picks the retry delay.
async function deliver({ db, sendMail, logFailure, row, triggerType, attemptsSoFar }) {
  try {
    const { subject, text } = buildMessage(row, triggerType);
    await sendMail({ to: row.email, subject, text });
    await db.query(MARK_SENT_SQL, [row.assignment_id, triggerType]);
    return 'sent';
  } catch (err) {
    // address must not stop the pass.
    const delayMinutes = RETRY_MINUTES[attemptsSoFar];
    const outcome = delayMinutes === undefined ? 'failed' : 'retrying';

    if (outcome === 'retrying') {
      await db.query(MARK_RETRY_SQL, [delayMinutes, row.assignment_id, triggerType]);
    } else {
      await db.query(MARK_FAILED_SQL, [row.assignment_id, triggerType]);
    }

    await logFailure(err, {
      assignment_id: row.assignment_id,
      trigger_type: triggerType,
      attempt: attemptsSoFar + 1,
      outcome,
    });
    return outcome;
  }
}

// db, sendMail and logFailure are all injected so the pass can be tested
// without a database or an SMTP account.
async function runNotificationPass({
  db = pool,
  sendMail = mailerSendMail,
  logFailure = defaultLogFailure,
} = {}) {
  const [cancelled] = await db.query(CANCEL_COMPLETED_SQL, DONE_STATUSES);

  const tally = { sent: 0, failed: 0, retrying: 0, skipped: 0 };
  const count = (outcome) => { tally[outcome] += 1; };

  // Retries first: already-claimed work the system promised to finish.
  const [retries] = await db.query(RETRY_SWEEP_SQL, [MAX_ATTEMPTS, ...DONE_STATUSES]);
  for (const row of retries) {
    count(await deliver({
      db,
      sendMail,
      logFailure,
      row,
      triggerType: row.trigger_type,
      leadMinutes: leadMinutesFromTrigger(row.trigger_type),
      attemptsSoFar: row.attempt_count,
    }));
  }

  // Claim, then send. Shared by both kinds of fresh candidate.
  const claimAndSend = async (row, triggerType) => {
    const [claim] = await db.query(CLAIM_SQL, [row.assignment_id, triggerType, CLAIM_LEASE_MINUTES]);

    // Already claimed or already sent — someone else owns this reminder.
    if (!claim.affectedRows) {
      count('skipped');
      return;
    }
    count(await deliver({ db, sendMail, logFailure, row, triggerType, attemptsSoFar: 0 }));
  };

  const [rows] = await db.query(LEAD_REMINDER_SQL, DONE_STATUSES);
  for (const row of rows) {
    await claimAndSend(row, leadTriggerType(row.minutes, row.due_date));
  }

  const [daily] = await db.query(DAILY_REPEAT_SQL, [
    ...DONE_STATUSES,
    DAILY_WINDOW_DAYS,
    DAILY_WINDOW_DAYS,
  ]);
  for (const row of daily) {
    await claimAndSend(row, dailyTriggerType(row.today));
  }

  return {
    cancelled: cancelled?.affectedRows ?? 0,
    candidates: rows.length,
    dailyCandidates: daily.length,
    retried: retries.length,
    ...tally,
  };
}

let tickTimer = null;

async function tick() {
  try {
    const result = await runNotificationPass();
    if (result.sent || result.failed || result.retrying) {
      console.log(
        `[notifications] sent ${result.sent}, retrying ${result.retrying}, failed ${result.failed}`
      );
    }
  } catch (err) {
    // Like the metrics flush: log and keep the interval running. Never reject.
    console.error('[notifications] pass failed:', err.code || 'unknown');
  }
}

function startNotificationSender() {
  if (tickTimer) return;
  tickTimer = setInterval(() => { void tick(); }, TICK_MS);
  tickTimer.unref();
}

module.exports = {
  startNotificationSender,
  runNotificationPass,
  buildSubject,
  buildBody,
  buildDailySubject,
  buildDailyBody,
  buildMessage,
  formatThaiDateTime,
  humanizeGap,
  minutesUntil,
  leadTriggerType,
  dailyTriggerType,
  leadMinutesFromTrigger,
  DONE_STATUSES,
  RETRY_MINUTES,
  MAX_ATTEMPTS,
  DAILY_WINDOW_DAYS,
};
