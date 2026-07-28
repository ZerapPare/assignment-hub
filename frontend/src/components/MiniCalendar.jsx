import React from 'react';
import { C, FONT, WEEKDAYS, TH_MONTHS } from '../theme';

function MiniCalendar({ year, month, today, busyDays, onPrev, onNext }) {
  const firstWeekday = new Date(year, month, 1).getDay();
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
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={onPrev} style={styles.navBtn} aria-label="เดือนก่อนหน้า">
            ‹
          </button>
          <button type="button" onClick={onNext} style={styles.navBtn} aria-label="เดือนถัดไป">
            ›
          </button>
        </div>
      </div>

      <div style={styles.grid}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={styles.weekday}>
            {w}
          </div>
        ))}
        {cells.map((n, i) => {
          const isToday = n != null && n === today;
          const hasDot = n != null && busyDays.has(n) && !isToday;
          return (
            <div
              key={i}
              style={{
                ...styles.cell,
                color: isToday ? 'white' : n == null ? 'transparent' : C.navy,
                background: isToday ? C.pink : 'transparent',
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
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: { fontFamily: FONT, fontWeight: 700, fontSize: 14.5, color: C.ink },
  navBtn: {
    width: 22,
    height: 22,
    borderRadius: 6,
    border: 'none',
    background: C.card,
    color: C.ink,
    fontSize: 11,
    lineHeight: 1,
    cursor: 'pointer',
    padding: 0,
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 },
  weekday: { fontSize: 10, color: '#6b8aa8', textAlign: 'center', fontWeight: 600 },
  cell: {
    aspectRatio: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11.5,
    borderRadius: 4,
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: '50%',
    background: C.pink,
  },
};

export default MiniCalendar;
