import React, { useMemo, useState } from 'react';
import { C, FONT } from '../../theme';

const CHART_W = 640;
const CHART_H = 208;
const LEFT = 34;
const RIGHT = 16;
const TOP = 18;
const BOTTOM = 36;

function getValue(value) {
  if (typeof value === 'number') return value;
  return Number(value?.value ?? value?.count ?? 0);
}

function TrendChart({ title, labels = [], series = [], valueLabel = 'รายการ' }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const points = Math.max(labels.length, ...series.map((item) => item.values?.length || 0), 0);
  const values = series.flatMap((item) => (item.values || []).map(getValue));
  const maxValue = Math.max(...values, 1);
  const graphWidth = CHART_W - LEFT - RIGHT;
  const graphHeight = CHART_H - TOP - BOTTOM;
  const safeLabels = labels.length ? labels : Array.from({ length: points }, (_, index) => String(index + 1));
  const steps = useMemo(() => [0, .25, .5, .75, 1].map((step) => Math.round(maxValue * step)), [maxValue]);

  const x = (index) => LEFT + (points <= 1 ? graphWidth / 2 : (index / (points - 1)) * graphWidth);
  const y = (value) => TOP + graphHeight - (getValue(value) / maxValue) * graphHeight;
  const activeLabel = activeIndex === null ? null : safeLabels[activeIndex];

  if (!points || !series.length) {
    return <div style={styles.empty}>ยังไม่มีข้อมูลแนวโน้มในช่วงเวลานี้</div>;
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.legend} aria-label={`${title} คำอธิบายเส้นข้อมูล`}>
        {series.map((item) => <span key={item.key || item.label} style={styles.legendItem}><i style={{ ...styles.legendDot, background: item.color }} />{item.label}</span>)}
      </div>
      <div style={styles.plot}>
        {activeIndex !== null && (
          <div style={{ ...styles.tooltip, left: `${Math.min(82, Math.max(6, (x(activeIndex) / CHART_W) * 100))}%` }} role="status">
            <strong>{activeLabel}</strong>
            {series.map((item) => <span key={item.key || item.label}>{item.label}: {getValue(item.values?.[activeIndex])} {valueLabel}</span>)}
          </div>
        )}
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          style={styles.svg}
          role="img"
          aria-label={title}
          onMouseLeave={() => setActiveIndex(null)}
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left - (LEFT / CHART_W) * rect.width) / ((graphWidth / CHART_W) * rect.width)));
            setActiveIndex(Math.round(fraction * (points - 1)));
          }}
        >
          {steps.map((step) => <g key={step}><line x1={LEFT} x2={CHART_W - RIGHT} y1={y(step)} y2={y(step)} stroke={C.line} strokeWidth="1" /><text x={LEFT - 8} y={y(step) + 4} textAnchor="end" fill={C.mutedLight} fontSize="10" fontFamily={FONT}>{step}</text></g>)}
          {activeIndex !== null && <line x1={x(activeIndex)} x2={x(activeIndex)} y1={TOP} y2={TOP + graphHeight} stroke={C.lineBtnHover} strokeWidth="1" strokeDasharray="3 3" />}
          {series.map((item) => {
            const pointString = (item.values || []).map((value, index) => `${x(index)},${y(value)}`).join(' ');
            return <g key={item.key || item.label}>
              <polyline fill="none" points={pointString} stroke={item.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {(item.values || []).map((value, index) => <circle key={index} cx={x(index)} cy={y(value)} r={activeIndex === index ? 5 : 4} fill={C.card} stroke={item.color} strokeWidth="2" tabIndex="0" onFocus={() => setActiveIndex(index)}><title>{`${item.label}, ${safeLabels[index]}: ${getValue(value)} ${valueLabel}`}</title></circle>)}
            </g>;
          })}
          {safeLabels.map((label, index) => <text key={`${label}-${index}`} x={x(index)} y={CHART_H - 12} textAnchor="middle" fill={C.muted} fontSize="10.5" fontFamily={FONT}>{label}</text>)}
        </svg>
      </div>
      <details style={styles.dataTable}>
        <summary>ดูข้อมูลเป็นตาราง</summary>
        <table style={styles.table}><thead><tr><th>ช่วงเวลา</th>{series.map((item) => <th key={item.key || item.label}>{item.label}</th>)}</tr></thead><tbody>{safeLabels.map((label, index) => <tr key={`${label}-${index}`}><td>{label}</td>{series.map((item) => <td key={item.key || item.label}>{getValue(item.values?.[index])}</td>)}</tr>)}</tbody></table>
      </details>
    </div>
  );
}

const styles = {
  wrap: { minWidth: 0 },
  empty: { minHeight: 184, display: 'grid', placeItems: 'center', color: C.muted, fontFamily: FONT, fontSize: 13, textAlign: 'center' },
  legend: { display: 'flex', flexWrap: 'wrap', gap: '7px 14px', marginBottom: 6 },
  legendItem: { display: 'inline-flex', alignItems: 'center', gap: 6, color: C.body, fontFamily: FONT, fontSize: 11.5 },
  legendDot: { width: 8, height: 8, borderRadius: 99, flexShrink: 0 },
  plot: { position: 'relative' },
  svg: { display: 'block', width: '100%', height: 'auto', overflow: 'visible' },
  tooltip: { position: 'absolute', top: 5, zIndex: 1, minWidth: 132, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: 2, padding: '7px 9px', border: `1px solid ${C.lineInput}`, borderRadius: 6, background: C.card, boxShadow: '0 8px 18px rgba(20,40,63,.12)', color: C.body, fontFamily: FONT, fontSize: 10.5, pointerEvents: 'none' },
  dataTable: { color: C.muted, fontFamily: FONT, fontSize: 11.5, marginTop: 5 },
  table: { width: '100%', borderCollapse: 'collapse', color: C.body, fontSize: 11.5, marginTop: 8, textAlign: 'left' },
};

export default TrendChart;
