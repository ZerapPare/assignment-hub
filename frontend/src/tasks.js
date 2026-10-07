import { C, TH_MONTHS_SHORT } from './theme';

// The task vocabulary both screens share. Two copies would drift the moment a
// status is added.

export const HOUR = 1000 * 60 * 60;
export const URGENT_H = 48;

const pad = (n) => String(n).padStart(2, '0');

export const fmtDate = (d) => `${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]}`;
export const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const STATUS = {
  not_started: { label: 'ยังไม่เริ่ม', color: C.muted, bg: C.lineSoft },
  in_progress: { label: 'กำลังทำ', color: C.blueText, bg: C.blueBg },
  submitted: { label: 'ส่งแล้ว', color: C.amber, bg: C.amberBg },
  completed: { label: 'เสร็จสมบูรณ์', color: C.green, bg: C.greenBg },
};

// Anything the backend hasn't heard of falls back rather than rendering blank.
export const normalizeStatus = (s) => (s in STATUS ? s : 'not_started');

// The order the student picks from, and the order the filter lists.
export const STATUS_OPTIONS = Object.entries(STATUS).map(([value, s]) => ({
  value,
  label: s.label,
}));

// UR26: neither a submitted nor a completed task should still be nagging the
// student, so both drop out of the urgent surfaces.
export const DONE = ['submitted', 'completed'];
export const isDone = (a) => DONE.includes(a.status);

export const PLATFORM_FILTERS = [
  { key: 'all', label: 'ทุกแพลตฟอร์ม' },
  { key: 'classroom', label: 'Google Classroom' },
  { key: 'msteam', label: 'Microsoft Team' },
  { key: 'other', label: 'อื่นๆ' },
];

export const matchesPlatform = (item, platform) => {
  if (platform === 'all') return true;
  const source = String(item.platform_source || '').trim().toLowerCase();
  if (platform === 'classroom') return source.includes('google') || source.includes('classroom');
  if (platform === 'msteam') return source.includes('msteam');
  return platform === 'other'
    && !source.includes('google')
    && !source.includes('classroom')
    && !source.includes('msteam');
};

// API rows carry due_date as a string and may carry a status this build does
// not know; every screen wants them normalised the same way first.
export const withDerived = (assignments) =>
  assignments.map((a) => ({
    ...a,
    status: normalizeStatus(a.status),
    due: a.due_date ? new Date(a.due_date) : null,
  }));

export const isUrgent = (a, now) =>
  !isDone(a) && a.due && a.due - now >= 0 && a.due - now <= URGENT_H * HOUR;
