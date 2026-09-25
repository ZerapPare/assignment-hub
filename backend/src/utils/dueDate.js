// datetime-local sends 'YYYY-MM-DDTHH:mm' with no timezone, so parsing and
// reformatting in server-local time round-trips the wall clock as typed.
// Returns a DATETIME string, null for "no due date", false if unparseable.
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
