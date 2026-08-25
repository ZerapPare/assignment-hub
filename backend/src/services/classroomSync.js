function toMysqlDateTime(dueDate, dueTime) {
  if (!dueDate) return null;
  const { year, month, day } = dueDate;
  const hours = dueTime?.hours ?? 23;
  const minutes = dueTime?.minutes ?? 59;
  const pad = (n) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(minutes)}:00`;
}

// Convert ISO strings (e.g. announcement.creationTime) to MySQL DATETIME
function isoToMysqlDateTime(isoString) {
  if (!isoString) return null;
  return new Date(isoString).toISOString().slice(0, 19).replace('T', ' ');
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
      if (cutoffDate && work.dueDate) {
        const due = new Date(work.dueDate.year, work.dueDate.month - 1, work.dueDate.day);
        if (due < cutoffDate) return results;
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

// Helper to fetch user profiles with in-memory caching per sync execution
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
  toMysqlDateTime,
  isoToMysqlDateTime,
  listCourseWorkSince,
  listAnnouncementsSince,
  getCreatorProfile,
};