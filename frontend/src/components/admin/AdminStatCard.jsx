import React from 'react';
import { C, FONT, R } from '../../theme';

function AdminStatCard({ label, value, detail, tone = 'navy' }) {
  const tones = {
    navy: { accent: C.navy, bg: C.indigoBg },
    blue: { accent: C.blueText, bg: C.blueBg },
    green: { accent: C.green, bg: C.greenBg },
    amber: { accent: C.amber, bg: C.amberBg },
    pink: { accent: C.pinkDark, bg: C.pinkBg },
  };
  const color = tones[tone] || tones.navy;

  return (
    <section style={styles.card}>
      <div style={{ ...styles.marker, background: color.bg, color: color.accent }} aria-hidden="true" />
      <div style={styles.label}>{label}</div>
      <div style={styles.value}>{value ?? '—'}</div>
      {detail && <div style={styles.detail}>{detail}</div>}
    </section>
  );
}

const styles = {
  card: { position: 'relative', minWidth: 0, overflow: 'hidden', padding: '17px 16px 14px', borderRadius: R.card, background: C.card },
  marker: { position: 'absolute', top: 0, left: 0, width: 100, height: 4, borderRadius: '0 0 8px 0' },
  label: { color: C.muted, fontFamily: FONT, fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 },
  value: { color: C.ink, fontFamily: FONT, fontSize: 27, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.2, marginTop: 7, overflow: 'hidden', textOverflow: 'ellipsis' },
  detail: { color: C.mutedSoft, fontFamily: FONT, fontSize: 11.5, lineHeight: 1.3, marginTop: 5 },
};

export default AdminStatCard;
