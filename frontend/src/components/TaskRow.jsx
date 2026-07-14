import React from 'react';

// One row in the "all tasks" list: colored dot + title/meta + status badge.
function TaskRow({ title, meta, dotColor, badgeText, badgeColor, badgeBg, last }) {
  return (
    <div style={{ ...styles.row, borderBottom: last ? 'none' : '1px solid oklch(94% 0.01 90)' }}>
      <div style={{ ...styles.dot, background: dotColor }} />
      <div style={styles.text}>
        <div style={styles.title}>{title}</div>
        <div style={styles.meta}>{meta}</div>
      </div>
      <span style={{ ...styles.badge, color: badgeColor, background: badgeBg }}>
        {badgeText}
      </span>
    </div>
  );
}

const styles = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 4px',
  },
  dot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 13.5, fontWeight: 600, color: 'oklch(25% 0.02 290)' },
  meta: { fontSize: 11.5, color: 'oklch(55% 0.02 290)', marginTop: 2 },
  badge: {
    fontSize: 11.5,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 20,
    whiteSpace: 'nowrap',
  },
};

export default TaskRow;
