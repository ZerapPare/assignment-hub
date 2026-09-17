// หาช่วง 7 วันของสัปดาห์ที่มี date อยู่
const getWeekRange = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay(); // 0=อาทิตย์
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMon);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
};

// เทียบ deadline: null = หลังสุด
const compareDeadline = (a, b) => {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a) - new Date(b);
};

module.exports = { getWeekRange, compareDeadline };