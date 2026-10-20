import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

// จัดเรียงวันทำงานโดยเริ่มจากวันจันทร์ และใช้ค่าเริ่มต้นเมื่อผู้ใช้ยังไม่ตั้งเวลา
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
const TIME_PRECISION = 5;

const API_WORKING_HOURS = '/api/user/working-hours';
const API_USER_SETTINGS = '/api/user/settings';

// API อาจส่งเวลาที่มีวินาทีมาด้วย แต่ input ของหน้าเว็บใช้เฉพาะ HH:MM
function normalizeTime(value, fallback = null) {
    if (!value || typeof value !== 'string') return fallback;
    return value.slice(0, TIME_PRECISION);
}

// Helper: แปลง String เวลาทุกรูปแบบ ("13:00", "01:00 PM", "00:00") เป็นนาทีรวม (0-1439)
function timeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;

    // เช็ก 24 Hours ("HH:MM")
    const match24 = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
        const h = parseInt(match24[1], 10);
        const m = parseInt(match24[2], 10);
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return h * 60 + m;
    }

    // เช็ก 12 Hours ("HH:MM AM/PM")
    const match12 = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match12) {
        let h = parseInt(match12[1], 10);
        const m = parseInt(match12[2], 10);
        const period = match12[3].toUpperCase();
        if (period === 'PM' && h < 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return h * 60 + m;
    }

    return null;
}

// สร้างค่าเริ่มต้นให้ทุกวันเป็นวันหยุด จนกว่าจะเปิดและกำหนดเวลา
function createInitialWorkingHours() {
    return DAY_ORDER.reduce((acc, day) => {
        acc[day] = null;
        return acc;
    }, {});
}

// แปลงข้อมูลจาก API ให้เป็น map ของวันกับเวลาเริ่มที่ component ใช้งาน
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

// ถ้า API ไม่มีเวลาพัก ให้ปิดสวิตช์แต่คงเวลาเริ่ม/จบเริ่มต้นไว้ใน state
function parseLunchResponse(settings) {
    const lunchStart = normalizeTime(settings?.lunch_start);
    const lunchEnd = normalizeTime(settings?.lunch_end);
    return {
        enabled: Boolean(lunchStart && lunchEnd),
        lunch_start: lunchStart || DEFAULT_LUNCH_START,
        lunch_end: lunchEnd || DEFAULT_LUNCH_END,
    };
}

function isDayEnabled(value) {
    return value !== null && value !== '';
}

export function isValidLunchTimeRange(start, end) {
    if (!start || !end) return true;

    const startMins = timeToMinutes(start);
    const endMins = timeToMinutes(end);

    if (startMins === null || endMins === null) return false;

    // อนุญาตกรณีจบที่เที่ยงคืน (00:00 ให้มองเป็น 1440 นาที)
    const adjustedEndMins = (endMins === 0 && startMins > 0) ? 1440 : endMins;

    return startMins < adjustedEndMins;
}

function isLunchRangeValid(lunch) {
    return !lunch.enabled || isValidLunchTimeRange(lunch.lunch_start, lunch.lunch_end);
}

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

function LunchSetting({ lunch, onChange, onToggle }) {
    const rangeValid = isLunchRangeValid(lunch);
    const isNextDayMidnight = lunch.enabled && lunch.lunch_end === '00:00' && lunch.lunch_start > '00:00';
    const hasInvalidRange = lunch.enabled && !rangeValid;

    const feedbackMessage = hasInvalidRange
        ? 'เวลาเริ่มพักต้องก่อนเวลาสิ้นสุด'
        : isNextDayMidnight
            ? 'เที่ยงคืนวันถัดไป'
            : '\u00A0';

    return (
        <div className="lunch-setting">
            {/* ฝั่งซ้าย: หัวข้อหลัก */}
            <div className="lunch-title">
                พักเที่ยง
                <span>ใช้เวลาเดียวกันทุกวัน</span>
            </div>

            {/* ฝั่งขวา: Controls สวิตช์เปิดปิด + ช่องกรอกเวลา */}
            <div className="lunch-controls">
                {/* กลุ่มสวิตช์ Toggle */}
                <div className="lunch-toggle-group">
                    <label className="switch" aria-label="เปิดเวลาพัก">
                        <input type="checkbox" checked={lunch.enabled} onChange={onToggle} />
                        <span className="slider" />
                    </label>
                    <span className="day-status">{lunch.enabled ? 'มีเวลาพัก' : 'ไม่มีเวลาพัก'}</span>
                </div>

                {/* กลุ่มเลือกเวลา (แสดงเมื่อเปิดใช้งาน) */}
                <div className="lunch-inputs-wrapper">
                    <div className="lunch-inputs">
                        <label>
                            <span>เริ่ม</span>
                            <input
                                type="time"
                                disabled={!lunch.enabled}
                                value={lunch.enabled ? lunch.lunch_start : ''}
                                aria-invalid={hasInvalidRange}
                                onChange={(e) => onChange('lunch_start', e.target.value)}
                            />
                        </label>

                        <span className="time-arrow">→</span>

                        <label>
                            <span>สิ้นสุด</span>
                            <input
                                type="time"
                                disabled={!lunch.enabled}
                                value={lunch.enabled ? lunch.lunch_end : ''}
                                aria-invalid={hasInvalidRange}
                                onChange={(e) => onChange('lunch_end', e.target.value)}
                            />
                        </label>
                    </div>

                    <div
                        className={`lunch-feedback${isNextDayMidnight && !hasInvalidRange ? ' lunch-midnight-feedback' : ''}`}
                        role={hasInvalidRange ? 'alert' : undefined}
                        style={{ visibility: hasInvalidRange || isNextDayMidnight ? 'visible' : 'hidden' }}
                    >
                        {feedbackMessage}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LunchTimeSetting({ onChange }) {
    const [workingHours, setWorkingHours] = useState(createInitialWorkingHours);
    const [lunch, setLunch] = useState({
        enabled: false,
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

        // โหลดวันทำงานและเวลาพักพร้อมกัน; flag ป้องกัน setState หลัง component ถูกถอด
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
        // ส่งค่าการตั้งค่าปัจจุบันให้หน้าหลักใช้ตรวจสอบและบันทึก
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

    const toggleLunch = useCallback(() => {
        setLunch((prev) => ({ ...prev, enabled: !prev.enabled }));
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

            <LunchSetting lunch={lunch} onChange={updateLunch} onToggle={toggleLunch} />
        </div>
    );
}