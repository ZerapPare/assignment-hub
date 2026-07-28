import React from 'react';

function Svg({ size = 16, color = 'currentColor', width, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={width || 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      {...rest}
    >
      {children}
    </svg>
  );
}

export function DocIcon({ size = 22, color = '#1e3a5f' }) {
  return (
    <Svg size={size} color={color} width={1.8}>
      <path d="M6 10V2h9l3 3v17H6v-4" />
      <path d="M15 2v3h3" />
      <rect x="2" y="9" width="8" height="6" rx="0.5" />
      <path d="M5 10.5v3M7 10.5v3" />
    </Svg>
  );
}

export function HomeIcon(props) {
  return (
    <Svg {...props}>
      <path d="M3.5 11.5l8.5-8.5 8.5 8.5" />
      <path d="M5.5 10v8a2 2 0 0 0 2 2h3v-5a1.5 1.5 0 0 1 1.5-1.5h0A1.5 1.5 0 0 1 13.5 15v5h3a2 2 0 0 0 2-2v-8" />
    </Svg>
  );
}

export function PencilIcon(props) {
  return (
    <Svg {...props}>
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="M15 5l4 4" />
    </Svg>
  );
}

export function CalendarIcon(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </Svg>
  );
}

export function GearIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}

export function RefreshIcon(props) {
  return (
    <Svg {...props}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 4v6h-6" />
    </Svg>
  );
}

export function CheckCircleIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12.5l3 3 6-6" />
    </Svg>
  );
}

export function HourglassIcon(props) {
  return (
    <Svg {...props}>
      <path d="M6 2h12M6 22h12M8 2v3.5c0 2 1.5 3.5 4 4.5 2.5-1 4-2.5 4-4.5V2M8 22v-3.5c0-2 1.5-3.5 4-4.5 2.5 1 4 2.5 4 4.5V22" />
    </Svg>
  );
}

export function CheckIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 12.5l5 5L20 6.5" />
    </Svg>
  );
}

export function BellIcon(props) {
  return (
    <Svg {...props}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </Svg>
  );
}

export function SortIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M4 12h10M4 18h6" />
    </Svg>
  );
}

export function SpinnerIcon({ size = 16, color = '#ec4899' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
      <rect x="10.5" y="0" width="3" height="7" rx="1.5" />
      <rect x="10.5" y="17" width="3" height="7" rx="1.5" />
      <rect x="0" y="10.5" width="7" height="3" rx="1.5" />
      <rect x="17" y="10.5" width="7" height="3" rx="1.5" />
      <rect x="10.5" y="0" width="3" height="7" rx="1.5" transform="rotate(45 12 12)" />
      <rect x="10.5" y="17" width="3" height="7" rx="1.5" transform="rotate(45 12 12)" />
      <rect x="10.5" y="0" width="3" height="7" rx="1.5" transform="rotate(-45 12 12)" />
      <rect x="10.5" y="17" width="3" height="7" rx="1.5" transform="rotate(-45 12 12)" />
    </svg>
  );
}
