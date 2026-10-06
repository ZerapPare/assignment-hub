import React from 'react';
import { C, FONT, R } from '../../theme';

function normalizeStatus(value) {
  const status = String(value || 'unknown').toLowerCase();
  if (['healthy', 'ok', 'up', 'active'].includes(status)) return { label: 'ปกติ', color: C.green, bg: C.greenBg };
  if (['degraded', 'warning', 'warn'].includes(status)) return { label: 'ต้องเฝ้าดู', color: C.amber, bg: C.amberBg };
  if (['down', 'error', 'unhealthy'].includes(status)) return { label: 'ขัดข้อง', color: C.pinkDark, bg: C.pinkBg };
  return { label: 'ไม่ทราบสถานะ', color: C.muted, bg: C.pageBg };
}

function HealthCard({ system = {}, compact = false }) {
  const api = normalizeStatus(system.api_status || system.api?.status);
  const db = normalizeStatus(system.db_status || system.database?.status);
  const uptime = system.uptime ?? system.uptime_seconds;
  const uptimeLabel = uptime === undefined || uptime === null ? '—' : `${Math.floor(Number(uptime) / 3600)} ชม.`;

  return (
    <section style={{ ...styles.card, ...(compact ? { padding: 16 } : {}) }}>
      <div style={styles.head}><div><div style={styles.title}>สุขภาพระบบ</div><div style={styles.sub}>ตรวจสอบจาก API และฐานข้อมูล</div></div><span style={{ ...styles.overall, background: api.bg, color: api.color }}><i style={{ ...styles.dot, background: api.color }} />{api.label}</span></div>
      <div style={styles.rows}>
        <HealthRow label="API" status={api} value={system.version || 'พร้อมให้บริการ'} />
        <HealthRow label="Database" status={db} value={system.database_name || 'เชื่อมต่อแล้ว'} />
        <HealthRow label="Uptime" status={normalizeStatus('healthy')} value={uptimeLabel} />
      </div>
    </section>
  );
}

function HealthRow({ label, status, value }) {
  return <div style={styles.row}><span style={styles.rowLabel}><i style={{ ...styles.dot, background: status.color }} />{label}</span><span style={styles.rowValue}>{value}</span></div>;
}

const styles = {
  card: { borderRadius: R.card, background: C.card, padding: 20, minWidth: 0 },
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 16 },
  title: { color: C.ink, fontFamily: FONT, fontSize: 14.5, fontWeight: 700 },
  sub: { color: C.muted, fontFamily: FONT, fontSize: 11.5, marginTop: 3 },
  overall: { display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, borderRadius: 99, fontFamily: FONT, fontSize: 11, fontWeight: 700, padding: '5px 8px' },
  rows: { borderTop: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottom: `1px solid ${C.line}`, color: C.body, fontFamily: FONT, fontSize: 12.5, padding: '10px 0' },
  rowLabel: { display: 'inline-flex', alignItems: 'center', gap: 7 },
  rowValue: { color: C.muted, fontSize: 11.5, overflow: 'hidden', textAlign: 'right', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  dot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
};

export { normalizeStatus };
export default HealthCard;
