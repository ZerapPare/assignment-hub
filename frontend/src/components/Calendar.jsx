import React, { useState } from 'react';
import { C, FONT, WEEKDAYS, TH_MONTHS } from '../theme';

// Component ย่อยสำหรับแต่ละช่องวันที่ เพื่อจัดการ State การ Hover
function CalendarCell({ n, isToday, events }) {
  const [isHovered, setIsHovered] = useState(false);

  if (n == null) {
    return <div style={{ ...styles.cell, background: C.pageBg }} />;
  }

  return (
    <div
      style={{ ...styles.cell, background: 'white' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
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

      {/* แถบชื่องานในปฏิทิน */}
      <div style={styles.eventContainer}>
        {events.slice(0, 2).map((a) => (
          <div key={a.assignment_id} style={styles.eventBadge}>
            {a.title}
          </div>
        ))}
        {events.length > 2 && (
          <div style={styles.moreText}>+ อีก {events.length - 2} งาน</div>
        )}
      </div>

      {/* Popup Details (จะโชว์ก็ต่อเมื่อ Hover และมีงาน) */}
      {isHovered && events.length > 0 && (
        <div style={styles.popup}>
          {events.map((a) => (
            <div key={a.assignment_id} style={styles.popupItem}>
              <div style={styles.popupCourse}>{a.course_name || 'ไม่มีรายวิชา'}</div>
              <div style={styles.popupTitle}>{a.title}</div>
              <div style={styles.popupTime}>
                กำหนดส่ง: {a.due ? `${String(a.due.getHours()).padStart(2, '0')}:${String(a.due.getMinutes()).padStart(2, '0')} น.` : '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Component หลัก
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
  title: { fontFamily: FONT, fontWeight: 700, fontSize: 18, color: 'white' },
  navWrap: { display: 'flex', gap: 8 },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: 'none',
    background: 'rgba(255,255,255,0.2)',
    color: 'white',
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
    overflow: 'hidden'
  },
  weekday: { 
    fontSize: 13, 
    color: '#6b8aa8', 
    textAlign: 'center', 
    fontWeight: 600,
    background: 'white',
    padding: '12px 0'
  },
  cell: {
    minHeight: 110,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    padding: 6,
    position: 'relative', 
  },
  dateNum: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    borderRadius: '50%',
    fontSize: 13,
    marginBottom: 4,
  },
  eventContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginTop: 'auto', 
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
  },
  moreText: {
    fontSize: 10,
    color: C.mutedLight,
    textAlign: 'left',
    paddingLeft: 2,
  },
  // -- Popup Styles --
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
    zIndex: 50,
    marginBottom: 8, // เว้นระยะห่างจากตัวกล่องวันที่
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    pointerEvents: 'none', // ป้องกันเมาส์กระตุกเวลาไปโดน Popup
    fontFamily: FONT,
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