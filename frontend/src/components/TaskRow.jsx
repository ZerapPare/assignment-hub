import React from 'react';
import { C } from '../theme';

export const GRID = '2fr 1fr 1fr 1fr';

const PALETTE = [
  [C.blueMid, C.navy],
  [C.pinkSoft, C.pink],
  ['#8fd6a8', C.green],
  ['#cbd5e1', '#94a3b8'],
  ['#a5b4fc', '#4f46e5'],
  ['#fcd34d', '#d97706'],
];

function gradientFor(seed) {
  let hash = 0;
  const s = seed || '';
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  const [from, to] = PALETTE[Math.abs(hash) % PALETTE.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

function TaskRow({ title, course, platform, due, badgeText, badgeColor, badgeBg, last }) {
  return (
    <div
      style={{
        ...styles.row,
        borderBottom: last ? 'none' : `1px solid ${C.pageBg}`,
      }}
    >
      <div style={styles.subject}>
        <div style={{ ...styles.avatar, background: gradientFor(course || title) }} />
        <div style={{ minWidth: 0 }}>
          <div style={styles.title}>{title}</div>
          {course && <div style={styles.course}>{course}</div>}
        </div>
      </div>
      <span style={styles.cell}>{platform}</span>
      <span style={styles.cell}>{due}</span>
      <span style={{ ...styles.badge, color: badgeColor, background: badgeBg }}>{badgeText}</span>
    </div>
  );
}

const styles = {
  row: {
    display: 'grid',
    gridTemplateColumns: GRID,
    alignItems: 'center',
    gap: 8,
    padding: '12px 4px',
  },
  subject: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  avatar: { width: 30, height: 30, borderRadius: '50%', flexShrink: 0 },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: C.ink,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  course: {
    fontSize: 11,
    color: C.mutedLight,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cell: {
    fontSize: 12.5,
    color: C.muted,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  badge: {
    fontSize: 11.5,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 6,
    width: 'fit-content',
    whiteSpace: 'nowrap',
  },
};

export default TaskRow;
