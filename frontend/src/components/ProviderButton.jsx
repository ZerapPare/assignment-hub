import React, { useState } from 'react';

const fontStack =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Sarabun', sans-serif";

// Reusable OAuth-provider sign-in button (Google / Microsoft / ...)
function ProviderButton({ icon, label, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...styles.btn, ...(hover ? styles.btnHover : null) }}
    >
      <span style={styles.icon}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

const styles = {
  btn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.65rem',
    width: '100%',
    padding: '0.85rem 1rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    fontFamily: fontStack,
    color: '#1e293b',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  btnHover: {
    borderColor: '#c4b5fd',
    background: '#faf5ff',
    boxShadow: '0 4px 12px -4px rgba(124, 58, 237, 0.25)',
  },
  icon: { display: 'flex', alignItems: 'center' },
};

export default ProviderButton;
