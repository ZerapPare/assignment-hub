// Shared design tokens. Everything visual should read from here so the two
// pages stay in one design language (before this, Login used hex and Home
// used oklch, which drifted apart).

export const C = {
  navy: '#1e3a5f',
  navyDark: '#14283f',
  navyMid: '#2f5a8a',

  pink: '#ec4899',
  pinkDark: '#db2777',
  pinkSoft: '#f9a8d4',
  pinkBg: '#fce7f3',

  blue: '#d7ecfa',
  blueBg: '#dbeafe',
  blueMid: '#7fb8dd',
  blueText: '#2563eb',
  indigoBg: '#eef2ff',

  green: '#16a34a',
  greenBg: '#dcfce7',

  pageBg: '#f5f6fa',
  loginBg: '#f7f8fa',
  card: '#ffffff',

  ink: '#1a1f36',
  inkAlt: '#141417',
  body: '#374151',

  muted: '#6b7280',
  mutedSoft: '#8a8a94',
  mutedLight: '#9ca3af',
  mutedFaint: '#a0a0aa',

  line: '#eef0f4',
  lineSoft: '#f1f2f6',
  lineInput: '#e4e1ea',
  lineBtn: '#ececf1',
  lineBtnHover: '#c7d6e5',
  checkbox: '#cbd5e1',
};

export const FONT = "'Maitree', sans-serif";

export const R = {
  card: 8,
  pill: 6,
  sso: 999,
  loginCard: 24,
  panelCard: 20,
};

export const SHADOW = {
  loginCard: '0 30px 80px -20px rgba(30,58,95,0.18)',
  previewCard: '0 20px 50px -10px rgba(20,40,63,0.35)',
  primaryBtn: '0 8px 20px -8px rgba(30,58,95,0.4)',
  ssoHover: '0 4px 14px -4px rgba(30,58,95,0.18)',
};

// Sunday-first, matching Date#getDay(). The old MiniCalendar had พ/พฤ
// swapped here, which shifted every weekday label by one.
export const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export const TH_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

export const TH_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];
