import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

// Constants
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const DAY_NAMES = {
	0: 'อา.',
	1: 'จ.',
	2: 'อ.',
	3: 'พ.',
	4: 'พฤ.',
	5: 'ศ.',
	6: 'ส.',
};

const DEFAULT_START_TIME = '09:00';
const DEFAULT_LUNCH_START = '12:00';
const DEFAULT_LUNCH_END = '13:00';
const TIME_PRECISION = 5; // ตัด "HH:MM:SS" → "HH:MM"

const API_WORKING_HOURS = '/api/user/working-hours';
const API_USER_SETTINGS = '/api/user/settings';

// Pure helpers
/**
 * ตัด string เวลาให้เหลือ "HH:MM"
 * ใช้ได้ทั้ง "09:00:00" และ "09:00"
 */
function normalizeTime(value, fallback = null) {
	if (!value || typeof value !== 'string') return fallback;
	return value.slice(0, TIME_PRECISION);
}

// สร้าง state เริ่มต้นของ workingHours (ทุกวัน = null)
function createInitialWorkingHours() {
	return DAY_ORDER.reduce((acc, day) => {
		acc[day] = null;
		return acc;
	}, {});
}

// แปลง response จาก /working-hours → { [day]: "HH:MM" | null }
function parseWorkingHoursResponse(raw) {
	const formatted = {};
	for (let day = 0; day < 7; day++) {
		const value = raw?.[day];
		if (typeof value === 'string') {
			formatted[day] = normalizeTime(value);
		} else if (value?.start_time) {
			formatted[day] = normalizeTime(value.start_time);
		} else {
			formatted[day] = null;
		}
	}
	return formatted;
}

// แปลง response จาก /settings → { lunch_start, lunch_end }
function parseLunchResponse(settings) {
	return {
		lunch_start: normalizeTime(settings?.lunch_start, DEFAULT_LUNCH_START),
		lunch_end: normalizeTime(settings?.lunch_end, DEFAULT_LUNCH_END),
	};
}

function isDayEnabled(value) {
	return value !== null && value !== '';
}

// Sub-components
function SectionHeading({ title, description }) {
	return (
		<div className="section-heading">
			<div>
				<h2>{title}</h2>
				<p>{description}</p>
			</div>
		</div>
	);
}

function DayRow({ day, time, onToggle, onTimeChange }) {
	const enabled = isDayEnabled(time);

	return (
		<div className={`day-row${enabled ? ' day-enabled' : ''}`}>
			<div className="day-name">{DAY_NAMES[day]}</div>

			<label className="switch">
				<input type="checkbox" checked={enabled} onChange={() => onToggle(day)} />
				<span className="slider" />
			</label>

			<span className="day-status">{enabled ? 'ทำงาน' : 'หยุด'}</span>

			<input
				className="time-input"
				type="time"
				disabled={!enabled}
				value={enabled ? time : ''}
				onChange={(e) => onTimeChange(day, e.target.value)}
			/>
		</div>
	);
}

function LunchSetting({ lunch, onChange }) {
	return (
		<div className="lunch-setting">
			<div className="lunch-title">
				พักเที่ยง
				<span>ใช้เวลาเดียวกันทุกวัน</span>
			</div>

			<div className="lunch-inputs">
				<label>
					<span>เริ่ม</span>
					<input
						type="time"
						value={lunch.lunch_start}
						onChange={(e) => onChange('lunch_start', e.target.value)}
					/>
				</label>

				<span className="time-arrow">→</span>

				<label>
					<span>สิ้นสุด</span>
					<input
						type="time"
						value={lunch.lunch_end}
						onChange={(e) => onChange('lunch_end', e.target.value)}
					/>
				</label>
			</div>
		</div>
	);
}

// Main component
export default function LunchTimeSetting({ onChange }) {
	const [workingHours, setWorkingHours] = useState(createInitialWorkingHours);
	const [lunch, setLunch] = useState({
		lunch_start: DEFAULT_LUNCH_START,
		lunch_end: DEFAULT_LUNCH_END,
	});
	const [loading, setLoading] = useState(true);

	const onChangeRef = useRef(onChange);

	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

	useEffect(() => {
		let cancelled = false;

		async function loadData() {
			try {
				const [whRes, settingsRes] = await Promise.all([
					axios.get(API_WORKING_HOURS),
					axios.get(API_USER_SETTINGS),
				]);

				if (cancelled) return;

				setWorkingHours(parseWorkingHoursResponse(whRes.data));
				setLunch(parseLunchResponse(settingsRes.data));
			} catch (err) {
				console.error('Load failed:', err);
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		loadData();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (loading) return;
		onChangeRef.current?.({ workingHours, lunch });
	}, [workingHours, lunch, loading]);

	const toggleDay = useCallback((day) => {
		setWorkingHours((prev) => ({
			...prev,
			[day]: prev[day] ? null : DEFAULT_START_TIME,
		}));
	}, []);

	const setDayTime = useCallback((day, value) => {
		setWorkingHours((prev) => ({ ...prev, [day]: value }));
	}, []);

	const updateLunch = useCallback((field, value) => {
		setLunch((prev) => ({ ...prev, [field]: value }));
	}, []);

	if (loading) {
		return <div className="setting-loading">กำลังโหลดการตั้งค่า...</div>;
	}

	return (
		<div className="time-setting">
			<SectionHeading
				title="เวลาที่สามารถทำงานได้"
				description="กำหนดวันที่สามารถจัดงานและเวลาเริ่มต้น ระบบจะจัดงานในวันนั้นจนถึง 23:59"
			/>

			<div className="working-days">
				{DAY_ORDER.map((day) => (
					<DayRow
						key={day}
						day={day}
						time={workingHours[day]}
						onToggle={toggleDay}
						onTimeChange={setDayTime}
					/>
				))}
			</div>

			<LunchSetting lunch={lunch} onChange={updateLunch} />
		</div>
	);
}