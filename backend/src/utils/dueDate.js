// A datetime-local input sends 'YYYY-MM-DDTHH:mm' with no timezone. Parsing
// and reformatting both in server-local time round-trips the wall clock the
// student actually typed, whatever the container's TZ is.
// Returns a DATETIME string, null for "no due date", or false if unparseable.
function parseDueDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:00`
  );
}

module.exports = { parseDueDate };
