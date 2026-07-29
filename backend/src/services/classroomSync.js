function toMysqlDateTime(dueDate, dueTime) {
  if (!dueDate) return null;
  const { year, month, day } = dueDate;
  const hours = dueTime?.hours ?? 23;
  const minutes = dueTime?.minutes ?? 59;
  const pad = (n) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(minutes)}:00`;
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

module.exports = { toMysqlDateTime, listCourseWorkSince };
