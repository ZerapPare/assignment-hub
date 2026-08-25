import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminStatCard from '../../components/admin/AdminStatCard';
import HealthCard from '../../components/admin/HealthCard';
import TrendChart from '../../components/admin/TrendChart';
import { adminRequest, formatDate, formatNumber, listFrom } from '../../components/admin/adminApi';
import { C, FONT, R } from '../../theme';

function shortDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(date);
}

function AdminDashboardPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const range = params.get('range') === '30d' ? '30d' : '7d';
  const [data, setData] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dashboard = await adminRequest(`/api/admin/dashboard?range=${range}`);
      setData(dashboard || {});
      try {
        setHealth(await adminRequest('/api/admin/system/health'));
      } catch (_healthError) {
        // Dashboard metrics remain useful when the dedicated health check is unavailable.
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const userTrend = useMemo(() => listFrom(data, ['users_by_day', 'user_trend', 'usersByDay']), [data]);
  const errorTrend = useMemo(() => listFrom(data, ['errors_by_day', 'error_trend', 'errorsByDay']), [data]);
  const labels = userTrend.length ? userTrend.map((item) => shortDate(item.day || item.date || item.bucket_start)) : errorTrend.map((item) => shortDate(item.day || item.date || item.bucket_start));
  const users = data?.users || {};
  const system = { ...(data?.system || {}), ...(health || {}) };
  const sources = listFrom(data, ['top_error_sources', 'error_sources', 'topErrorSources']);
  const recentErrors = listFrom(data, ['recent_errors', 'recentErrors']);
  const recentUsers = listFrom(data, ['recent_active_users', 'recentActiveUsers']);

  return (
    <div>
      <header className="ah-admin-page-header" style={styles.header}>
        <div><div style={styles.kicker}>CONTROL ROOM</div><h1 style={styles.title}>ภาพรวมระบบ</h1><p style={styles.subtitle}>ตัวเลขสำคัญและสัญญาณที่ต้องติดตามในวันนี้</p></div>
        <div style={styles.actions}>
          <label style={styles.rangeLabel}>ช่วงข้อมูล
            <select value={range} onChange={(event) => setParams({ range: event.target.value })} style={styles.select} aria-label="เลือกช่วงข้อมูล"><option value="7d">7 วัน</option><option value="30d">30 วัน</option></select>
          </label>
          <button type="button" onClick={load} style={styles.ghostButton} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</button>
        </div>
      </header>

      {error && <div role="alert" style={styles.alert}>โหลดข้อมูลแดชบอร์ดไม่สำเร็จ: {error} <button type="button" onClick={load} style={styles.linkButton}>ลองอีกครั้ง</button></div>}

      <div className="ah-admin-grid-6" style={styles.statGrid}>
        <AdminStatCard label="ผู้ใช้ทั้งหมด" value={formatNumber(users.total)} detail={users.suspended ? `ระงับ ${formatNumber(users.suspended)} บัญชี` : undefined} tone="navy" />
        <AdminStatCard label="ใช้งานวันนี้" value={formatNumber(users.active_today)} detail="มี activity ตั้งแต่เริ่มวัน" tone="blue" />
        <AdminStatCard label="ใช้งาน 7 วัน" value={formatNumber(users.active_7d)} detail="ผู้ใช้ที่ยืนยันตัวตนแล้ว" tone="green" />
        <AdminStatCard label="ข้อผิดพลาด 24 ชม." value={formatNumber(system.errors_24h)} detail="ข้อผิดพลาดฝั่งระบบ" tone="pink" />
        <AdminStatCard label="อัตราข้อผิดพลาด" value={`${Number(system.error_rate || 0).toFixed(2)}%`} detail="5xx ต่อ request ทั้งหมด" tone="amber" />
        <AdminStatCard label="เวลา API เฉลี่ย" value={`${formatNumber(system.avg_response_ms)} ms`} detail={`คำขอ 24 ชม. ${formatNumber(system.requests_24h)}`} tone="navy" />
      </div>

      <div className="ah-admin-two-col" style={styles.contentGrid}>
        <section style={styles.card}>
          <div style={styles.cardHead}><div><h2 style={styles.cardTitle}>จังหวะการใช้งาน</h2><p style={styles.cardSub}>ผู้ใช้ใหม่และผู้ใช้ที่ active ในช่วง {range === '30d' ? '30 วัน' : '7 วัน'}</p></div></div>
          <TrendChart title="แนวโน้มผู้ใช้งาน" labels={labels} valueLabel="ผู้ใช้" series={[
            { key: 'new', label: 'ผู้ใช้ใหม่', color: C.blueText, values: userTrend.map((item) => item.new_users ?? item.new ?? item.created ?? 0) },
            { key: 'active', label: 'ผู้ใช้ active', color: C.amber, values: userTrend.map((item) => item.active_users ?? item.active ?? item.count ?? 0) },
          ]} />
        </section>
        <HealthCard system={system} />
      </div>

      <div className="ah-admin-two-col" style={styles.contentGrid}>
        <section style={styles.card}>
          <div style={styles.cardHead}><div><h2 style={styles.cardTitle}>ข้อผิดพลาดตามเวลา</h2><p style={styles.cardSub}>เฉพาะ error ที่เก็บไว้เพื่อวิเคราะห์</p></div><button type="button" style={styles.textButton} onClick={() => navigate('/admin/errors')}>ดูทั้งหมด</button></div>
          <TrendChart title="แนวโน้มข้อผิดพลาด" labels={errorTrend.map((item) => shortDate(item.day || item.date || item.bucket_start))} valueLabel="เหตุการณ์" series={[{ key: 'errors', label: 'ข้อผิดพลาด', color: C.pinkDark, values: errorTrend.map((item) => item.error_count ?? item.errors ?? item.count ?? 0) }]} />
        </section>
        <section style={styles.card}>
          <div style={styles.cardHead}><div><h2 style={styles.cardTitle}>ต้นตอที่พบบ่อย</h2><p style={styles.cardSub}>เรียงตามจำนวน error ในช่วงที่เลือก</p></div></div>
          {sources.length ? <div style={styles.sourceList}>{sources.slice(0, 5).map((source, index) => {
            const count = Number(source.count ?? source.error_count ?? 0);
            const maximum = Math.max(...sources.map((item) => Number(item.count ?? item.error_count ?? 0)), 1);
            return <div key={source.source || index} style={styles.sourceRow}><div style={styles.sourceTop}><span style={styles.sourceName}>{source.source || 'ไม่ระบุแหล่งที่มา'}</span><span style={styles.sourceCount}>{formatNumber(count)}</span></div><div style={styles.track}><div style={{ ...styles.fill, width: `${Math.max(4, (count / maximum) * 100)}%` }} /></div></div>;
          })}</div> : <EmptyState label="ยังไม่มี error ที่บันทึกไว้" />}
        </section>
      </div>

      <div className="ah-admin-two-col" style={styles.contentGrid}>
        <section style={styles.card}>
          <div style={styles.cardHead}><div><h2 style={styles.cardTitle}>ข้อผิดพลาดล่าสุด</h2><p style={styles.cardSub}>ตรวจสอบ request ID เพื่อไล่รายละเอียดต่อ</p></div><button type="button" style={styles.textButton} onClick={() => navigate('/admin/errors')}>เปิด Error Logs</button></div>
          {recentErrors.length ? <div style={styles.list}>{recentErrors.slice(0, 5).map((item) => <button key={item.error_id || item.id} type="button" onClick={() => navigate(`/admin/errors?search=${encodeURIComponent(item.request_id || item.error_id || '')}`)} style={styles.listButton}><span style={{ ...styles.severity, background: String(item.level).toLowerCase() === 'warn' ? C.amberBg : C.pinkBg, color: String(item.level).toLowerCase() === 'warn' ? C.amber : C.pinkDark }}>{item.level || 'error'}</span><span style={styles.listCopy}><strong>{item.source || 'application'}</strong><small>{item.message || 'ไม่มีข้อความข้อผิดพลาด'}</small></span><span style={styles.listTime}>{formatDate(item.occurred_at || item.created_at)}</span></button>)}</div> : <EmptyState label="ยังไม่มีข้อผิดพลาดล่าสุด" />}
        </section>
        <section style={styles.card}>
          <div style={styles.cardHead}><div><h2 style={styles.cardTitle}>ผู้ใช้ที่เพิ่งใช้งาน</h2><p style={styles.cardSub}>activity ล่าสุดจาก authenticated request</p></div><button type="button" style={styles.textButton} onClick={() => navigate('/admin/users')}>ดูผู้ใช้</button></div>
          {recentUsers.length ? <div style={styles.list}>{recentUsers.slice(0, 5).map((user) => <button key={user.user_id || user.id} type="button" onClick={() => navigate(`/admin/users/${user.user_id || user.id}`)} style={styles.listButton}><span style={styles.userAvatar}>{String(user.student_name || user.university_email || '?').slice(0, 1)}</span><span style={styles.listCopy}><strong>{user.student_name || 'ไม่ระบุชื่อ'}</strong><small>{user.university_email || user.student_id || '—'}</small></span><span style={styles.listTime}>{formatDate(user.last_seen_at)}</span></button>)}</div> : <EmptyState label="ยังไม่มี activity ของผู้ใช้" />}
        </section>
      </div>
    </div>
  );
}

function EmptyState({ label }) { return <div style={styles.empty}>{label}</div>; }

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20 },
  kicker: { color: C.pinkDark, fontFamily: FONT, fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em' },
  title: { color: C.ink, fontFamily: FONT, fontSize: 25, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2, margin: '3px 0 0' },
  subtitle: { color: C.muted, fontFamily: FONT, fontSize: 13, margin: '4px 0 0' },
  actions: { display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  rangeLabel: { display: 'flex', alignItems: 'center', gap: 7, color: C.muted, fontFamily: FONT, fontSize: 12 },
  select: { border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.ink, fontFamily: FONT, fontSize: 12.5, padding: '8px 10px' },
  ghostButton: { border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.ink, cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, padding: '8px 13px' },
  alert: { background: C.pinkBg, border: `1px solid ${C.pinkSoft}`, borderRadius: R.card, color: C.pinkDark, fontFamily: FONT, fontSize: 13, lineHeight: 1.5, marginBottom: 14, padding: '10px 13px' },
  linkButton: { border: 0, background: 'transparent', color: C.navy, cursor: 'pointer', fontFamily: FONT, fontWeight: 700, padding: 0 },
  statGrid: { marginBottom: 16 },
  contentGrid: { marginTop: 16 },
  card: { minWidth: 0, borderRadius: R.card, background: C.card, padding: 20 },
  cardHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 15 },
  cardTitle: { color: C.ink, fontFamily: FONT, fontSize: 14.5, fontWeight: 700, margin: 0 },
  cardSub: { color: C.muted, fontFamily: FONT, fontSize: 11.5, margin: '3px 0 0' },
  textButton: { border: 0, background: 'transparent', color: C.navy, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 700, padding: 0, whiteSpace: 'nowrap' },
  sourceList: { display: 'flex', flexDirection: 'column', gap: 13, paddingTop: 2 },
  sourceRow: { display: 'flex', flexDirection: 'column', gap: 6 },
  sourceTop: { display: 'flex', justifyContent: 'space-between', gap: 10, fontFamily: FONT, fontSize: 12.5 },
  sourceName: { color: C.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sourceCount: { color: C.muted, flexShrink: 0 },
  track: { height: 6, overflow: 'hidden', borderRadius: 99, background: C.lineSoft },
  fill: { height: '100%', borderRadius: 99, background: C.navyMid },
  list: { borderTop: `1px solid ${C.line}` },
  listButton: { width: '100%', display: 'flex', alignItems: 'center', gap: 9, border: 0, borderBottom: `1px solid ${C.line}`, background: 'transparent', cursor: 'pointer', fontFamily: FONT, padding: '10px 0', textAlign: 'left' },
  severity: { borderRadius: 99, flexShrink: 0, fontSize: 10.5, fontWeight: 700, padding: '3px 6px', textTransform: 'uppercase' },
  userAvatar: { width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: '50%', flexShrink: 0, background: C.indigoBg, color: C.navy, fontSize: 12, fontWeight: 700 },
  listCopy: { display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0 },
  listTime: { color: C.mutedSoft, flexShrink: 0, fontSize: 10.5, textAlign: 'right' },
  empty: { display: 'grid', minHeight: 128, placeItems: 'center', color: C.muted, fontFamily: FONT, fontSize: 12.5, textAlign: 'center' },
};

export default AdminDashboardPage;
