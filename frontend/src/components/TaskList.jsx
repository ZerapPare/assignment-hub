import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarIcon } from '../icons';

// Constants
const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_DURATION = { hours: 1, minutes: 0 };
const MINUTES_PER_HOUR = 60;
const HOURS_MAX = 23;
const MINUTES_MAX = 59;
const MINUTES_STEP = 5;

// Pure helpers
function getTaskId(task) {
	// fallback เผื่อ assignment_id หาย จะได้ไม่ซ้ำกัน
	return task.assignment_id ?? task.id;
}

function minutesToDuration(totalMinutes) {
	return {
		hours: Math.floor(totalMinutes / MINUTES_PER_HOUR),
		minutes: totalMinutes % MINUTES_PER_HOUR,
	};
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
	if (!isoString) return '';
	return new Date(isoString).toLocaleString('th-TH');
}

// Sub-components
function TimeInput({ value, onChange, min, max, step, unit }) {
	const handleChange = (e) => {
		const num = Math.max(0, parseInt(e.target.value, 10) || 0);
		onChange(num);
	};

	return (
		<div className="time-input-group">
			<input
				type="number"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={handleChange}
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

	return (
		<div className="task-item">
			<div className="task-info">
				<div className="task-title">
					{task.title}
					{!hasDeadline && (
						<span className="no-deadline">ไม่มี deadline</span>
					)}
				</div>

				<div className="task-meta">
					{task.start_time && (
						<span>{formatDateTime(task.start_time)}</span>
					)}

					{task.due_date && (
						<span className="deadline">
							<CalendarIcon size={14} />
							Deadline: {formatDateTime(task.due_date)}
						</span>
					)}
				</div>
			</div>

			<div className="duration-control">
				<TimeInput
					value={duration.hours}
					onChange={(v) => onTimeChange(taskId, 'hours', v)}
					min={0}
					max={HOURS_MAX}
					unit="ชม."
				/>
				<TimeInput
					value={duration.minutes}
					onChange={(v) => onTimeChange(taskId, 'minutes', v)}
					min={0}
					max={MINUTES_MAX}
					step={MINUTES_STEP}
					unit="นาที"
				/>
			</div>
		</div>
	);
}

// Main component
export default function TaskList({
	assignments = [],
	onDurationsChange,
	// reserved — ยังไม่ถูกใช้ใน component นี้ แต่คงไว้ตาม public API
	onSave: _onSave,
	saving: _saving,
	saved: _saved,
	onAutoSchedule: _onAutoSchedule,
}) {
	const safeTasks = useMemo(
		() => (Array.isArray(assignments) ? assignments : []),
		[assignments]
	);

	const [durations, setDurations] = useState({});

	const onDurationsChangeRef = useRef(onDurationsChange);

	useEffect(() => {
		onDurationsChangeRef.current = onDurationsChange;
	}, [onDurationsChange]);

	useEffect(() => {
		onDurationsChangeRef.current?.(durations);
	}, [durations]);

	// Reset durations เมื่อ assignments เปลี่ยน
	useEffect(() => {
		const initial = {};
		safeTasks.forEach((task) => {
			const total = task.time_estimate || DEFAULT_DURATION_MINUTES;
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