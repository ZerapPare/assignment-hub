import React from 'react';
import { C } from '../theme';

// Status breakdown donut. r = 15.9 makes the circumference ≈ 100, so each
// segment's dasharray is just its percentage.
const R = 15.9;
const TRACK = '#eef2ff';

function DonutChart({ completed = 0, inProgress = 0, notStarted = 0, total = 0 }) {
  const segments = [
    { key: 'completed', label: 'ส่งแล้ว', value: completed, color: C.navy },
    { key: 'in_progress', label: 'กำลังทำ', value: inProgress, color: C.pink },
    { key: 'not_started', label: 'ยังไม่เริ่ม', value: notStarted, color: C.blueMid },
  ];

  let cumulative = 0;

  return (
    <div>
      <div style={styles.chartWrap}>
        <svg width="120" height="120" viewBox="0 0 42 42">
          <circle r={R} cx="21" cy="21" fill="transparent" stroke={TRACK} strokeWidth="7" />
          {total > 0 &&
            segments.map((s) => {
              if (s.value <= 0) return null;
              const pct = (s.value / total) * 100;
              const offset = -cumulative;
              cumulative += pct;
              return (
                <circle
                  key={s.key}
                  r={R}
                  cx="21"
                  cy="21"
                  fill="transparent"
                  stroke={s.color}
                  strokeWidth="7"
                  strokeDasharray={`${pct} ${100 - pct}`}
                  strokeDashoffset={offset}
                  transform="rotate(-90 21 21)"
                />
              );
            })}
        </svg>
        {total === 0 && <div style={styles.empty}>ยังไม่มีงาน</div>}
      </div>

      <div style={styles.legend}>
        {segments.map((s) => (
          <span key={s.key} style={styles.legendItem}>
            <span style={{ ...styles.swatch, background: s.color }} />
            {s.label} · {s.value}
          </span>
        ))}
      </div>
    </div>
  );
}

const styles = {
  chartWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  empty: {
    position: 'absolute',
    fontSize: 12,
    color: C.mutedLight,
  },
  legend: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 10,
    fontSize: 11,
    color: C.muted,
  },
  legendItem: { display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' },
  swatch: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
};

export default DonutChart;
