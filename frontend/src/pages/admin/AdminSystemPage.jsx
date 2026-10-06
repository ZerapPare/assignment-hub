import React, { useCallback, useEffect, useState } from 'react';
import HealthCard, { normalizeStatus } from '../../components/admin/HealthCard';
import AdminStatCard from '../../components/admin/AdminStatCard';
import { adminRequest, formatNumber } from '../../components/admin/adminApi';
import { C, FONT, R } from '../../theme';

function AdminSystemPage() {
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checkedAt, setCheckedAt] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const healthResponse = await adminRequest('/api/admin/system/health');
      setHealth(healthResponse?.health || healthResponse || {});
      try {
        const dashboard = await adminRequest('/api/admin/dashboard?range=7d');
        setMetrics(dashboard?.system || {});
      } catch (_metricsError) {
        // Health status remains readable if the dashboard aggregate is unavailable.
      }
      setCheckedAt(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const api = normalizeStatus(health?.api_status || health?.api?.status);
  const database = normalizeStatus(health?.db_status || health?.database?.status);
  const checks = [
    { name: 'API process', status: api, explanation: health?.api_message || 'ตรวจสอบความพร้อมของ API process' },
    { name: 'MySQL database', status: database, explanation: health?.db_message || 'ทดสอบการเชื่อมต่อฐานข้อมูล' },
  ];

  return <div>
    <header className="ah-admin-page-header" style={styles.header}><div><div style={styles.kicker}>SYSTEM HEALTH</div><h1 style={styles.title}>สถานะระบบ</h1><p style={styles.subtitle}>ข้อมูลเชิงปฏิบัติการที่ปลอดภัยสำหรับการตรวจสอบบริการ</p></div><div style={styles.actions}>{checkedAt && <span style={styles.checked}>อัปเดต {checkedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>}<button type="button" style={styles.refresh} onClick={load} disabled={loading}>{loading ? 'กำลังตรวจสอบ…' : 'ตรวจสอบอีกครั้ง'}</button></div></header>
    {error && <div role="alert" style={styles.alert}>ตรวจสอบสถานะระบบไม่สำเร็จ: {error} <button type="button" onClick={load} style={styles.linkButton}>ลองอีกครั้ง</button></div>}
    <div className="ah-admin-two-col" style={styles.grid}><HealthCard system={health || {}} /><section style={styles.card}><h2 style={styles.cardTitle}>สรุปคำขอ 24 ชั่วโมง</h2><div style={styles.metrics}><AdminStatCard label="คำขอทั้งหมด" value={formatNumber(metrics.requests_24h)} detail="คำขอที่วัดโดยเซิร์ฟเวอร์" tone="blue" /><AdminStatCard label="ข้อผิดพลาด" value={formatNumber(metrics.errors_24h)} detail={`${Number(metrics.error_rate || 0).toFixed(2)}% ของคำขอ`} tone="pink" /><AdminStatCard label="Response เฉลี่ย" value={`${formatNumber(metrics.avg_response_ms)} ms`} detail="ไม่รวม network latency" tone="navy" /></div></section></div>
    <section style={{ ...styles.card, marginTop: 16 }}><div style={styles.cardHead}><div><h2 style={styles.cardTitle}>การตรวจสอบบริการ</h2><p style={styles.cardSub}>การตรวจสอบนี้ไม่แสดง environment variables, secrets หรือ token</p></div></div>{loading ? <div style={styles.loading}>กำลังตรวจสอบ API และ database…</div> : <div style={styles.checks}>{checks.map((check) => <div key={check.name} style={styles.checkRow}><span style={{ ...styles.checkMark, background: check.status.bg, color: check.status.color }}><i style={{ ...styles.dot, background: check.status.color }} />{check.status.label}</span><div style={styles.checkCopy}><strong>{check.name}</strong><span>{check.explanation}</span></div></div>)}</div>}</section>
    <section style={{ ...styles.card, marginTop: 16 }}><div style={styles.cardHead}><div><h2 style={styles.cardTitle}>รายละเอียด process</h2><p style={styles.cardSub}>แสดงเฉพาะ telemetry ที่ไม่อ่อนไหว</p></div></div><dl style={styles.definitionList}><Detail label="Uptime" value={formatUptime(health?.uptime ?? health?.uptime_seconds)} /><Detail label="Node version" value={health?.node_version || health?.nodeVersion} /><Detail label="Process version" value={health?.version || health?.process_version} /><Detail label="Memory usage" value={formatMemory(health?.memory_usage_mb ?? health?.memory?.used_mb)} /></dl></section>
  </div>;
}

function Detail({ label, value }) { return <><dt style={styles.term}>{label}</dt><dd style={styles.definition}>{value || '—'}</dd></>; }
function formatUptime(value) { if (value === undefined || value === null) return '—'; const seconds = Number(value); const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); return `${hours} ชม. ${minutes} นาที`; }
function formatMemory(value) { return value === undefined || value === null ? '—' : `${formatNumber(value)} MB`; }

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 19 },
  kicker: { color: C.pinkDark, fontFamily: FONT, fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em' },
  title: { color: C.ink, fontFamily: FONT, fontSize: 25, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2, margin: '3px 0 0' },
  subtitle: { color: C.muted, fontFamily: FONT, fontSize: 13, margin: '4px 0 0' },
  actions: { display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  checked: { color: C.muted, fontFamily: FONT, fontSize: 11.5 },
  refresh: { border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.navy, cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, padding: '8px 12px' },
  alert: { border: `1px solid ${C.pinkSoft}`, borderRadius: R.card, background: C.pinkBg, color: C.pinkDark, fontFamily: FONT, fontSize: 13, lineHeight: 1.5, marginBottom: 14, padding: '10px 13px' },
  linkButton: { border: 0, background: 'transparent', color: C.navy, cursor: 'pointer', fontFamily: FONT, fontWeight: 700, padding: 0 },
  grid: { alignItems: 'stretch' },
  card: { minWidth: 0, borderRadius: R.card, background: C.card, padding: 20 },
  cardHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 15 },
  cardTitle: { color: C.ink, fontFamily: FONT, fontSize: 14.5, fontWeight: 700, margin: 0 },
  cardSub: { color: C.muted, fontFamily: FONT, fontSize: 11.5, margin: '3px 0 0' },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 },
  loading: { color: C.muted, fontFamily: FONT, fontSize: 13, padding: '24px 0', textAlign: 'center' },
  checks: { borderTop: `1px solid ${C.line}` },
  checkRow: { display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${C.line}`, padding: '12px 0' },
  checkMark: { display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 99, flexShrink: 0, fontFamily: FONT, fontSize: 11, fontWeight: 700, padding: '5px 8px' },
  dot: { width: 7, height: 7, borderRadius: '50%' },
  checkCopy: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 },
  definitionList: { display: 'grid', gridTemplateColumns: 'minmax(130px, .8fr) minmax(0, 1.2fr)', columnGap: 14, margin: 0 },
  term: { borderTop: `1px solid ${C.line}`, color: C.muted, fontFamily: FONT, fontSize: 12, padding: '9px 0' },
  definition: { borderTop: `1px solid ${C.line}`, color: C.body, fontFamily: FONT, fontSize: 12.5, margin: 0, padding: '9px 0', textAlign: 'right' },
};

export default AdminSystemPage;
