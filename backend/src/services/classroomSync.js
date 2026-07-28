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

module.exports = { toMysqlDateTime, listCourseWorkSince };
