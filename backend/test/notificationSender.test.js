const test = require('node:test');
const assert = require('node:assert/strict');

const {
  runNotificationPass,
  buildSubject,
  buildBody,
  formatThaiDateTime,
  leadTriggerType,
  leadMinutesFromTrigger,
  buildDailyBody,
  buildMessage,
  humanizeGap,
  RETRY_MINUTES,
  MAX_ATTEMPTS,
  DAILY_WINDOW_DAYS,
} = require('../src/services/notificationSender');

const DUE = new Date('2026-09-20T23:59:00');

// One candidate row shaped exactly like what LEAD_REMINDER_SQL selects.
function candidate(overrides = {}) {
  return {
    assignment_id: 11,
    title: 'รายงานบทที่ 3',
    origin_link: 'https://classroom.google.com/c/abc',
    course_name: 'ฐานข้อมูล',
    due_date: DUE,
    university_email: 'student@uni.ac.th',
    student_name: 'สมชาย',
    minutes: 1440,
    ...overrides,
  };
}

// A row as RETRY_SWEEP_SQL returns it: already claimed, carrying its own
// trigger_type and how many attempts it has burned.
function retryRow(overrides = {}) {
  const { minutes, ...rest } = candidate();
  return {
    ...rest,
    trigger_type: 'lead:1440:2026-09-20 23:59',
    attempt_count: 1,
    ...overrides,
  };
}

// Same hand-written stub style as devStudentSeeder.test.js: dispatch on a
// distinctive fragment of each statement, return the mysql2 [rows, fields]
// tuple, and throw on anything unrecognised so query drift is caught loudly.
function dailyRow(overrides = {}) {
  const { minutes, ...rest } = candidate();
  return { ...rest, today: '2026-09-16', ...overrides };
}

function createFakeDb({
  candidates = [], retries = [], daily = [], claimResults = null, cancelled = 0,
} = {}) {
  const state = {
    cancelCalls: 0,
    claims: [],
    marked: [],
    failuresLogged: [],
  };
  let claimIndex = 0;

  return {
    state,
    async query(sql, params) {
      if (sql.includes('DELETE n FROM Notification')) {
        state.cancelCalls++;
        return [{ affectedRows: cancelled }, []];
      }
      // Must be tested before the candidate query: both mention Notification_Setting.
      if (sql.includes('FROM Notification n')) {
        return [retries, []];
      }
      if (sql.includes('ns.daily_repeat = TRUE')) {
        return [daily, []];
      }
      if (sql.includes('FROM Notification_Setting ns')) {
        return [candidates, []];
      }
      if (sql.includes('INSERT IGNORE INTO Notification')) {
        state.claims.push({ assignmentId: params[0], triggerType: params[1] });
        const affectedRows = claimResults ? Number(claimResults[claimIndex++]) : 1;
        return [{ affectedRows }, []];
      }
      if (sql.includes('is_sent = TRUE')) {
        state.marked.push({ result: 'sent', assignmentId: params[0], triggerType: params[1] });
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes('next_attempt_at = DATE_ADD')) {
        state.marked.push({ result: 'retrying', delayMinutes: params[0], assignmentId: params[1] });
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes('is_sent = FALSE')) {
        state.marked.push({ result: 'failed', assignmentId: params[0], triggerType: params[1] });
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unexpected fake query: ${sql}`);
    },
  };
}

function collectingMailer() {
  const sent = [];
  return {
    sent,
    async sendMail(message) {
      sent.push(message);
      return { delivered: true, skipped: false };
    },
  };
}

function run(db, sendMail, state) {
  return runNotificationPass({
    db,
    sendMail,
    logFailure: async (err, context) => {
      state.failuresLogged.push({ message: err.message, ...context });
    },
  });
}

test('subject carries the task name and its due date', () => {
  const subject = buildSubject({ title: 'รายงานบทที่ 3', dueDate: DUE });

  assert.match(subject, /รายงานบทที่ 3/);
  assert.match(subject, /20 ก\.ย\. 2569/);
  assert.match(subject, /23:59/);
});

test('body carries task name, course name and due date together', () => {
  const body = buildBody({
    studentName: 'สมชาย',
    title: 'รายงานบทที่ 3',
    courseName: 'ฐานข้อมูล',
    dueDate: DUE,
    leadMinutes: 1440,
    assignmentId: 11,
  });

  assert.match(body, /รายงานบทที่ 3/);
  assert.match(body, /ฐานข้อมูล/);
  assert.match(body, /20 ก\.ย\. 2569 23:59/);
  assert.match(body, /\/assignments\/11/);
});

test('thai dates are rendered in the buddhist era', () => {
  assert.match(formatThaiDateTime(DUE), /2569/);
  assert.equal(formatThaiDateTime('not a date'), 'ไม่ระบุกำหนดส่ง');
});

// The lead time that triggered the mail is not the same thing as the time left
// by the moment it goes out — a retry can be hours behind.
test('the countdown is measured from the due date, not the lead time', () => {
  const now = new Date('2026-09-20T02:00:00');       // 21h59m before DUE
  const text = buildBody({
    studentName: 'สมชาย', title: 'งาน', courseName: 'วิชา', dueDate: DUE, assignmentId: 1,
  }, now);

  assert.match(text, /อีก 21 ชั่วโมง/);
  assert.doesNotMatch(text, /อีก 1 วัน/);
});

test('a mail sent right on the lead mark still reads as that lead time', () => {
  const now = new Date('2026-09-19T23:59:00');       // exactly 1 day before DUE
  const text = buildBody({
    studentName: 'สมชาย', title: 'งาน', courseName: 'วิชา', dueDate: DUE, assignmentId: 1,
  }, now);

  assert.match(text, /อีก 1 วัน/);
});

test('the due date is part of the trigger key so a moved deadline re-arms', () => {
  const original = leadTriggerType(1440, DUE);
  const moved = leadTriggerType(1440, new Date('2026-09-27T23:59:00'));

  assert.equal(original, 'lead:1440:2026-09-20 23:59');
  assert.notEqual(original, moved);
  assert.ok(original.length <= 50, 'trigger_type must fit VARCHAR(50)');
});

test('a claimed reminder is sent and marked sent', async () => {
  const db = createFakeDb({ candidates: [candidate()] });
  const mailer = collectingMailer();

  const result = await run(db, mailer.sendMail, db.state);

  assert.equal(result.sent, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.skipped, 0);
  assert.equal(mailer.sent.length, 1);
  assert.equal(mailer.sent[0].to, 'student@uni.ac.th');
  assert.deepEqual(db.state.marked, [
    { result: 'sent', assignmentId: 11, triggerType: 'lead:1440:2026-09-20 23:59' },
  ]);
});

test('losing the claim sends nothing — this is what stops a duplicate email', async () => {
  const db = createFakeDb({ candidates: [candidate()], claimResults: [0] });
  const mailer = collectingMailer();

  const result = await run(db, mailer.sendMail, db.state);

  assert.equal(result.skipped, 1);
  assert.equal(result.sent, 0);
  assert.equal(mailer.sent.length, 0);
  assert.deepEqual(db.state.marked, []);
});

test('the first failed send schedules a retry and is handed to the error log', async () => {
  const db = createFakeDb({ candidates: [candidate()] });
  const failing = async () => { throw new Error('smtp refused'); };

  const result = await run(db, failing, db.state);

  assert.equal(result.retrying, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.sent, 0);
  assert.equal(db.state.marked[0].result, 'retrying');
  assert.equal(db.state.marked[0].delayMinutes, 5);
  assert.equal(db.state.failuresLogged.length, 1);
  assert.equal(db.state.failuresLogged[0].message, 'smtp refused');
  assert.equal(db.state.failuresLogged[0].assignment_id, 11);
  assert.equal(db.state.failuresLogged[0].attempt, 1);
});

// The banner is driven by readFailures(), which counts only rows carrying a
// sent_at. Writing one mid-ladder would nag the student about a send the system
// is still perfectly willing to retry (UC-8 7a.3).
test('a retry in flight never writes sent_at, so the banner stays quiet', async () => {
  for (const attemptsSoFar of [0, 1, 2]) {
    const db = createFakeDb({
      retries: [retryRow({ attempt_count: attemptsSoFar })],
    });
    const failing = async () => { throw new Error('still down'); };

    const result = await run(db, failing, db.state);

    assert.equal(result.retrying, 1, `attempt ${attemptsSoFar} should retry`);
    assert.equal(result.failed, 0);
    assert.equal(db.state.marked[0].result, 'retrying');
    assert.equal(db.state.marked[0].delayMinutes, RETRY_MINUTES[attemptsSoFar]);
  }
});

test('the ladder waits 5, then 30, then 120 minutes', () => {
  assert.deepEqual(RETRY_MINUTES, [5, 30, 120]);
  assert.equal(MAX_ATTEMPTS, 4); // the first send plus three retries
});

test('the last retry gives up and records a real failure', async () => {
  const db = createFakeDb({ retries: [retryRow({ attempt_count: RETRY_MINUTES.length })] });
  const failing = async () => { throw new Error('gave up'); };

  const result = await run(db, failing, db.state);

  assert.equal(result.failed, 1);
  assert.equal(result.retrying, 0);
  assert.equal(db.state.marked[0].result, 'failed');
  assert.equal(db.state.failuresLogged[0].outcome, 'failed');
  assert.equal(db.state.failuresLogged[0].attempt, MAX_ATTEMPTS);
});

test('a retry that succeeds is marked sent and stops the ladder', async () => {
  const db = createFakeDb({ retries: [retryRow({ attempt_count: 2 })] });
  const mailer = collectingMailer();

  const result = await run(db, mailer.sendMail, db.state);

  assert.equal(result.sent, 1);
  assert.equal(result.retried, 1);
  assert.equal(mailer.sent.length, 1);
  assert.equal(db.state.marked[0].result, 'sent');
});

// A retry has no Notification_Lead_Time row to consult — the student may have
// deselected it since. The key is the only record of which mail this was.
test('a retry rebuilds the countdown mail from the trigger key', async () => {
  const db = createFakeDb({
    retries: [retryRow({ trigger_type: 'lead:180:2026-09-20 23:59', attempt_count: 1 })],
  });
  const mailer = collectingMailer();

  await run(db, mailer.sendMail, db.state);

  assert.equal(leadMinutesFromTrigger('lead:180:2026-09-20 23:59'), 180);
  assert.equal(leadMinutesFromTrigger('daily:2026-09-16'), null);
  assert.match(mailer.sent[0].subject, /^\[ใกล้ครบกำหนด\]/);
});

test('one bad address does not stop the rest of the pass', async () => {
  const db = createFakeDb({
    candidates: [candidate({ assignment_id: 1 }), candidate({ assignment_id: 2 })],
  });
  const sent = [];
  const sendMail = async (message) => {
    if (sent.length === 0) {
      sent.push(null);
      throw new Error('mailbox full');
    }
    sent.push(message);
  };

  const result = await run(db, sendMail, db.state);

  assert.equal(result.retrying, 1);
  assert.equal(result.sent, 1);
  assert.equal(result.candidates, 2);
});

test('finished tasks have their unsent reminders cancelled first', async () => {
  const db = createFakeDb({ candidates: [], cancelled: 3 });
  const mailer = collectingMailer();

  const result = await run(db, mailer.sendMail, db.state);

  assert.equal(db.state.cancelCalls, 1);
  assert.equal(result.cancelled, 3);
  assert.equal(mailer.sent.length, 0);
});

test('an empty candidate list touches no mail transport at all', async () => {
  const db = createFakeDb({ candidates: [] });
  const mailer = collectingMailer();

  const result = await run(db, mailer.sendMail, db.state);

  assert.deepEqual(result, {
    cancelled: 0,
    candidates: 0,
    dailyCandidates: 0,
    retried: 0,
    sent: 0,
    failed: 0,
    retrying: 0,
    skipped: 0,
  });
  assert.equal(mailer.sent.length, 0);
  assert.deepEqual(db.state.claims, []);
});

test('the daily repeat keys by date, so it sends once a day per task', async () => {
  const db = createFakeDb({ daily: [dailyRow()] });
  const mailer = collectingMailer();

  const result = await run(db, mailer.sendMail, db.state);

  assert.equal(result.dailyCandidates, 1);
  assert.equal(result.sent, 1);
  assert.equal(db.state.claims[0].triggerType, 'daily:2026-09-16');
});

test('a second daily pass on the same day sends nothing', async () => {
  const db = createFakeDb({ daily: [dailyRow()], claimResults: [0] });
  const mailer = collectingMailer();

  const result = await run(db, mailer.sendMail, db.state);

  assert.equal(result.skipped, 1);
  assert.equal(mailer.sent.length, 0);
});

// Telling someone a deadline they already missed is "coming up" is worse than
// not writing, so overdue work gets its own wording.
test('an overdue task says so instead of counting down', async () => {
  const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const db = createFakeDb({ daily: [dailyRow({ due_date: past })] });
  const mailer = collectingMailer();

  await run(db, mailer.sendMail, db.state);

  assert.match(mailer.sent[0].subject, /^\[เลยกำหนดแล้ว\]/);
  assert.match(mailer.sent[0].text, /เลยกำหนดส่งมาแล้ว 3 วัน/);
});

test('a task still ahead counts down in the daily mail', async () => {
  const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const db = createFakeDb({ daily: [dailyRow({ due_date: soon })] });
  const mailer = collectingMailer();

  await run(db, mailer.sendMail, db.state);

  assert.match(mailer.sent[0].subject, /^\[งานค้าง\]/);
  assert.match(mailer.sent[0].text, /เหลืออีก 2 วัน/);
});

test('the daily mail still carries task, course and due date', () => {
  const text = buildDailyBody({
    studentName: 'สมชาย',
    title: 'รายงานบทที่ 3',
    courseName: 'ฐานข้อมูล',
    dueDate: DUE,
    assignmentId: 11,
  });

  assert.match(text, /รายงานบทที่ 3/);
  assert.match(text, /ฐานข้อมูล/);
  assert.match(text, /20 ก\.ย\. 2569 23:59/);
});

test('gaps read as days, hours or minutes', () => {
  assert.equal(humanizeGap(4320), '3 วัน');
  assert.equal(humanizeGap(200), '3 ชั่วโมง');
  assert.equal(humanizeGap(20), '20 นาที');
  assert.equal(humanizeGap(0), '1 นาที');
});

// A daily row has no lead time in its key; that absence is what selects the
// daily wording when a retry rebuilds the mail.
test('a retry of a daily mail rebuilds the daily wording', () => {
  const row = {
    title: 'งานค้าง', course_name: 'วิชา', due_date: DUE,
    student_name: 'สมชาย', assignment_id: 7,
  };

  assert.match(buildMessage(row, 'daily:2026-09-16').subject, /\[(งานค้าง|เลยกำหนดแล้ว)\]/);
  assert.match(buildMessage(row, 'lead:1440:2026-09-20 23:59').subject, /\[ใกล้ครบกำหนด\]/);
});

test('the daily window is seven days either side', () => {
  assert.equal(DAILY_WINDOW_DAYS, 7);
});

// Retries are work already promised to someone; a burst of new candidates should
// not push them behind.
test('retries are attempted before fresh candidates', async () => {
  const db = createFakeDb({
    retries: [retryRow({ assignment_id: 99 })],
    candidates: [candidate({ assignment_id: 11 })],
  });
  const mailer = collectingMailer();

  const result = await run(db, mailer.sendMail, db.state);

  assert.equal(result.sent, 2);
  assert.deepEqual(mailer.sent.map(() => true), [true, true]);
  assert.deepEqual(db.state.marked.map((m) => m.assignmentId), [99, 11]);
});
