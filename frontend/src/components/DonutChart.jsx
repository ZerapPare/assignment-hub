import React from 'react';

const poppins = "'Poppins', sans-serif";

// Progress donut (SVG). `percent` 0-100, `done`/`total` for the legend.
function DonutChart({ percent, done, total }) {
  const r = 36;
  const circumference = 2 * Math.PI * r; // ~226
  const offset = circumference * (1 - percent / 100);

  return (
    <div>
      <div style={styles.header}>ความคืบหน้ารวม</div>
      <div style={styles.body}>
        <svg width="88" height="88" viewBox="0 0 88 88">
          <circle
            cx="44" cy="44" r={r} fill="none"
            stroke="oklch(93% 0.01 90)" strokeWidth="10"
          />
          <circle
            cx="44" cy="44" r={r} fill="none"
            stroke="oklch(58% 0.17 290)" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            transform="rotate(-90 44 44)"
          />
        </svg>
        <div>
          <div style={styles.percent}>{percent}%</div>
          <div style={styles.caption}>ทำเสร็จสมบูรณ์แล้ว</div>
        </div>
      </div>
      <div style={styles.legend}>
        <div style={styles.legendRow}>
          <div style={{ ...styles.swatch, background: 'oklch(58% 0.17 290)' }} />
          เสร็จสมบูรณ์ · {done}
        </div>
        <div style={styles.legendRow}>
          <div style={{ ...styles.swatch, background: 'oklch(93% 0.01 90)' }} />
          ยังไม่เสร็จ · {total - done}
        </div>
      </div>
    </div>
  );
}

const styles = {
  header: { fontFamily: poppins, fontWeight: 700, fontSize: 16, color: 'oklch(25% 0.02 290)' },
  body: { display: 'flex', alignItems: 'center', gap: 16, marginTop: 18 },
  percent: { fontFamily: poppins, fontSize: 24, fontWeight: 800, color: 'oklch(25% 0.02 290)' },
  caption: { fontSize: 12.5, color: 'oklch(50% 0.02 290)' },
  legend: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 },
  legendRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'oklch(50% 0.02 290)' },
  swatch: { width: 8, height: 8, borderRadius: 2 },
};

export default DonutChart;
