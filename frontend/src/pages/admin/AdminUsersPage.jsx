import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import UserTable from '../../components/admin/UserTable';
import { adminRequest, listFrom, paginationFrom } from '../../components/admin/adminApi';
import { C, FONT, R } from '../../theme';

const PAGE_SIZE = 25;

function AdminUsersPage() {
  const navigate = useNavigate();
  const { admin } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [target, setTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const search = params.get('search') || '';
  const status = params.get('status') || '';
  const provider = params.get('provider') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const queryKey = params.toString();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) query.set('search', search);
      if (status) query.set('status', status);
      if (provider) query.set('provider', provider);
      const payload = await adminRequest(`/api/admin/users?${query.toString()}`);
      setUsers(listFrom(payload, ['users', 'items', 'data']));
      setPagination(paginationFrom(payload, page, PAGE_SIZE));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, provider, search, status]);

  useEffect(() => { load(); }, [load, queryKey]);

  const setFilter = (next) => {
    const value = typeof next === 'function' ? next(Object.fromEntries(params)) : next;
    const query = new URLSearchParams(params);
    Object.entries(value).forEach(([key, item]) => {
      if (item) query.set(key, item);
      else query.delete(key);
    });
    if (!Object.prototype.hasOwnProperty.call(value, 'page')) query.set('page', '1');
    setParams(query);
  };

  const confirmStatus = async () => {
    if (!target) return;
    const id = target.user_id || target.id;
    const nextStatus = target.account_status === 'suspended' ? 'active' : 'suspended';
    setSaving(true);
    try {
      const updated = await adminRequest(`/api/admin/users/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      setUsers((current) => current.map((user) => String(user.user_id || user.id) === String(id) ? { ...user, account_status: updated.account_status || updated.user?.account_status || nextStatus } : user));
      setTarget(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const targetName = target?.student_name || target?.university_email || 'ผู้ใช้นี้';
  const suspending = target?.account_status !== 'suspended';

  return (
    <div>
      <header className="ah-admin-page-header" style={styles.header}>
        <div><div style={styles.kicker}>ACCOUNT DIRECTORY</div><h1 style={styles.title}>ผู้ใช้งาน</h1><p style={styles.subtitle}>ค้นหา ตรวจสอบ และจัดการสถานะบัญชีโดยไม่ลบข้อมูล</p></div>
        <div style={styles.total}>{pagination.total.toLocaleString('en-US')} บัญชี</div>
      </header>

      <div className="ah-admin-filter-row" style={styles.filters}>
        <input value={search} onChange={(event) => setFilter({ search: event.target.value })} placeholder="ค้นหาชื่อ อีเมล หรือรหัสนักศึกษา" aria-label="ค้นหาผู้ใช้" style={styles.search} />
        <select value={status} onChange={(event) => setFilter({ status: event.target.value })} style={styles.select} aria-label="กรองสถานะ"><option value="">ทุกสถานะ</option><option value="active">ใช้งานอยู่</option><option value="suspended">ระงับแล้ว</option></select>
        <select value={provider} onChange={(event) => setFilter({ provider: event.target.value })} style={styles.select} aria-label="กรองผู้ให้บริการ"><option value="">ทุกการเชื่อมต่อ</option><option value="google">Google</option><option value="microsoft">Microsoft</option></select>
        <button type="button" onClick={() => setParams({})} style={styles.clear}>ล้างตัวกรอง</button>
      </div>

      {error && <div role="alert" style={styles.alert}>ดำเนินการไม่สำเร็จ: {error} <button type="button" onClick={load} style={styles.linkButton}>ลองอีกครั้ง</button></div>}

      <section style={styles.card}>
        {loading ? <div style={styles.loading}>กำลังโหลดรายชื่อผู้ใช้…</div> : <UserTable users={users} currentUserId={admin?.user_id} onOpen={(id) => navigate(`/admin/users/${id}`)} onChangeStatus={setTarget} />}
        <Pagination pagination={pagination} onPage={(nextPage) => setFilter({ page: String(nextPage) })} />
      </section>

      {target && <div style={styles.modalBackdrop} role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="status-dialog-title" style={styles.modal}><div style={styles.modalKicker}>{suspending ? 'ยืนยันการระงับบัญชี' : 'ยืนยันการเปิดใช้งานบัญชี'}</div><h2 id="status-dialog-title" style={styles.modalTitle}>{suspending ? `ระงับ ${targetName}?` : `เปิดใช้งาน ${targetName}?`}</h2><p style={styles.modalText}>{suspending ? 'ผู้ใช้นี้จะไม่สามารถใช้ protected API จนกว่าจะเปิดใช้งานอีกครั้ง' : 'ผู้ใช้นี้จะกลับมาใช้ protected API ได้ตามสิทธิ์ของบัญชี'}</p><p style={styles.targetEmail}>{target.university_email || target.student_id || '—'}</p><div style={styles.modalActions}><button type="button" onClick={() => setTarget(null)} disabled={saving} style={styles.cancel}>ยกเลิก</button><button type="button" onClick={confirmStatus} disabled={saving} style={{ ...styles.confirm, background: suspending ? C.pinkDark : C.navy }}>{saving ? 'กำลังบันทึก…' : suspending ? 'ระงับบัญชี' : 'เปิดใช้งานบัญชี'}</button></div></section></div>}
    </div>
  );
}

function Pagination({ pagination, onPage }) {
  const { page, totalPages, total } = pagination;
  if (!total && page === 1) return null;
  return <footer style={styles.pagination}><span>หน้า {page} จาก {totalPages} · {total.toLocaleString('en-US')} รายการ</span><div style={styles.pageButtons}><button type="button" style={styles.pageButton} disabled={page <= 1} onClick={() => onPage(page - 1)}>ก่อนหน้า</button><button type="button" style={styles.pageButton} disabled={page >= totalPages} onClick={() => onPage(page + 1)}>ถัดไป</button></div></footer>;
}

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 19 },
  kicker: { color: C.pinkDark, fontFamily: FONT, fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em' },
  title: { color: C.ink, fontFamily: FONT, fontSize: 25, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2, margin: '3px 0 0' },
  subtitle: { color: C.muted, fontFamily: FONT, fontSize: 13, margin: '4px 0 0' },
  total: { borderRadius: 99, background: C.indigoBg, color: C.navy, fontFamily: FONT, fontSize: 12, fontWeight: 700, padding: '7px 10px', whiteSpace: 'nowrap' },
  filters: { display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 14 },
  search: { minWidth: 280, flex: '1 1 300px', border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.ink, fontFamily: FONT, fontSize: 13, outlineColor: C.navy, padding: '9px 12px' },
  select: { border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.ink, fontFamily: FONT, fontSize: 12.5, padding: '9px 11px' },
  clear: { border: 0, background: 'transparent', color: C.navy, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 700, padding: '8px 5px', whiteSpace: 'nowrap' },
  alert: { background: C.pinkBg, border: `1px solid ${C.pinkSoft}`, borderRadius: R.card, color: C.pinkDark, fontFamily: FONT, fontSize: 13, lineHeight: 1.5, marginBottom: 14, padding: '10px 13px' },
  linkButton: { border: 0, background: 'transparent', color: C.navy, cursor: 'pointer', fontFamily: FONT, fontWeight: 700, padding: 0 },
  card: { overflow: 'hidden', borderRadius: R.card, background: C.card },
  loading: { color: C.muted, fontFamily: FONT, fontSize: 13, padding: '45px 20px', textAlign: 'center' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTop: `1px solid ${C.line}`, color: C.muted, fontFamily: FONT, fontSize: 11.5, padding: '11px 13px' },
  pageButtons: { display: 'flex', gap: 6 },
  pageButton: { border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.navy, cursor: 'pointer', fontFamily: FONT, fontSize: 11.5, fontWeight: 700, padding: '6px 9px' },
  modalBackdrop: { position: 'fixed', inset: 0, zIndex: 40, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(20,40,63,.38)' },
  modal: { width: 'min(440px, 100%)', borderRadius: 12, background: C.card, boxShadow: '0 22px 60px rgba(20,40,63,.24)', fontFamily: FONT, padding: '25px 25px 21px' },
  modalKicker: { color: C.pinkDark, fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em' },
  modalTitle: { color: C.ink, fontSize: 20, lineHeight: 1.3, margin: '6px 0 7px' },
  modalText: { color: C.body, fontSize: 13, lineHeight: 1.65, margin: 0 },
  targetEmail: { color: C.muted, fontSize: 12, margin: '8px 0 0' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 21 },
  cancel: { border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.ink, cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, padding: '8px 13px' },
  confirm: { border: 0, borderRadius: R.pill, color: 'white', cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, padding: '8px 13px' },
};

export default AdminUsersPage;
