import React from 'react';
import { C, FONT, R, SHADOW } from '../theme';

const AD_URL = 'https://assignmenthub1ad.my.canva.site/follow-your-gut';
const AD_IMAGE = '/images/ad_images.png';

function AdPopup({ open, onClose }) {
  if (!open) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.banner} onClick={(e) => e.stopPropagation()}>
        <button style={styles.close} onClick={onClose}>✕</button>
        <a href={AD_URL} target="_blank" rel="noopener noreferrer" style={styles.adSlot}>
          <span style={styles.adLabel}>Sponsored</span>
          <img src={AD_IMAGE} alt="โฆษณา Assignment Hub — คลิกเพื่อดูรายละเอียด" style={styles.adImage} />
        </a>
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
  adLabel: { fontSize: 10, color: C.muted, letterSpacing: 0.5 },
  adImage: { display: 'block', width: '100%', height: 'auto' },
};

export default AdPopup;