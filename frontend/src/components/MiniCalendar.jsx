import React from 'react';

const poppins = "'Poppins', sans-serif";
const TH_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const WEEKDAYS = ['อา', 'จ', 'อ', 'พฤ', 'พ', 'ศ', 'ส'];

// Month calendar. `busyDays` = Set of day numbers that have a due date.
function MiniCalendar({ year, month, today, busyDays }) {
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let n = 1; n <= daysInMonth; n++) cells.push(n);

  return (
    <div>
      <div style={styles.header}>
        <span style={styles.title}>
          {TH_MONTHS[month]} {year + 543}
        </span>
      </div>
      <div style={styles.grid}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={styles.weekday}>{w}</div>
        ))}
        {cells.map((n, i) => {
          const isToday = n === today;
          const hasDot = n != null && busyDays.has(n) && !isToday;
          return (
            <div
              key={i}
              style={{
                ...styles.cell,
                color: isToday ? 'white' : 'oklch(30% 0.02 290)',
                background: isToday ? 'oklch(58% 0.17 290)' : 'transparent',
                fontWeight: isToday ? 700 : 500,
              }}
            >
              {n || ''}
              {hasDot && <div style={styles.dot} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: poppins, fontWeight: 700, fontSize: 16, color: 'oklch(25% 0.02 290)' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 5,
    marginTop: 16,
  },
  weekday: {
    fontSize: 10.5,
    color: 'oklch(60% 0.02 90)',
    textAlign: 'center',
    fontWeight: 600,
  },
  cell: {
    aspectRatio: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11.5,
    borderRadius: 8,
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: '50%',
    background: 'oklch(62% 0.19 25)',
  },
};

export default MiniCalendar;
