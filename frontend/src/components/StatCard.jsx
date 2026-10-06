import React from 'react';
import { C, R } from '../theme';

function StatCard({ icon, iconBg, label, value }) {
  return (
    <div style={styles.card}>
      <div style={{ ...styles.swatch, background: iconBg }}>{icon}</div>
      <div style={{ minWidth: 0, overflow: 'hidden' }}>
        <div style={styles.label}>{label}</div>
        <div style={styles.value}>{value}</div>
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: C.card,
    borderRadius: R.card,
    padding: '14px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minWidth: 0,
    overflow: 'hidden',
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  label: {
    fontSize: 11,
    color: C.mutedLight,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  value: { fontSize: 18, fontWeight: 700, color: C.ink },
};

export default StatCard;
