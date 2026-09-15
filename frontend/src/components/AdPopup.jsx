import React from 'react';
import { C, FONT, R, SHADOW } from '../theme';

function AdPopup({ open, onClose }) {
  if (!open) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.banner} onClick={(e) => e.stopPropagation()}>
        <button style={styles.close} onClick={onClose}>✕</button>
        <div style={styles.adSlot}>
          <span style={styles.adLabel}>Sponsored</span>
          <p style={styles.adText}>ตัวอย่างพื้นที่โฆษณา 320×100</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  banner: {
    background: C.card, borderRadius: R.card, padding: 16,
    width: 340, boxShadow: SHADOW.primaryBtn, position: 'relative',
    fontFamily: FONT,
  },
  close: {
    position: 'absolute', top: 8, right: 8, border: 'none',
    background: 'transparent', cursor: 'pointer', fontSize: 14, color: C.muted,
  },
  adSlot: {
    background: C.pageBg, borderRadius: 8, padding: '20px 12px',
    textAlign: 'center',
  },
  adLabel: { fontSize: 10, color: C.muted, letterSpacing: 0.5 },
  adText: { fontSize: 13, color: C.ink, margin: '6px 0 0' },
};

export default AdPopup;