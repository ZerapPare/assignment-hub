import React from 'react';

const poppins = "'Poppins', sans-serif";
const W = 240;
const H = 90;

// Line chart (SVG). `data` = [{ label, value }]. Scales value → y automatically.
function TrendChart({ data }) {
  const values = data.map((d) => d.value);
  const max = Math.max(1, ...values);
  const step = data.length > 1 ? W / (data.length - 1) : W;

  const coords = data.map((d, i) => {
    const x = i * step;
    const y = H - 12 - (d.value / max) * (H - 24); // 12px padding top/bottom
    return `${x.toFixed(0)},${y.toFixed(0)}`;
  });
  const line = coords.join(' ');
  const area = `${line} ${W},${H} 0,${H}`;

  return (
    <div>
      <div style={styles.header}>แนวโน้มการทำงาน</div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={styles.svg}>
        <polyline
          points={area} fill="oklch(58% 0.17 290 / 0.08)" stroke="none"
        />
        <polyline
          points={line} fill="none" stroke="oklch(58% 0.17 290)"
          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
      <div style={styles.labels}>
        {data.map((d, i) => (
          <span key={i}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}

const styles = {
  header: { fontFamily: poppins, fontWeight: 700, fontSize: 16, color: 'oklch(25% 0.02 290)' },
  svg: { marginTop: 14, display: 'block' },
  labels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10.5,
    color: 'oklch(58% 0.02 290)',
    marginTop: 4,
  },
};

export default TrendChart;
