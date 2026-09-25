// services/classroomSync.js[cite: 13]
const pad = (n) => String(n).padStart(2, '0');

// Every datetime this file writes is wall-clock in the server's timezone, the
// same convention utils/dueDate.js sets for hand-entered deadlines and the one
// the reminder sender compares against NOW(). Classroom speaks UTC, so the two
// have to be converted — copying the numbers across silently shifted every
// imported deadline by the UTC offset.
function toLocalDateTime(date) {
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// The moment a task is actually due. Both the column we store and the cutoff
// filter below are derived from this one function, so the two cannot end up
// disagreeing about which side of a cutoff a task falls on.
function dueInstant(dueDate, dueTime) {
  if (!dueDate) return null;
  const { year, month, day } = dueDate;

  // A date with no time set: nothing to convert, and end of the local day is
  // the reading that matches how Classroom shows it.
  if (!dueTime) return new Date(year, month - 1, day, 23, 59, 0);

  // Zero fields are absent, not zero — proto3 omits them — so an 18:00 (+07)
  // deadline arrives as { hours: 11 } with no minutes at all. Defaulting each
  // field on its own to 23/59 read that as 11:59: wrong hour, wrong minute.
  return new Date(Date.UTC(
    year, month - 1, day, dueTime.hours ?? 0, dueTime.minutes ?? 0, 0
  ));
}

function toMysqlDateTime(dueDate, dueTime) {
  const due = dueInstant(dueDate, dueTime);
  return due ? toLocalDateTime(due) : null;
}

function isoToMysqlDateTime(isoString) {
  if (!isoString) return null;
  // Was toISOString().slice(), which stored UTC in a column read as local.
  return toLocalDateTime(new Date(isoString));
}

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
      // Was built straight from the calendar fields, which read UTC numbers as
      // local midnight and dropped dueTime — a different deadline from the one
      // the same task gets stored with, and from the one the prune in
      // routes/classroom.js then tests against that column.
      if (cutoffDate && work.dueDate) {
        if (dueInstant(work.dueDate, work.dueTime) < cutoffDate) return results;
      }
      results.push(work);
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return results;
}

async function listAnnouncementsSince(classroom, courseId, cutoffDate) {
  const results = [];
  let pageToken;
  do {
    const { data } = await classroom.courses.announcements.list({
      courseId,
      pageSize: 50,
      pageToken,
    });
    const items = data.announcements || [];

    for (const ann of items) {
      if (ann.state !== 'PUBLISHED') continue;
      if (cutoffDate && ann.creationTime) {
        if (new Date(ann.creationTime) < cutoffDate) return results;
      }
      results.push(ann);
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return results;
}

async function getCreatorProfile(classroom, userId, profileCache) {
  if (!userId) return { name: null, email: null };
  if (profileCache.has(userId)) return profileCache.get(userId);

  try {
    const { data } = await classroom.userProfiles.get({ userId });
    const profile = {
      name: data.name?.fullName || null,
      email: data.emailAddress || null,
    };
    profileCache.set(userId, profile);
    return profile;
  } catch (err) {
    console.warn('[classroom] failed to fetch profile for user %s: %s', userId, err.message);
    return { name: null, email: null };
  }
}

module.exports = {
  dueInstant,
  toMysqlDateTime,
  isoToMysqlDateTime,
  listCourseWorkSince,
  listAnnouncementsSince,
  getCreatorProfile,
};