const pool = require('../db');
const { logError } = require('./errorLogger');
const { sendMail: mailerSendMail } = require('./mailer');
const { FRONTEND_URL } = require('../config');

const TICK_MS = 5 * 60 * 1000;

// How long a claim counts as in-flight, so a dead pass gets swept up later.
const CLAIM_LEASE_MINUTES = 5;

// Retry delays in minutes (UC-8 7a.2), indexed by attempts already failed.
const RETRY_MINUTES = [5, 30, 120];
const MAX_ATTEMPTS = RETRY_MINUTES.length + 1; // the first send, plus one per retry slot

// How far either side of today the daily repeat looks (FR-07.2), so thirty
// unfinished tasks are not thirty mails. Overdue work stays in range.
const DAILY_WINDOW_DAYS = 7;

// Finished, for FR-07.4. Keep in step with DONE in frontend/src/tasks.js.
const DONE_STATUSES = ['submitted', 'completed'];

// For a student who never saved settings. Must match DEFAULTS.lead_times in
// routes/notifications.js, or the panel promises a reminder nobody sends.
const DEFAULT_LEAD_MINUTES = 1440;

// How fresh an announcement must be to count as news. See ANNOUNCEMENT_SQL.
const ANNOUNCEMENT_SEEN_HOURS = 24;
const ANNOUNCEMENT_FRESH_DAYS = 2;

// Announcement bodies are unbounded, so the mail carries an excerpt and a link.
const ANNOUNCEMENT_EXCERPT_CHARS = 400;

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

// From the key, not the table: the lead time may since have been deselected.
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

// Constant: which announcement it is already lives in announcement_id.
function announcementTriggerType() {
  return 'ann:new';
}

function isAnnouncementTrigger(triggerType) {
  return String(triggerType || '').startsWith('ann:');
}

// Classroom bodies arrive with arbitrary blank lines and no length limit.
function excerpt(text) {
  const clean = String(text || '').replace(/\n{3,}/g, '\n\n').trim();
  if (clean.length <= ANNOUNCEMENT_EXCERPT_CHARS) return clean;
  return `${clean.slice(0, ANNOUNCEMENT_EXCERPT_CHARS).trimEnd()}…`;
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

// FR-07.6 — actionable from the subject alone, without opening the mail.
function buildSubject({ title, dueDate }) {
  return `[ใกล้ครบกำหนด] ${title} — ส่ง ${formatThaiDateTime(dueDate)}`;
}

// The daily repeat covers overdue work; "coming up" would be a lie.
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

// FR-07.3 — task, course and due date must all be present. The countdown comes
// from the due date, not the lead time, so a late retry does not still say "1 day".
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

// No due date and no title (the sync never writes one), so the subject is the
// course name plus the opening words.
function buildAnnouncementSubject({ courseName, textContent }) {
  const opening = excerpt(textContent).split('\n')[0].slice(0, 80).trim();
  const head = `[ประกาศใหม่] ${courseName || 'ไม่ระบุวิชา'}`;
  return opening ? `${head} — ${opening}` : head;
}

function buildAnnouncementBody({
  studentName, courseName, creatorName, textContent, postedAt, originLink,
}) {
  const lines = [
    `สวัสดี ${studentName || 'นักศึกษา'}`,
    '',
    `มีประกาศใหม่ในวิชา ${courseName || 'ไม่ระบุวิชา'}`,
    '',
    `ผู้ประกาศ:  ${creatorName || 'ไม่ระบุ'}`,
    `เวลา:       ${formatThaiDateTime(postedAt)}`,
    '',
    excerpt(textContent) || '(ไม่มีข้อความ)',
  ];
  if (originLink) lines.push('', `เปิดใน Google Classroom: ${originLink}`);
  lines.push(
    '',
    // Announcements live on /stream, not on an assignment page.
    `ดูในระบบ: ${FRONTEND_URL}/stream`,
    '',
    'ปิดการแจ้งเตือนประกาศใหม่ได้ที่หน้าตั้งค่า',
    '— Assignment Hub'
  );
  return lines.join('\n');
}

// Time conditions run in MySQL so there is one clock. due_date is wall-clock
// (utils/dueDate.js), so backend and db must share TZ — docker-compose.yml sets it.
//
// From User_Account, not Notification_Setting: GET never inserts a row, so an
// inner join made the panel promise reminders the sender could not see.
const LEAD_REMINDER_SQL = `
  SELECT a.assignment_id, a.title, a.origin_link,
         c.course_name, d.due_date,
         s.email, s.full_name,
         lt.minutes
  FROM User_Account s
  LEFT JOIN Notification_Setting ns ON ns.user_id = s.user_id
  JOIN (
    SELECT user_id, minutes FROM Notification_Lead_Time
    UNION ALL
    -- The documented default, for accounts that have never saved settings.
    -- Clearing every lead time *after* saving is a different, real state: the
    -- row exists, so this arm does not fire and they get nothing.
    SELECT u.user_id, ?
    FROM User_Account u
    WHERE NOT EXISTS (SELECT 1 FROM Notification_Setting x WHERE x.user_id = u.user_id)
  ) lt                     ON lt.user_id = s.user_id
  JOIN Course c            ON c.student_id = s.user_id
  JOIN Assignment a        ON a.course_id = c.course_id
  JOIN Assignment_Detail d ON d.assignment_id = a.assignment_id
  WHERE COALESCE(ns.enabled, TRUE) = TRUE
    AND s.account_status = 'active'
    AND d.due_date IS NOT NULL
    AND (d.status IS NULL OR d.status NOT IN (?, ?))
    AND NOW() >= DATE_SUB(d.due_date, INTERVAL lt.minutes MINUTE)
    AND NOW() <  d.due_date
  ORDER BY d.due_date
`;

// FR-07.2 — one mail per unfinished task, keyed daily:<date>. CURDATE() rides
// along so a pass crossing midnight cannot straddle two dates.
// Inner join on purpose: daily_repeat defaults false, so no row means no repeat.
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

// Gated by two clocks. created_at alone would mail a whole term on first sync
// (all "seen just now"); posted_at alone misses a week-old post seen today.
// Both together keep 200 archived announcements from becoming 200 emails.
const ANNOUNCEMENT_SQL = `
  SELECT an.announcement_id, an.text_content, an.creator_name,
         an.origin_link, an.posted_at,
         c.course_name,
         s.email, s.full_name
  FROM User_Account s
  LEFT JOIN Notification_Setting ns ON ns.user_id = s.user_id
  JOIN Course c        ON c.student_id = s.user_id
  JOIN Announcement an ON an.course_id = c.course_id
  WHERE COALESCE(ns.enabled, TRUE) = TRUE
    AND COALESCE(ns.announcement_notify, TRUE) = TRUE
    AND s.account_status = 'active'
    AND an.created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
    AND (an.posted_at IS NULL OR an.posted_at >= DATE_SUB(an.created_at, INTERVAL ? DAY))
  ORDER BY an.posted_at DESC
`;

// Whoever inserts owns the send; a second pass gets affectedRows 0 and skips.
const CLAIM_SQL = `
  INSERT IGNORE INTO Notification
    (assignment_id, announcement_id, trigger_type, is_sent, attempt_count, next_attempt_at)
  VALUES (?, ?, ?, FALSE, 0, DATE_ADD(NOW(), INTERVAL ? MINUTE))
`;

// Keyed on the primary key, so no caller needs to know which target kind it is.
const MARK_SENT_SQL = `
  UPDATE Notification
     SET sent_at = NOW(), is_sent = TRUE, next_attempt_at = NULL
   WHERE notification_id = ?
`;

// Retries left. sent_at stays NULL, so readFailures() ignores it (UC-8 7a.3).
const MARK_RETRY_SQL = `
  UPDATE Notification
     SET attempt_count = attempt_count + 1,
         next_attempt_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
   WHERE notification_id = ?
`;

// Out of retries. sent_at set with is_sent false is what raises the banner.
const MARK_FAILED_SQL = `
  UPDATE Notification
     SET sent_at = NOW(), is_sent = FALSE,
         attempt_count = attempt_count + 1, next_attempt_at = NULL
   WHERE notification_id = ?
`;

// Expired lease or retry delay. attempt_count 0 is a pass that died mid-send.
const RETRY_SWEEP_SQL = `
  SELECT n.notification_id, n.trigger_type, n.attempt_count,
         a.assignment_id, a.title, a.origin_link,
         c.course_name, d.due_date,
         s.email, s.full_name
  FROM Notification n
  JOIN Assignment_Detail d      ON d.assignment_id = n.assignment_id
  JOIN Assignment a             ON a.assignment_id = d.assignment_id
  JOIN Course c                 ON c.course_id = a.course_id
  JOIN User_Account s                ON s.user_id = c.student_id
  -- LEFT, for the same reason LEAD_REMINDER_SQL is: a claim can belong to a
  -- student with no settings row, and an inner join would strand it unsent.
  LEFT JOIN Notification_Setting ns  ON ns.user_id = s.user_id
  WHERE n.is_sent = FALSE
    AND n.sent_at IS NULL
    AND n.attempt_count < ?
    AND n.next_attempt_at IS NOT NULL
    AND n.next_attempt_at <= NOW()
    AND COALESCE(ns.enabled, TRUE) = TRUE
    AND s.account_status = 'active'
    AND (d.status IS NULL OR d.status NOT IN (?, ?))
  ORDER BY n.next_attempt_at
`;

// The announcement half: RETRY_SWEEP_SQL joins Assignment_Detail, which an
// announcement row never matches. Disjoint columns, so a second statement.
const ANNOUNCEMENT_RETRY_SWEEP_SQL = `
  SELECT n.notification_id, n.trigger_type, n.attempt_count,
         an.announcement_id, an.text_content, an.creator_name,
         an.origin_link, an.posted_at,
         c.course_name,
         s.email, s.full_name
  FROM Notification n
  JOIN Announcement an              ON an.announcement_id = n.announcement_id
  JOIN Course c                     ON c.course_id = an.course_id
  JOIN User_Account s               ON s.user_id = c.student_id
  LEFT JOIN Notification_Setting ns ON ns.user_id = s.user_id
  WHERE n.is_sent = FALSE
    AND n.sent_at IS NULL
    AND n.attempt_count < ?
    AND n.next_attempt_at IS NOT NULL
    AND n.next_attempt_at <= NOW()
    AND COALESCE(ns.enabled, TRUE) = TRUE
    AND COALESCE(ns.announcement_notify, TRUE) = TRUE
    AND s.account_status = 'active'
  ORDER BY n.next_attempt_at
`;

// UC-8 5a.2 — drop unsent reminders for finished tasks; sent history stays.
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

// The trigger key decides which mail this is, so a retry rebuilds the right one.
function buildMessage(row, triggerType) {
  if (isAnnouncementTrigger(triggerType)) {
    return {
      subject: buildAnnouncementSubject({
        courseName: row.course_name,
        textContent: row.text_content,
      }),
      text: buildAnnouncementBody({
        studentName: row.full_name,
        courseName: row.course_name,
        creatorName: row.creator_name,
        textContent: row.text_content,
        postedAt: row.posted_at,
        originLink: row.origin_link,
      }),
    };
  }

  const common = {
    studentName: row.full_name,
    title: row.title,
    courseName: row.course_name,
    dueDate: row.due_date,
    assignmentId: row.assignment_id,
    originLink: row.origin_link,
  };

  if (leadMinutesFromTrigger(triggerType) !== null) {
    return {
      subject: buildSubject({ title: row.title, dueDate: row.due_date }),
      text: buildBody(common),
    };
  }
  if (String(triggerType).startsWith('daily:')) {
    return {
      subject: buildDailySubject({ title: row.title, dueDate: row.due_date }),
      text: buildDailyBody(common),
    };
  }

  // No fall-through: a fourth kind must fail loudly, not pick the wrong template.
  throw new Error(`unknown notification trigger: ${triggerType}`);
}

// Shared by the first attempt and every retry, so the two cannot drift.
async function deliver({ db, sendMail, logFailure, row, triggerType, notificationId, attemptsSoFar }) {
  try {
    const { subject, text } = buildMessage(row, triggerType);
    await sendMail({ to: row.email, subject, text });
    await db.query(MARK_SENT_SQL, [notificationId]);
    return 'sent';
  } catch (err) {
    // FR-07.7 — one bad address must not stop the pass.
    const delayMinutes = RETRY_MINUTES[attemptsSoFar];
    const outcome = delayMinutes === undefined ? 'failed' : 'retrying';

    if (outcome === 'retrying') {
      await db.query(MARK_RETRY_SQL, [delayMinutes, notificationId]);
    } else {
      await db.query(MARK_FAILED_SQL, [notificationId]);
    }

    await logFailure(err, {
      assignment_id: row.assignment_id ?? null,
      announcement_id: row.announcement_id ?? null,
      trigger_type: triggerType,
      attempt: attemptsSoFar + 1,
      outcome,
    });
    return outcome;
  }
}

// Injected, so the pass is testable without a database or an SMTP account.
async function runNotificationPass({
  db = pool,
  sendMail = mailerSendMail,
  logFailure = defaultLogFailure,
} = {}) {
  const [cancelled] = await db.query(CANCEL_COMPLETED_SQL, DONE_STATUSES);

  const tally = { sent: 0, failed: 0, retrying: 0, skipped: 0 };
  const count = (outcome) => { tally[outcome] += 1; };

  // Retries first: work already promised. Two sweeps, two sets of joins.
  const sweep = async (rows) => {
    for (const row of rows) {
      count(await deliver({
        db,
        sendMail,
        logFailure,
        row,
        triggerType: row.trigger_type,
        notificationId: row.notification_id,
        attemptsSoFar: row.attempt_count,
      }));
    }
  };

  const [retries] = await db.query(RETRY_SWEEP_SQL, [MAX_ATTEMPTS, ...DONE_STATUSES]);
  await sweep(retries);

  const [announcementRetries] = await db.query(ANNOUNCEMENT_RETRY_SWEEP_SQL, [MAX_ATTEMPTS]);
  await sweep(announcementRetries);

  // Claim, then send. Exactly one target column is set (chk_notification_target).
  const claimAndSend = async (row, triggerType) => {
    const [claim] = await db.query(CLAIM_SQL, [
      row.assignment_id ?? null,
      row.announcement_id ?? null,
      triggerType,
      CLAIM_LEASE_MINUTES,
    ]);

    // Already claimed or already sent — someone else owns this reminder.
    if (!claim.affectedRows) {
      count('skipped');
      return;
    }
    count(await deliver({
      db, sendMail, logFailure, row, triggerType, notificationId: claim.insertId, attemptsSoFar: 0,
    }));
  };

  // Default lead time binds first: its placeholder is in the FROM clause.
  const [rows] = await db.query(LEAD_REMINDER_SQL, [DEFAULT_LEAD_MINUTES, ...DONE_STATUSES]);
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

  const [announcements] = await db.query(ANNOUNCEMENT_SQL, [
    ANNOUNCEMENT_SEEN_HOURS,
    ANNOUNCEMENT_FRESH_DAYS,
  ]);
  for (const row of announcements) {
    await claimAndSend(row, announcementTriggerType());
  }

  return {
    cancelled: cancelled?.affectedRows ?? 0,
    candidates: rows.length,
    dailyCandidates: daily.length,
    announcementCandidates: announcements.length,
    retried: retries.length + announcementRetries.length,
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
  buildAnnouncementSubject,
  buildAnnouncementBody,
  buildMessage,
  formatThaiDateTime,
  humanizeGap,
  minutesUntil,
  leadTriggerType,
  dailyTriggerType,
  announcementTriggerType,
  leadMinutesFromTrigger,
  isAnnouncementTrigger,
  DONE_STATUSES,
  RETRY_MINUTES,
  MAX_ATTEMPTS,
  DAILY_WINDOW_DAYS,
  DEFAULT_LEAD_MINUTES,
  ANNOUNCEMENT_SEEN_HOURS,
  ANNOUNCEMENT_FRESH_DAYS,
};
