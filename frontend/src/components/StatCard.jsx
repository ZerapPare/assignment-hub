import React from 'react';

const poppins = "'Poppins', sans-serif";

// A single metric tile: label + big number in an accent color.
function StatCard({ label, value, color }) {
  return (
    <div style={styles.card}>
      <div style={styles.label}>{label}</div>
      <div style={{ ...styles.value, color: color || 'oklch(25% 0.02 290)' }}>
        {value}
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: 'white',
    borderRadius: 16,
    padding: '18px 20px',
    boxShadow: '0 2px 10px -4px oklch(30% 0.03 290 / 0.1)',
  },
  label: {
    fontSize: 12.5,
    color: 'oklch(55% 0.02 290)',
    fontWeight: 600,
    marginBottom: 6,
  },
  value: { fontFamily: poppins, fontSize: 26, fontWeight: 800 },
};

export default StatCard;
