// แปลงเวลา HH:MM หรือ HH:MM:SS เป็นจำนวนวินาทีหลังเที่ยงคืน
function parseTimeSeconds(value) {
  if (typeof value !== 'string') return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(value);
  if (!match) return null;

  const [, hours, minutes, seconds = '0'] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

// ตรวจช่วงเวลาที่เลือกปิดได้: null/null คือปิด, มิฉะนั้นต้องเป็นเวลาเริ่มก่อนเวลาจบ
// อนุญาต end=00:00 เมื่อ start อยู่หลังเที่ยงคืนของวันเดียวกัน เพื่อแทนเที่ยงคืนวันถัดไป
function isValidOptionalTimeRange(start, end) {
  if (start === null && end === null) return true;

  const startSeconds = parseTimeSeconds(start);
  const endSeconds = parseTimeSeconds(end);
  return startSeconds !== null && endSeconds !== null && (
    startSeconds < endSeconds
    || (endSeconds === 0 && startSeconds > 0)
  );
}

module.exports = { isValidOptionalTimeRange };
