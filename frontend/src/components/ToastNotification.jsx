import React, { useEffect } from 'react';

function ToastNotification({ type = 'success', message, onClose, duration = 5000 }) {
  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const isSuccess = type === 'success';

  return (
    <div
      style={{
        ...styles.toast,
        ...(isSuccess ? styles.success : styles.error),
      }}
    >
      <div style={styles.icon}>
        {isSuccess ? '✓' : '✕'}
      </div>

      <span style={styles.message}>{message}</span>

      <button
        type="button"
        onClick={onClose}
        style={styles.close}
      >
        ×
      </button>
    </div>
  );
}

const styles = {
  toast: {
    position: 'fixed',
    top: 24,
    left: '50%',
    zIndex: 9999,
    transform: 'translate(-50%, -50%)',

    display: 'flex',
    alignItems: 'center',
    gap: 10,

    minWidth: 280,
    maxWidth: 400,

    padding: '12px 14px',
    borderRadius: 12,

    fontSize: 13,
    fontWeight: 600,

    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
  },

  success: {
    background: '#ecfdf5',
    color: '#047857',
    border: '1px solid #a7f3d0',
  },

  error: {
    background: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
  },

  icon: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: 13,
    fontWeight: 700,
  },

  message: {
    flex: 1,
  },

  close: {
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: 20,
    lineHeight: 1,
    padding: 0,
  },
};

export default ToastNotification;