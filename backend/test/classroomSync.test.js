const test = require('node:test');
const assert = require('node:assert');

const {
  dueInstant,
  toMysqlDateTime,
  isoToMysqlDateTime,
  listCourseWorkSince,
} = require('../src/services/classroomSync');

// The helpers return wall-clock strings in whatever timezone the test host runs
// in, so asserting on the text would only pass in one place. Reading the string
// back as local time and comparing the instant tests the actual contract.
function asInstant(mysqlDateTime) {
  const [datePart, timePart] = mysqlDateTime.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes, seconds] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, seconds).toISOString();
}

test('a due time is converted from UTC rather than copied', () => {
  // 11:00 UTC is 18:00 in Asia/Bangkok, which is what Classroom showed.
  const result = toMysqlDateTime({ year: 2026, month: 9, day: 25 }, { hours: 11, minutes: 0 });
  assert.strictEqual(asInstant(result), '2026-09-25T11:00:00.000Z');
});

test('an omitted minutes field means zero, not 59', () => {
  // Classroom drops zero-valued fields, so an on-the-hour deadline arrives
  // with no minutes key. `?? 59` turned 18:00 into 18:59.
  const withoutMinutes = toMysqlDateTime({ year: 2026, month: 9, day: 25 }, { hours: 11 });
  const withZero = toMysqlDateTime({ year: 2026, month: 9, day: 25 }, { hours: 11, minutes: 0 });
  assert.strictEqual(withoutMinutes, withZero);
});

test('an omitted hours field means midnight UTC, not 23:00', () => {
  const result = toMysqlDateTime({ year: 2026, month: 9, day: 25 }, { minutes: 30 });
  assert.strictEqual(asInstant(result), '2026-09-25T00:30:00.000Z');
});

test('no due time at all still means end of the local day', () => {
  // Nothing to convert here: the teacher set a date and no time.
  assert.strictEqual(
    toMysqlDateTime({ year: 2026, month: 9, day: 25 }, undefined),
    '2026-09-25 23:59:00'
  );
});

test('no due date at all is null', () => {
  assert.strictEqual(toMysqlDateTime(null, { hours: 11 }), null);
});

test('month and day are zero padded', () => {
  assert.match(toMysqlDateTime({ year: 2026, month: 1, day: 5 }, undefined), /^2026-01-05 /);
});

test('a posted timestamp is converted to local, not left in UTC', () => {
  const result = isoToMysqlDateTime('2026-09-25T09:08:11.000Z');
  assert.strictEqual(asInstant(result), '2026-09-25T09:08:11.000Z');
});

test('a missing posted timestamp is null', () => {
  assert.strictEqual(isoToMysqlDateTime(null), null);
  assert.strictEqual(isoToMysqlDateTime(''), null);
});

test('an unparseable timestamp is null rather than NaN text', () => {
  assert.strictEqual(isoToMysqlDateTime('not a date'), null);
});

// The cutoff filter used to build its own Date from the calendar fields, which
// read UTC numbers as local midnight and ignored dueTime. Deriving both from
// dueInstant is what keeps the filter and the stored column in step.
test('the cutoff filter and the stored column describe the same instant', () => {
  const date = { year: 2026, month: 9, day: 25 };
  const time = { hours: 11 };
  assert.strictEqual(
    asInstant(toMysqlDateTime(date, time)),
    dueInstant(date, time).toISOString()
  );
});

// A one-page fake: enough to drive the loop without a Google client.
function fakeClassroom(courseWork) {
  return { courses: { courseWork: { list: async () => ({ data: { courseWork } }) } } };
}

test('the cutoff keeps a task due later the same UTC day', async () => {
  // 11:00 UTC on the 25th. Local midnight on the 25th — what the old filter
  // compared — sits before an 07:00 cutoff, so this used to be dropped in any
  // timezone ahead of UTC.
  const work = [{ id: 'w1', state: 'PUBLISHED', dueDate: { year: 2026, month: 9, day: 25 }, dueTime: { hours: 11 } }];
  const kept = await listCourseWorkSince(fakeClassroom(work), 'c1', new Date('2026-09-25T07:00:00Z'));
  assert.deepStrictEqual(kept.map((w) => w.id), ['w1']);
});

test('the cutoff still stops at a task due before it', async () => {
  const work = [{ id: 'w1', state: 'PUBLISHED', dueDate: { year: 2026, month: 9, day: 20 }, dueTime: { hours: 11 } }];
  const kept = await listCourseWorkSince(fakeClassroom(work), 'c1', new Date('2026-09-25T07:00:00Z'));
  assert.deepStrictEqual(kept, []);
});

test('drafts are skipped whatever the cutoff says', async () => {
  const work = [
    { id: 'draft', state: 'DRAFT', dueDate: { year: 2026, month: 9, day: 25 }, dueTime: { hours: 11 } },
    { id: 'live', state: 'PUBLISHED', dueDate: { year: 2026, month: 9, day: 25 }, dueTime: { hours: 11 } },
  ];
  const kept = await listCourseWorkSince(fakeClassroom(work), 'c1', null);
  assert.deepStrictEqual(kept.map((w) => w.id), ['live']);
});

test('a task with no due date is kept regardless of the cutoff', async () => {
  const work = [{ id: 'w1', state: 'PUBLISHED' }];
  const kept = await listCourseWorkSince(fakeClassroom(work), 'c1', new Date('2026-09-25T07:00:00Z'));
  assert.deepStrictEqual(kept.map((w) => w.id), ['w1']);
});
