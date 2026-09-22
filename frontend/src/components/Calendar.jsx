import React, { useEffect, useRef, useState } from 'react';
import { C, FONT, WEEKDAYS, TH_MONTHS } from '../theme';

function CalendarEvent({ event, onClick }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{ ...styles.eventWrap, zIndex: isHovered ? 100 : 1 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        onClick={() => onClick?.(event)}
        style={styles.eventBadge}
      >
        {event.title}
      </button>

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

function CalendarCell({ n, isToday, events, onEventClick, alignPopoverRight }) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const cellRef = useRef(null);

  useEffect(() => {
    if (!isPopoverOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!cellRef.current?.contains(event.target)) setIsPopoverOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsPopoverOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isPopoverOpen]);

  if (n == null) {
    return <div style={{ ...styles.cell, background: C.pageBg }} />;
  }

  const visibleEvents = events.slice(0, 2);

  return (
    <div ref={cellRef} style={{ ...styles.cell, background: 'white' }}>
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
        {visibleEvents.map((a) => (
          <CalendarEvent
            key={a.assignment_id}
            event={a}
            onClick={onEventClick}
          />
        ))}
        {events.length > 2 && (
          <button
            type="button"
            style={styles.moreButton}
            aria-expanded={isPopoverOpen}
            onClick={() => setIsPopoverOpen(true)}
          >
            ดูเพิ่มอีก {events.length - 2} งาน
          </button>
        )}
      </div>

      {isPopoverOpen && (
        <div
          role="dialog"
          aria-label={`งานทั้งหมดวันที่ ${n}`}
          style={{
            ...styles.eventPopover,
            ...(alignPopoverRight ? { right: 0 } : { left: 0 }),
          }}
        >
          <div style={styles.popoverHeader}>
            <span>งานวันที่ {n}</span>
            <button
              type="button"
              style={styles.closePopoverButton}
              onClick={() => setIsPopoverOpen(false)}
              aria-label="ปิดรายการงาน"
            >
              ×
            </button>
          </div>
          <div style={styles.popoverEvents}>
            {events.map((event) => (
              <CalendarEvent
                key={event.assignment_id}
                event={event}
                onClick={onEventClick}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Calendar({
  year,
  month,
  today,
  eventsByDate = new Map(),
  view = 'month',
  weekDays = [],
  onPrev,
  onNext,
  onEventClick,
}) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const title = view === 'week' && weekDays.length
    ? `${weekDays[0].date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} – ${weekDays[6].date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : `${TH_MONTHS[month]} ${year + 543}`;

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let n = 1; n <= daysInMonth; n++) cells.push(n);

  return (
    <div>
      <div style={styles.header}>
        <span style={styles.title}>{title}</span>
        <div style={styles.navWrap}>
          <button type="button" onClick={onPrev} style={styles.navBtn} aria-label="เดือนก่อนหน้า">
            ‹
          </button>
          <button type="button" onClick={onNext} style={styles.navBtn} aria-label="เดือนถัดไป">
            ›
          </button>
        </div>
      </div>

      {view === 'month' ? (
        <div style={styles.grid}>
          {WEEKDAYS.map((w) => (
            <div key={w} style={styles.weekday}>
              {w}
            </div>
          ))}

          {cells.map((n, i) => (
            <CalendarCell
              key={`${year}-${month}-${i}`}
              n={n}
              isToday={n != null && n === today}
              events={n != null ? eventsByDate.get(n) || [] : []}
              onEventClick={onEventClick}
              alignPopoverRight={i % 7 >= 5}
            />
          ))}
        </div>
      ) : (
        <div style={styles.weekGrid}>
          {weekDays.map(({ date, events }) => (
            <div key={date.toISOString()} style={styles.weekCell}>
              <div style={styles.weekDate}>
                {date.toLocaleDateString('th-TH', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </div>

              <div style={styles.eventContainer}>
                {events.map((event) => (
                  <CalendarEvent
                    key={event.assignment_id}
                    event={event}
                    onClick={onEventClick}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
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
    borderRadius: 12,
    overflow: 'visible',
  },
  weekGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: 1,
    background: C.line,
    border: `1px solid ${C.line}`,
    borderRadius: 12,
    overflow: 'visible',
  },
  weekCell: {
    background: 'white',
    minHeight: 180,
    padding: 8,
    minWidth: 0,
    borderRadius: 8,
  },
  weekDate: {
    fontSize: 13,
    fontWeight: 700,
    color: C.navy,
    marginBottom: 8,
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
    height: 142,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    padding: '6px 6px 2px',
    boxSizing: 'border-box',
    minWidth: 0,
    borderRadius: 8,
    position: 'relative',
  },
  eventContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginTop: 4,
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
    cursor: 'pointer',
    padding: '3px 6px',
    border: 'none',
    borderRadius: 4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textAlign: 'left',
    textOverflow: 'ellipsis',
    fontWeight: 600,
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  moreText: {
    fontSize: 10,
    color: C.mutedLight,
    textAlign: 'left',
    paddingLeft: 2,
  },
  moreButton: {
    fontSize: 10,
    color: C.pinkDark,
    textAlign: 'left',
    padding: '4px 6px',
    border: `1px solid ${C.pink}`,
    borderRadius: 4,
    background: 'white',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 600,
    width: '100%',
  },
  eventPopover: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    zIndex: 200,
    width: 250,
    maxHeight: 280,
    overflowY: 'auto',
    padding: 10,
    borderRadius: 10,
    border: `1px solid ${C.line}`,
    background: 'white',
    boxShadow: '0 10px 28px rgba(15, 23, 42, 0.18)',
    boxSizing: 'border-box',
  },
  popoverHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    color: C.navy,
    fontSize: 12,
    fontWeight: 700,
  },
  closePopoverButton: {
    width: 24,
    height: 24,
    border: 'none',
    borderRadius: 6,
    background: C.pageBg,
    color: C.muted,
    cursor: 'pointer',
    fontSize: 18,
    lineHeight: 1,
  },
  popoverEvents: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
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
