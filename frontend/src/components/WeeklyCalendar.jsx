import { useMemo, useState, useEffect, useCallback } from 'react';
import './WeeklyCalendar.css';

// Constants
const DAY_NAMES = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];

const HOURS_PER_DAY = 24;
const MINUTES_PER_DAY = HOURS_PER_DAY * 60;
const DAYS_PER_WEEK = 7;
const NOW_REFRESH_MS = 60_000;

const HOUR_WIDTH = 110;
const HALF_HOUR_WIDTH = HOUR_WIDTH / 2;
const DAY_WIDTH = HOURS_PER_DAY * HOUR_WIDTH;
const MIN_TASK_WIDTH = 35;

const TOOLTIP_WIDTH = 280;
const TOOLTIP_HEIGHT = 180;
const TOOLTIP_GAP = 10;
const VIEWPORT_MARGIN = 10;

const DONE_STATUSES = new Set(['submitted', 'completed']);
const DEFAULT_DURATION_MINUTES = 60;

// Date / Time utilities
const THAILAND_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatTime(hour, minute) {
  return `${pad2(hour)}:${pad2(minute)}`;
}

function getThailandParts(date) {
  const parts = THAILAND_FORMATTER.formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

function getDateKey(date) {
  const { year, month, day } = getThailandParts(date);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function minutesToPixels(minutes) {
  return (minutes / MINUTES_PER_DAY) * DAY_WIDTH;
}

function buildWeek(startDate) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: DAYS_PER_WEEK }, (_, i) => addDays(start, i));
}

// Formatting utilities
function formatThaiDateTime(isoString) {
  if (!isoString) return '-';
  return (
    new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoString)) + ' น.'
  );
}

function formatDuration(minutes) {
  const total = Math.round(minutes);
  if (total <= 0) return '-';
  if (total < 60) return `${total} นาที`;

  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  return remainder > 0 ? `${hours} ชม. ${remainder} นาที` : `${hours} ชม.`;
}

// Task processing
function getTaskId(task) {
  return task.assignment_id ?? task.id;
}

function splitTaskByDay(task) {
  if (Array.isArray(task.segments)) {
    return task.segments.map((segment) => {
      const start = new Date(segment.start);
      const end = new Date(segment.end);
      const startParts = getThailandParts(start);
      const endParts = getThailandParts(end);
      return {
        ...task,
        _originalTaskId: getTaskId(task),
        dayKey: getDateKey(start),
        startHour: startParts.hour,
        startMinute: startParts.minute,
        endHour: endParts.hour,
        endMinute: endParts.minute,
        duration: (end - start) / 60_000,
      };
    });
  }

  if (!task?.start_time) return [];

  const start = new Date(task.start_time);
  const duration = Number(task.duration_minutes) || DEFAULT_DURATION_MINUTES;
  const end = task.end_time
    ? new Date(task.end_time)
    : new Date(start.getTime() + duration * 60_000);

  const result = [];
  let current = new Date(start);

  while (current < end) {
    const parts = getThailandParts(current);
    // แปลงเที่ยงคืนถัดไป (เวลาไทย) กลับเป็น UTC
    const nextDayUtc = new Date(
      Date.UTC(parts.year, parts.month - 1, parts.day + 1) - 7 * 3_600_000
    );
    const segmentEnd = end < nextDayUtc ? end : nextDayUtc;
    const segmentMinutes = (segmentEnd - current) / 60_000;

    if (segmentMinutes > 0) {
      result.push({
        ...task,
        _originalTaskId: getTaskId(task),
        dayKey: getDateKey(current),
        startHour: parts.hour,
        startMinute: parts.minute,
        duration: segmentMinutes,
      });
    }
    current = nextDayUtc;
  }

  return result;
}

function createDeadlineSegment(task) {
  if (!task?.due_date || DONE_STATUSES.has(task.status)) return null;

  const due = new Date(task.due_date);
  const parts = getThailandParts(due);

  return {
    ...task,
    isDeadline: true,
    _originalTaskId: getTaskId(task),
    dayKey: getDateKey(due),
    startHour: parts.hour,
    startMinute: parts.minute,
    endHour: parts.hour,
    endMinute: parts.minute,
    duration: 0,
  };
}

function groupTasksByDay(tasks, days) {
  const map = {};
  days.forEach((day) => {
    map[getDateKey(day)] = [];
  });

  tasks.forEach((task) => {
    splitTaskByDay(task).forEach((segment) => {
      if (map[segment.dayKey]) map[segment.dayKey].push(segment);
    });

    const deadline = createDeadlineSegment(task);
    if (deadline && map[deadline.dayKey]) map[deadline.dayKey].push(deadline);
  });

  return map;
}

// Tooltip positioning
function computeTooltipPosition(rect, preferBelow) {
  // จัดให้อยู่กึ่งกลางแนวตั้งของ element แล้ว clamp ให้อยู่ใน viewport
  let left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
  left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(left, window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN)
  );

  const aboveTop = rect.top - TOOLTIP_HEIGHT - TOOLTIP_GAP;
  const belowTop = rect.bottom + TOOLTIP_GAP;

  let top = preferBelow ? belowTop : aboveTop;

  const overflowsBottom = top + TOOLTIP_HEIGHT > window.innerHeight - VIEWPORT_MARGIN;
  const overflowsTop = top < VIEWPORT_MARGIN;

  if (preferBelow && overflowsBottom) top = aboveTop;
  else if (!preferBelow && overflowsTop) top = belowTop;

  return { top, left };
}

// Sub-components
function CalendarHeader() {
  return (
    <div className="cal-header">
      <div className="cal-corner">วัน / เวลา</div>
      <div className="cal-times" style={{ width: DAY_WIDTH }}>
        {Array.from({ length: HOURS_PER_DAY }, (_, hour) => (
          <div
            key={hour}
            className="cal-time-head"
            style={{ left: hour * HOUR_WIDTH }}
          >
            {pad2(hour)}:00
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskBlock({ task, onSelect, onHover, onLeave }) {
  const startMinutes = task.startHour * 60 + task.startMinute;
  const left = minutesToPixels(startMinutes);
  const width = Math.max(minutesToPixels(task.duration), MIN_TASK_WIDTH);
  const isHighPriority = Number(task.priority_score) > 0;

  return (
    <div
      className="task-wrapper"
      style={{ left, width }}
      onClick={() => onSelect(task)}
      onMouseEnter={(e) =>
        onHover(task, e.currentTarget.getBoundingClientRect(), false)
      }
      onMouseLeave={onLeave}
    >
      <div className={`task-block${isHighPriority ? ' high' : ''}`}>
        {task.title}
      </div>
    </div>
  );
}

function DeadlineMarker({ task, onSelect, onHover, onLeave }) {
  const startMinutes = task.startHour * 60 + task.startMinute;
  const left = minutesToPixels(startMinutes);

  return (
    <div
      className="deadline-marker"
      style={{ left }}
      onClick={() => onSelect(task)}
      onMouseEnter={(e) =>
        onHover(task, e.currentTarget.getBoundingClientRect(), true)
      }
      onMouseLeave={onLeave}
    >
      <div className="deadline-line" />
      <div className="deadline-badge">
        {formatTime(task.startHour, task.startMinute)}
      </div>
    </div>
  );
}

function DayRow({ day, dayIndex, tasks, nowInfo, onSelect, onHover, onLeave }) {
  const dayKey = getDateKey(day);
  const isToday = dayKey === nowInfo.dayKey;

  return (
    <div className="cal-row">
      <div className="cal-day">
        <span className="day-name">{DAY_NAMES[dayIndex]}</span>
        <span className="day-date">
          {day.getDate()}/{day.getMonth() + 1}
        </span>
      </div>

      <div className="cal-timeline" style={{ width: DAY_WIDTH }}>
        {Array.from({ length: HOURS_PER_DAY * 2 }, (_, i) => (
          <div
            key={i}
            className="timeline-line"
            style={{ left: i * HALF_HOUR_WIDTH }}
          />
        ))}

        {isToday && (
          <div
            className="now-line"
            style={{ left: nowInfo.left }}
            title={`เวลาปัจจุบัน ${formatTime(nowInfo.hour, nowInfo.minute)}`}
          >
            <div className="now-line-dot" />
          </div>
        )}

        {tasks.map((task, index) => {
          const key = `${getTaskId(task)}-${task.dayKey}-${index}-${
            task.isDeadline ? 'due' : 'task'
          }`;
          const Marker = task.isDeadline ? DeadlineMarker : TaskBlock;
          return (
            <Marker
              key={key}
              task={task}
              onSelect={onSelect}
              onHover={onHover}
              onLeave={onLeave}
            />
          );
        })}
      </div>
    </div>
  );
}

function TooltipRow({ label, value }) {
  return (
    <div className="tooltip-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function TaskTooltip({ task, position }) {
  return (
    <div
      className="task-tooltip"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div className="tooltip-title">{task.title}</div>
      <div className="tooltip-course">{task.course_name}</div>
      <div className="tooltip-divider" />

      <TooltipRow
        label="เวลาเริ่มต้น"
        value={formatTime(task.startHour, task.startMinute)}
      />
      <TooltipRow label="ระยะเวลา" value={formatDuration(task.duration)} />
      <TooltipRow label="กำหนดส่ง" value={formatThaiDateTime(task.due_date)} />
      <TooltipRow label="สถานะ" value={task.status} />
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <strong>{label}:</strong>
      <span>{value}</span>
    </div>
  );
}

function TaskDetailModal({ task, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{task.title}</h2>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <DetailRow label="คอร์สเรียน" value={task.course_name || '-'} />
          <DetailRow
            label="เวลาเริ่มต้น"
            value={`${formatTime(task.startHour, task.startMinute)} น.`}
          />
          <DetailRow label="ระยะเวลา" value={formatDuration(task.duration)} />
          <DetailRow label="กำหนดส่ง" value={formatThaiDateTime(task.due_date)} />
          <DetailRow label="แหล่งที่มา" value={task.platform_source || '-'} />
          <DetailRow label="สถานะ" value={task.status || '-'} />

          {task.description && (
            <div className="detail-row description">
              <strong>รายละเอียด:</strong>
              <p>{task.description}</p>
            </div>
          )}
        </div>

        {task.origin_link && (
          <div className="modal-footer">
            <a
              href={task.origin_link}
              target="_blank"
              rel="noopener noreferrer"
              className="origin-link-btn"
            >
              ไปยังหน้างานหลัก ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// Main component
export default function WeeklyCalendar({ tasks = [], weekStart = new Date() }) {
  const [hoveredTask, setHoveredTask] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [selectedTask, setSelectedTask] = useState(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), NOW_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const nowInfo = useMemo(() => {
    const parts = getThailandParts(now);
    return {
      dayKey: getDateKey(now),
      left: minutesToPixels(parts.hour * 60 + parts.minute),
      hour: parts.hour,
      minute: parts.minute,
    };
  }, [now]);

  const safeTasks = useMemo(
    () => (Array.isArray(tasks) ? tasks : []),
    [tasks]
  );
  const days = useMemo(() => buildWeek(weekStart), [weekStart]);
  const tasksByDay = useMemo(
    () => groupTasksByDay(safeTasks, days),
    [safeTasks, days]
  );

  const showTooltip = useCallback((task, rect, preferBelow) => {
    setTooltipPosition(computeTooltipPosition(rect, preferBelow));
    setHoveredTask(task);
  }, []);

  const hideTooltip = useCallback(() => setHoveredTask(null), []);
  const closeModal = useCallback(() => setSelectedTask(null), []);

  return (
    <div className="weekly-calendar">
      <CalendarHeader />

      <div className="cal-body">
        {days.map((day, dayIndex) => (
          <DayRow
            key={getDateKey(day)}
            day={day}
            dayIndex={dayIndex}
            tasks={tasksByDay[getDateKey(day)] || []}
            nowInfo={nowInfo}
            onSelect={setSelectedTask}
            onHover={showTooltip}
            onLeave={hideTooltip}
          />
        ))}
      </div>

      {hoveredTask && (
        <TaskTooltip task={hoveredTask} position={tooltipPosition} />
      )}

      {selectedTask && (
        <TaskDetailModal task={selectedTask} onClose={closeModal} />
      )}
    </div>
  );
}