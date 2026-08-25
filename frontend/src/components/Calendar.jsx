import React, { useState } from 'react';
import { C, FONT, WEEKDAYS, TH_MONTHS } from '../theme';

function CalendarEvent({ event }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{ ...styles.eventWrap, zIndex: isHovered ? 100 : 1 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={styles.eventBadge}>{event.title}</div>

      {isHovered && (
        <div style={styles.popup}>
          <div style={styles.popupCourse}>{event.course_name || 'ไม่มีรายวิชา'}</div>
          <div style={styles.popupTitle}>{event.title}</div>
          <div style={styles.popupTime}>
            กำหนดส่ง:{' '}
            {event.due
              ? `${String(event.due.getHours()).padStart(2, '0')}:${String(
                  event.due.getMinutes()
                ).padStart(2, '0')} น.`
              : '—'}
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarCell({ n, isToday, events }) {
  if (n == null) {
    return <div style={{ ...styles.cell, background: C.pageBg }} />;
  }

  return (
    <div style={{ ...styles.cell, background: 'white' }}>
      <div
        style={{
          ...styles.dateNum,
          background: isToday ? C.pink : 'transparent',
          color: isToday ? 'white' : C.navy,
          fontWeight: isToday ? 700 : 500,
        }}
      >
        {n}
      </div>

      <div style={styles.eventContainer}>
        {events.slice(0, 2).map((a) => (
          <CalendarEvent key={a.assignment_id} event={a} />
        ))}
        {events.length > 2 && (
          <div style={styles.moreText}>+ อีก {events.length - 2} งาน</div>
        )}
      </div>
    </div>
  );
}

function Calendar({ year, month, today, eventsByDate = new Map(), onPrev, onNext }) {
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
        <div style={styles.navWrap}>
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
        {cells.map((n, i) => (
          <CalendarCell
            key={i}
            n={n}
            isToday={n != null && n === today}
            events={n != null ? eventsByDate.get(n) || [] : []}
          />
        ))}
      </div>
    </div>
  );
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontFamily: FONT,
    fontWeight: 700,
    fontSize: 18,
    color: C.ink,
  },
  navWrap: {
    display: 'flex',
    gap: 8,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: 'none',
    background: 'rgba(255,255,255,0.2)',
    color: C.navy,
    fontSize: 18,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 1,
    background: C.line,
    border: `1px solid ${C.line}`,
    borderRadius: 8,
  },
  weekday: {
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    fontWeight: 600,
    background: 'white',
    padding: '12px 0',
  },
  cell: {
    height: 120,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    padding: '6px 6px 2px',
    boxSizing: 'border-box',
    minWidth: 0,
  },
  eventContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginTop: 'auto',
    minWidth: 0,
  },
  eventWrap: {
    position: 'relative',
    cursor: 'pointer',
    width: '100%',
    minWidth: 0,
  },
  eventBadge: {
    fontSize: 10,
    background: C.pinkBg,
    color: C.pinkDark,
    padding: '3px 6px',
    borderRadius: 4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: 600,
    width: '100%',
    boxSizing: 'border-box',
  },
  moreText: {
    fontSize: 10,
    color: C.mutedLight,
    textAlign: 'left',
    paddingLeft: 2,
  },
  dateNum: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 4,
    flexShrink: 0,
  },
  popup: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 220,
    background: C.navy,
    color: 'white',
    padding: 12,
    borderRadius: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    zIndex: 100,
    marginBottom: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    pointerEvents: 'none',
    fontFamily: FONT,
    whiteSpace: 'normal',
  },
  popupItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    paddingBottom: 8,
  },
  popupCourse: { fontSize: 10, color: C.pink },
  popupTitle: { fontSize: 13, fontWeight: 600, lineHeight: 1.3 },
  popupTime: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
};

export default Calendar;