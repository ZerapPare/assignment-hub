import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarIcon } from "../icons";

// Constants
const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_DURATION = { hours: 1, minutes: 0 };
const MINUTES_PER_HOUR = 60;
const MAX_DURATION_HOURS = 168;
const MAX_DURATION_MINUTES = MAX_DURATION_HOURS * MINUTES_PER_HOUR;

// Pure helpers
// งานบางแหล่งใช้ assignment_id ขณะที่ข้อมูลเดิมอาจใช้ id
function getTaskId(task) {
  return task.assignment_id ?? task.id;
}

function minutesToDuration(totalMinutes) {
  return {
    hours: Math.floor(totalMinutes / MINUTES_PER_HOUR),
    minutes: totalMinutes % MINUTES_PER_HOUR,
  };
}

function durationToMinutes(duration) {
  return (duration?.hours || 0) * MINUTES_PER_HOUR + (duration?.minutes || 0);
}

function sortByDueDate(tasks) {
  return [...tasks].sort((a, b) => {
    const aDue = a.due_date ? new Date(a.due_date).getTime() : null;
    const bDue = b.due_date ? new Date(b.due_date).getTime() : null;
    if (aDue === null && bDue === null) return 0;
    if (aDue === null) return 1;
    if (bDue === null) return -1;
    return aDue - bDue;
  });
}

function formatDateTime(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleString("th-TH");
}

function TimeInput({ value, onChange, unit, invalid }) {
  const handleChange = (e) => {
    // รับเฉพาะตัวเลขและตัดศูนย์นำหน้า ก่อนเก็บค่าเป็นจำนวนเต็ม
    const digitsOnly = e.target.value.replace(/\D/g, "");
    const normalizedValue = digitsOnly.replace(/^0+(?=\d)/, "");
    const num = Math.max(0, parseInt(normalizedValue, 10) || 0);
    onChange(num);
  };

  return (
    <div className="time-input-group">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={handleChange}
        style={
          invalid
            ? {
                border: "2px solid #ef4444",
                background: "#fef2f2",
                outline: "none",
              }
            : undefined
        }
      />
      <span>{unit}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-task">
      <div className="empty-icon">📭</div>
      <div>ยังไม่มีงานที่ต้องจัดตาราง</div>
    </div>
  );
}

function TaskHeader({ count }) {
  return (
    <div className="task-header">
      <div className="section-heading">
        <div>
          <h2>
            รายการงาน
            <span className="task-count">{count}</span>
          </h2>
          <p>กำหนดเวลาที่คาดว่าจะใช้ทำแต่ละงาน</p>
        </div>
      </div>
    </div>
  );
}

function TaskItem({ task, duration, onTimeChange }) {
  const hasDeadline = Boolean(task.due_date);
  const taskId = getTaskId(task);

  const totalMinutes = durationToMinutes(duration);
  const isInvalid = totalMinutes <= 0;
  const isOverLimit = totalMinutes > MAX_DURATION_MINUTES;
  const hoursOverLimit = duration.hours > MAX_DURATION_HOURS;
  const minutesOverLimit =
    duration.hours === MAX_DURATION_HOURS && duration.minutes > 0;

  return (
    <div className="task-item">
      <div className="task-info">
        <div className="task-title">
          {task.title}
          {!hasDeadline && <span className="no-deadline">ไม่มี deadline</span>}
        </div>

        <div className="task-meta">
          {task.start_time && <span>{formatDateTime(task.start_time)}</span>}
          {task.due_date && (
            <span className="deadline">
              <CalendarIcon size={14} />
              Deadline: {formatDateTime(task.due_date)}
            </span>
          )}
        </div>
      </div>

      <div className="duration-control">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <TimeInput
            value={duration.hours}
            onChange={(v) => onTimeChange(taskId, "hours", v)}
            unit="ชม."
            invalid={isInvalid || hoursOverLimit}
          />
          <TimeInput
            value={duration.minutes}
            onChange={(v) => onTimeChange(taskId, "minutes", v)}
            unit="นาที"
            invalid={isInvalid || minutesOverLimit}
          />
        </div>

        {/* จองพื้นที่ไว้เสมอ — ไม่ให้ layout ขยับ */}
        <div
          style={{
            fontSize: 11,
            color: "#ef4444",
            fontWeight: 600,
            marginTop: 4,
            textAlign: "right",
            minHeight: 14,
            visibility: isInvalid || isOverLimit ? "visible" : "hidden",
          }}
        >
          {isInvalid
            ? "ระยะเวลาต้องมากกว่า 0 นาที"
            : isOverLimit
              ? "ระยะเวลางานต้องไม่เกิน 168 ชั่วโมง"
              : "\u00A0"}
        </div>
      </div>
    </div>
  );
}

// Main component
export default function TaskList({
  assignments = [],
  onDurationsChange,
  onValidityChange,
  onSave: _onSave,
  saving: _saving,
  saved: _saved,
  onAutoSchedule: _onAutoSchedule,
}) {
  const safeTasks = useMemo(
    () => (Array.isArray(assignments) ? assignments : []),
    [assignments],
  );

  const [durations, setDurations] = useState({});
  const onDurationsChangeRef = useRef(onDurationsChange);
  const onValidityChangeRef = useRef(onValidityChange);

  useEffect(() => {
    onDurationsChangeRef.current = onDurationsChange;
    onValidityChangeRef.current = onValidityChange;
  }, [onDurationsChange, onValidityChange]);

  // แจ้ง parent ทุกครั้งที่ durations เปลี่ยน
  useEffect(() => {
    // ส่งค่าชั่วโมง/นาทีให้หน้าหลัก เพื่อใช้บันทึกก่อนเริ่มจัดตาราง
    onDurationsChangeRef.current?.(durations);
  }, [durations]);

  useEffect(() => {
    // รวมรายการที่เวลาเป็นศูนย์หรือเกินเพดาน เพื่อปิดปุ่มจัดตารางและแสดงคำเตือน
    const invalidTasks = [];
    const overLimitTasks = [];
    safeTasks.forEach((t) => {
      const d = durations[getTaskId(t)];
      if (!d) return;
      const totalMinutes = durationToMinutes(d);
      if (totalMinutes <= 0) invalidTasks.push(t.title);
      if (totalMinutes > MAX_DURATION_MINUTES) overLimitTasks.push(t.title);
    });

    onValidityChangeRef.current?.({
      hasInvalid: invalidTasks.length > 0,
      invalidTasks,
      hasOverLimit: overLimitTasks.length > 0,
      overLimitTasks,
    });
  }, [durations, safeTasks]);

  // Reset durations เมื่อ assignments เปลี่ยน
  useEffect(() => {
    // แปลงค่าจากฐานข้อมูลเป็นชั่วโมง/นาที; งานใหม่ที่ไม่มีค่าจะเริ่มที่ 1 ชั่วโมง
    const initial = {};
    safeTasks.forEach((task) => {
      const total = task.time_estimate ?? DEFAULT_DURATION_MINUTES;
      initial[getTaskId(task)] = minutesToDuration(total);
    });
    setDurations(initial);
  }, [safeTasks]);

  const sortedTasks = useMemo(() => sortByDueDate(safeTasks), [safeTasks]);

  const updateTime = useCallback((id, field, value) => {
    setDurations((prev) => {
      const current = prev[id] ?? DEFAULT_DURATION;
      return {
        ...prev,
        [id]: { ...current, [field]: value },
      };
    });
  }, []);

  if (safeTasks.length === 0) {
    return (
      <div className="task-list">
        <div className="section-heading">
          <div>
            <h2>รายการงาน</h2>
            <p>กำหนดเวลาที่คาดว่าจะใช้ทำแต่ละงาน</p>
          </div>
        </div>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="task-list">
      <TaskHeader count={safeTasks.length} />

      <div className="task-items">
        {sortedTasks.map((task) => {
          const id = getTaskId(task);
          return (
            <TaskItem
              key={id}
              task={task}
              duration={durations[id] ?? DEFAULT_DURATION}
              onTimeChange={updateTime}
            />
          );
        })}
      </div>
    </div>
  );
}
