// backend/src/services/teamsSync.js
const { MS_CLIENT_ID, MS_CLIENT_SECRET, MS_TOKEN_URL } = require('../config');

// Microsoft ส่งเวลามาเป็น ISO String (เช่น "2023-10-31T23:59:00Z")
// ฟังก์ชันนี้แปลงให้อยู่ในฟอร์แมต MySQL DATETIME
function msToMysqlDateTime(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:00`
  );
}

// ขอ Access Token ใหม่จาก Refresh Token (เพราะ Token MS หมดอายุไว)
async function refreshMsToken(refreshToken) {
  const res = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('Failed to refresh Microsoft token');
  return await res.json();
}

// ยิง Graph API เพื่อดึงวิชาเรียน (Teams)
async function getMsClasses(accessToken) {
  const res = await fetch('https://graph.microsoft.com/v1.0/education/me/classes', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch MS Classes');
  const data = await res.json();
  return data.value || [];
}

// ยิง Graph API เพื่อดึงงานในแต่ละวิชา
async function getMsAssignments(accessToken, classId) {
  const res = await fetch(`https://graph.microsoft.com/v1.0/education/classes/${classId}/assignments`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch assignments for class ${classId}`);
  const data = await res.json();
  return data.value || [];
}

module.exports = { msToMysqlDateTime, refreshMsToken, getMsClasses, getMsAssignments };
