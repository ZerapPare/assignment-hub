import React from 'react';
import { C, FONT, R, SHADOW } from '../theme';

function AdPopup({ ad, open, onClose }) {
  if (!open || !ad) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.banner} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label="ปิดโฆษณา"
          title="ปิดโฆษณา"
          style={styles.close}
          onClick={onClose}
        >
          ✕
        </button>
        <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" style={styles.adSlot}>
          <span style={styles.adTitle}>{ad.title}</span>
          <img src={ad.imageUrl} alt={ad.title} style={styles.adImage} />
        </a>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 60000,
  },
  banner: {
    background: C.card, borderRadius: R.card, padding: 20,
    width: 'min(720px, calc(100vw - 32px))', boxSizing: 'border-box',
    boxShadow: SHADOW.primaryBtn, position: 'relative',
    fontFamily: FONT,
  },
  close: {
    position: 'absolute', top: 8, right: 8, border: 'none',
    background: 'transparent', cursor: 'pointer', fontSize: 14, color: C.muted,
  },
  adSlot: {
    display: 'block',
    background: C.pageBg, borderRadius: 8, overflow: 'hidden', marginTop: 12,
    textAlign: 'center', textDecoration: 'none', cursor: 'pointer',
  },
  adTitle: { display: 'block', fontSize: 14, fontWeight: 700, color: C.ink, padding: '5px 10px 10px' },
  adImage: { display: 'block', width: '100%', height: 'auto' },
};

export default AdPopup;