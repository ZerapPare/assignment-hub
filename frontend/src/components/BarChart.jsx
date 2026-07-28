import React from 'react';
import { C } from '../theme';

const W = 260;
const H = 120;
const BAR_W = 22;
const MIN_H = 8;

function BarChart({ data = [] }) {
  const max = data.reduce((m, d) => Math.max(m, d.value), 0);
  const step = data.length ? W / data.length : W;
  const left = (step - BAR_W) / 2;

  return (
    <div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {data.map((d, i) => {
          const h = max === 0 ? MIN_H : MIN_H + (d.value / max) * (H - MIN_H - 6);
          const fill = d.isToday ? C.pink : d.value > 0 ? C.navy : '#e0e7ff';
          return (
            <rect
              key={i}
              x={i * step + left}
              y={H - h}
              width={BAR_W}
              height={h}
              rx={5}
              fill={fill}
            >
              <title>{`${d.label}: ${d.value} งาน`}</title>
            </rect>
          );
        })}
      </svg>
      <div style={styles.labels}>
        {data.map((d, i) => (
          <span
            key={i}
            style={{
              ...styles.label,
              color: d.isToday ? C.pink : C.mutedLight,
              fontWeight: d.isToday ? 700 : 400,
            }}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const styles = {
  labels: { display: 'flex', marginTop: 4 },
  label: { flex: 1, textAlign: 'center', fontSize: 10 },
};

export default BarChart;
