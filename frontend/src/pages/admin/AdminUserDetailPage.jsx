import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { StatusBadge } from '../../components/admin/UserTable';
import { adminRequest, formatDate, formatNumber, listFrom, providerLabel } from '../../components/admin/adminApi';
import { C, FONT, R } from '../../theme';

function AdminUserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { admin } = useOutletContext();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPayload(await adminRequest(`/api/admin/users/${id}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const user = payload?.user || payload;
  const suspended = user?.account_status === 'suspended';
  const isSelf = String(user?.university_email || '').trim().toLowerCase() === String(admin?.email || '').trim().toLowerCase() && Boolean(admin?.email);
  const recentErrors = listFrom(payload, ['recent_errors', 'recentErrors', 'errors']);
  const audits = listFrom(payload, ['recent_audit_actions', 'audit_actions', 'audits']);
  const usage = payload?.usage || payload?.summary || {};

  const updateStatus = async () => {
    if (!user) return;
    const nextStatus = suspended ? 'active' : 'suspended';
    setSaving(true);
    try {
      const updated = await adminRequest(`/api/admin/users/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }) });
      setPayload((current) => ({ ...current, user: current?.user ? { ...current.user, account_status: updated.account_status || updated.user?.account_status || nextStatus } : { ...current, account_status: updated.account_status || updated.user?.account_status || nextStatus } }));
      setConfirming(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={styles.loading}>กำลังโหลดรายละเอียดผู้ใช้…</div>;
  if (error && !user) return <div style={styles.errorPage}><h1 style={styles.title}>เปิดรายละเอียดผู้ใช้ไม่ได้</h1><p>{error}</p><button type="button" style={styles.primary} onClick={load}>ลองอีกครั้ง</button></div>;

  return (
    <div>
      <button type="button" onClick={() => navigate('/admin/users')} style={styles.back}>← กลับไปผู้ใช้งาน</button>
      <header className="ah-admin-page-header" style={styles.header}>
        <div style={styles.identity}><span style={styles.avatar}>{String(user?.student_name || user?.university_email || '?').slice(0, 1)}</span><div><div style={styles.kicker}>USER PROFILE</div><h1 style={styles.title}>{user?.student_name || 'ไม่ระบุชื่อ'}</h1><p style={styles.subtitle}>{user?.university_email || '—'}</p></div></div>
        <div style={styles.headerAction}><StatusBadge status={user?.account_status} />{!isSelf && <button type="button" onClick={() => setConfirming(true)} style={{ ...styles.statusButton, color: suspended ? C.navy : C.pinkDark, borderColor: suspended ? C.lineInput : C.pinkSoft }}>{suspended ? 'เปิดใช้งานบัญชี' : 'ระงับบัญชี'}</button>}</div>
      </header>
      {error && <div role="alert" style={styles.alert}>ดำเนินการไม่สำเร็จ: {error}</div>}
      {isSelf && <div style={styles.notice}>บัญชีของคุณเองไม่สามารถเปลี่ยนสถานะจากหน้านี้ได้</div>}

      <div className="ah-admin-two-col" style={styles.grid}>
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>ข้อมูลบัญชี</h2>
          <dl style={styles.definitionList}>
            <InfoRow label="รหัสผู้ใช้" value={user?.user_id || user?.id} /><InfoRow label="รหัสนักศึกษา" value={user?.student_id} /><InfoRow label="มหาวิทยาลัย" value={user?.university_name} /><InfoRow label="เชื่อมต่อแล้ว" value={providerLabel(user)} /><InfoRow label="เข้าร่วมเมื่อ" value={formatDate(user?.created_at)} /><InfoRow label="เข้าสู่ระบบล่าสุด" value={formatDate(user?.last_login_at)} /><InfoRow label="ใช้งานล่าสุด" value={formatDate(user?.last_seen_at)} />
          </dl>
        </section>
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>สรุปการใช้งาน</h2>
          <div style={styles.usageGrid}><Metric label="รายวิชา" value={usage.course_count ?? user?.course_count} /><Metric label="งานทั้งหมด" value={usage.assignment_count ?? user?.assignment_count} /><Metric label="ยังไม่เริ่ม" value={usage.not_started ?? usage.not_started_count} /><Metric label="กำลังทำ" value={usage.in_progress ?? usage.in_progress_count} /><Metric label="ส่งแล้ว" value={usage.submitted ?? usage.submitted_count} /><Metric label="เสร็จแล้ว" value={usage.completed ?? usage.completed_count} /></div>
        </section>
      </div>

      <div className="ah-admin-two-col" style={styles.grid}>
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>ข้อผิดพลาดล่าสุดของผู้ใช้</h2>
          {recentErrors.length ? <div style={styles.feed}>{recentErrors.slice(0, 8).map((item) => <div key={item.error_id || item.id} style={styles.feedRow}><span style={{ ...styles.level, background: String(item.level).toLowerCase() === 'warn' ? C.amberBg : C.pinkBg, color: String(item.level).toLowerCase() === 'warn' ? C.amber : C.pinkDark }}>{item.level || 'error'}</span><span style={styles.feedCopy}><strong>{item.source || 'application'}</strong><small>{item.message || '—'}</small></span><span style={styles.time}>{formatDate(item.occurred_at || item.created_at)}</span></div>)}</div> : <Empty label="ยังไม่มี error ที่เชื่อมโยงกับผู้ใช้นี้" />}
        </section>
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>ประวัติการจัดการ</h2>
          {audits.length ? <div style={styles.feed}>{audits.slice(0, 8).map((item) => <div key={item.audit_id || item.id} style={styles.feedRow}><span style={styles.auditMark} /><span style={styles.feedCopy}><strong>{item.action || 'ADMIN_ACTION'}</strong><small>{item.admin_name || (item.detail ? JSON.stringify(item.detail) : 'ดำเนินการโดยผู้ดูแลระบบ')}</small></span><span style={styles.time}>{formatDate(item.created_at)}</span></div>)}</div> : <Empty label="ยังไม่มีประวัติการจัดการ" />}
        </section>
      </div>

      {confirming && <div style={styles.backdrop}><section role="dialog" aria-modal="true" aria-labelledby="user-status-title" style={styles.modal}><div style={styles.kicker}>{suspended ? 'ยืนยันการเปิดใช้งาน' : 'ยืนยันการระงับ'}</div><h2 id="user-status-title" style={styles.modalTitle}>{suspended ? `เปิดใช้งาน ${user?.student_name || 'บัญชีนี้'}?` : `ระงับ ${user?.student_name || 'บัญชีนี้'}?`}</h2><p style={styles.modalText}>{suspended ? 'ผู้ใช้จะกลับมาเข้าถึง protected API ได้ตามสิทธิ์บัญชี' : 'ผู้ใช้จะไม่สามารถใช้งาน protected API จนกว่าจะเปิดใช้งานอีกครั้ง'}</p><div style={styles.modalActions}><button type="button" onClick={() => setConfirming(false)} style={styles.cancel} disabled={saving}>ยกเลิก</button><button type="button" onClick={updateStatus} style={{ ...styles.primary, background: suspended ? C.navy : C.pinkDark }} disabled={saving}>{saving ? 'กำลังบันทึก…' : suspended ? 'เปิดใช้งานบัญชี' : 'ระงับบัญชี'}</button></div></section></div>}
    </div>
  );
}

function InfoRow({ label, value }) { return <><dt style={styles.term}>{label}</dt><dd style={styles.definition}>{value || '—'}</dd></>; }
function Metric({ label, value }) { return <div style={styles.metric}><span>{label}</span><strong>{formatNumber(value)}</strong></div>; }
function Empty({ label }) { return <div style={styles.empty}>{label}</div>; }

const styles = {
  loading: { color: C.muted, fontFamily: FONT, fontSize: 13, padding: 30 },
  errorPage: { color: C.body, fontFamily: FONT, padding: 20 },
  back: { border: 0, background: 'transparent', color: C.navy, cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, marginBottom: 15, padding: 0 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18 },
  identity: { display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 },
  avatar: { width: 48, height: 48, display: 'grid', placeItems: 'center', borderRadius: '50%', flexShrink: 0, background: C.navy, color: 'white', fontFamily: FONT, fontSize: 18, fontWeight: 700 },
  kicker: { color: C.pinkDark, fontFamily: FONT, fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em' },
  title: { color: C.ink, fontFamily: FONT, fontSize: 25, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2, margin: '3px 0 0' },
  subtitle: { color: C.muted, fontFamily: FONT, fontSize: 13, margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis' },
  headerAction: { display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  statusButton: { border: '1px solid', borderRadius: R.pill, background: C.card, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 700, padding: '8px 10px', whiteSpace: 'nowrap' },
  alert: { border: `1px solid ${C.pinkSoft}`, borderRadius: R.card, background: C.pinkBg, color: C.pinkDark, fontFamily: FONT, fontSize: 13, marginBottom: 12, padding: '10px 13px' },
  notice: { borderRadius: R.card, background: C.amberBg, color: C.amber, fontFamily: FONT, fontSize: 12.5, marginBottom: 12, padding: '10px 13px' },
  grid: { marginTop: 16 },
  card: { minWidth: 0, borderRadius: R.card, background: C.card, padding: 20 },
  cardTitle: { color: C.ink, fontFamily: FONT, fontSize: 14.5, fontWeight: 700, margin: '0 0 13px' },
  definitionList: { display: 'grid', gridTemplateColumns: 'minmax(110px, .8fr) minmax(0, 1.2fr)', columnGap: 12, margin: 0 },
  term: { borderTop: `1px solid ${C.line}`, color: C.muted, fontFamily: FONT, fontSize: 12, padding: '9px 0' },
  definition: { borderTop: `1px solid ${C.line}`, color: C.body, fontFamily: FONT, fontSize: 12.5, margin: 0, overflow: 'hidden', padding: '9px 0', textAlign: 'right', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  usageGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 },
  metric: { display: 'flex', flexDirection: 'column', gap: 4, borderRadius: 7, background: C.pageBg, color: C.muted, fontFamily: FONT, fontSize: 11.5, padding: '10px 9px' },
  feed: { borderTop: `1px solid ${C.line}` },
  feedRow: { display: 'flex', alignItems: 'center', gap: 9, borderBottom: `1px solid ${C.line}`, padding: '9px 0' },
  level: { borderRadius: 99, flexShrink: 0, fontFamily: FONT, fontSize: 10, fontWeight: 700, padding: '3px 6px', textTransform: 'uppercase' },
  auditMark: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: C.navyMid },
  feedCopy: { display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0 },
  time: { color: C.mutedSoft, flexShrink: 0, fontFamily: FONT, fontSize: 10.5, textAlign: 'right' },
  empty: { color: C.muted, fontFamily: FONT, fontSize: 12.5, padding: '32px 0', textAlign: 'center' },
  backdrop: { position: 'fixed', inset: 0, zIndex: 40, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(20,40,63,.38)' },
  modal: { width: 'min(430px, 100%)', borderRadius: 12, background: C.card, boxShadow: '0 22px 60px rgba(20,40,63,.24)', fontFamily: FONT, padding: '25px 25px 21px' },
  modalTitle: { color: C.ink, fontFamily: FONT, fontSize: 20, lineHeight: 1.3, margin: '6px 0 7px' },
  modalText: { color: C.body, fontFamily: FONT, fontSize: 13, lineHeight: 1.65, margin: 0 },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 21 },
  cancel: { border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.ink, cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, padding: '8px 13px' },
  primary: { border: 0, borderRadius: R.pill, background: C.navy, color: 'white', cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, padding: '8px 13px' },
};

export default AdminUserDetailPage;
