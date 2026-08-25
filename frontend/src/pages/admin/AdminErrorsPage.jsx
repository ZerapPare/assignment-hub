import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ErrorTable, { SeverityBadge } from '../../components/admin/ErrorTable';
import { adminRequest, formatDate, listFrom, paginationFrom } from '../../components/admin/adminApi';
import { C, FONT, R } from '../../theme';

const PAGE_SIZE = 50;

function AdminErrorsPage() {
  const [params, setParams] = useSearchParams();
  const [errors, setErrors] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copyNotice, setCopyNotice] = useState('');

  const level = params.get('level') || '';
  const source = params.get('source') || '';
  const status = params.get('status') || '';
  const search = params.get('search') || '';
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const queryKey = params.toString();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      [['level', level], ['source', source], ['status', status], ['search', search], ['from', from], ['to', to]].forEach(([key, value]) => { if (value) query.set(key, value); });
      const payload = await adminRequest(`/api/admin/errors?${query.toString()}`);
      setErrors(listFrom(payload, ['errors', 'items', 'data']));
      setPagination(paginationFrom(payload, page, PAGE_SIZE));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [from, level, page, search, source, status, to]);

  useEffect(() => { load(); }, [load, queryKey]);

  const setFilter = (values) => {
    const query = new URLSearchParams(params);
    Object.entries(values).forEach(([key, value]) => { if (value) query.set(key, value); else query.delete(key); });
    if (!Object.prototype.hasOwnProperty.call(values, 'page')) query.set('page', '1');
    setParams(query);
  };

  const openDetail = async (id) => {
    setDetailLoading(true);
    setSelected({ id });
    try {
      setSelected(await adminRequest(`/api/admin/errors/${id}`));
    } catch (err) {
      setSelected({ id, loadError: err.message });
    } finally {
      setDetailLoading(false);
    }
  };

  const copyRequestId = async (requestId) => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(requestId);
      else {
        const input = document.createElement('textarea');
        input.value = requestId;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      setCopyNotice(`คัดลอก Request ID ${requestId} แล้ว`);
    } catch (_err) {
      setCopyNotice('ไม่สามารถคัดลอก Request ID ได้');
    }
    window.setTimeout(() => setCopyNotice(''), 2400);
  };

  return (
    <div>
      <header className="ah-admin-page-header" style={styles.header}>
        <div><div style={styles.kicker}>INCIDENT EXPLORER</div><h1 style={styles.title}>บันทึกข้อผิดพลาด</h1><p style={styles.subtitle}>ค้นหาจากข้อความ Request ID หรือบริบทของ endpoint</p></div>
        <div style={styles.total}>{pagination.total.toLocaleString('en-US')} เหตุการณ์</div>
      </header>

      <div className="ah-admin-filter-row" style={styles.filters}>
        <input value={search} onChange={(event) => setFilter({ search: event.target.value })} placeholder="ค้นหาข้อความหรือ Request ID" aria-label="ค้นหาข้อผิดพลาด" style={styles.search} />
        <select value={level} onChange={(event) => setFilter({ level: event.target.value })} style={styles.select} aria-label="กรองระดับ"><option value="">ทุกระดับ</option><option value="error">Error</option><option value="warn">Warning</option></select>
        <input value={source} onChange={(event) => setFilter({ source: event.target.value })} placeholder="แหล่งที่มา" aria-label="กรองแหล่งที่มา" style={styles.source} />
        <select value={status} onChange={(event) => setFilter({ status: event.target.value })} style={styles.select} aria-label="กรองสถานะ HTTP"><option value="">ทุกสถานะ</option><option value="500">500</option><option value="502">502</option><option value="503">503</option><option value="504">504</option></select>
        <label style={styles.dateLabel}>จาก<input type="date" value={from} onChange={(event) => setFilter({ from: event.target.value })} style={styles.date} /></label>
        <label style={styles.dateLabel}>ถึง<input type="date" value={to} onChange={(event) => setFilter({ to: event.target.value })} style={styles.date} /></label>
        <button type="button" onClick={() => setParams({})} style={styles.clear}>ล้างตัวกรอง</button>
      </div>

      {copyNotice && <div role="status" style={styles.copyNotice}>{copyNotice}</div>}
      {error && <div role="alert" style={styles.alert}>โหลด Error Logs ไม่สำเร็จ: {error} <button type="button" onClick={load} style={styles.linkButton}>ลองอีกครั้ง</button></div>}

      <section style={styles.card}>{loading ? <div style={styles.loading}>กำลังโหลด Error Logs…</div> : <ErrorTable errors={errors} onOpen={openDetail} onCopy={copyRequestId} />}<Pagination pagination={pagination} onPage={(next) => setFilter({ page: String(next) })} /></section>

      {selected && <ErrorDetail detail={selected} loading={detailLoading} onClose={() => setSelected(null)} onCopy={copyRequestId} />}
    </div>
  );
}

function ErrorDetail({ detail, loading, onClose, onCopy }) {
  const item = detail?.error || detail;
  const metadata = item?.metadata;
  return <div style={styles.drawerBackdrop} onMouseDown={onClose}><aside role="dialog" aria-modal="true" aria-labelledby="error-detail-title" style={styles.drawer} onMouseDown={(event) => event.stopPropagation()}><div style={styles.drawerHead}><div><div style={styles.kicker}>ERROR DETAIL</div><h2 id="error-detail-title" style={styles.drawerTitle}>{loading ? 'กำลังโหลด…' : item?.source || 'ข้อผิดพลาด'}</h2></div><button type="button" onClick={onClose} style={styles.close}>ปิด</button></div>{item?.loadError ? <div style={styles.alert}>โหลดรายละเอียดไม่สำเร็จ: {item.loadError}</div> : loading ? <div style={styles.loading}>กำลังโหลดรายละเอียด…</div> : <div><div style={styles.detailIntro}><SeverityBadge level={item?.level} /><span>{formatDate(item?.occurred_at || item?.created_at)}</span></div><dl style={styles.definitionList}><DetailRow label="Endpoint" value={item?.path ? `${item.method || ''} ${item.path}`.trim() : '—'} /><DetailRow label="HTTP status" value={item?.status_code || item?.status} /><DetailRow label="Error code" value={item?.error_code} /><DetailRow label="ผู้ใช้" value={item?.student_name || item?.university_email || item?.user_id} /></dl><div style={styles.messageBlock}><div style={styles.blockLabel}>ข้อความ</div><p>{item?.message || '—'}</p></div><div style={styles.requestRow}><div><div style={styles.blockLabel}>Request ID</div><code style={styles.requestId}>{item?.request_id || '—'}</code></div>{item?.request_id && <button type="button" onClick={() => onCopy(item.request_id)} style={styles.copyButton}>คัดลอก</button>}</div>{metadata && <div style={styles.metadata}><div style={styles.blockLabel}>Sanitized metadata</div><pre>{typeof metadata === 'string' ? metadata : JSON.stringify(metadata, null, 2)}</pre></div>}</div>}</aside></div>;
}

function DetailRow({ label, value }) { return <><dt style={styles.term}>{label}</dt><dd style={styles.definition}>{value || '—'}</dd></>; }
function Pagination({ pagination, onPage }) { const { page, totalPages, total } = pagination; if (!total && page === 1) return null; return <footer style={styles.pagination}><span>หน้า {page} จาก {totalPages} · {total.toLocaleString('en-US')} รายการ</span><div style={styles.pageButtons}><button type="button" style={styles.pageButton} disabled={page <= 1} onClick={() => onPage(page - 1)}>ก่อนหน้า</button><button type="button" style={styles.pageButton} disabled={page >= totalPages} onClick={() => onPage(page + 1)}>ถัดไป</button></div></footer>; }

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 19 },
  kicker: { color: C.pinkDark, fontFamily: FONT, fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em' },
  title: { color: C.ink, fontFamily: FONT, fontSize: 25, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2, margin: '3px 0 0' },
  subtitle: { color: C.muted, fontFamily: FONT, fontSize: 13, margin: '4px 0 0' },
  total: { borderRadius: 99, background: C.indigoBg, color: C.navy, fontFamily: FONT, fontSize: 12, fontWeight: 700, padding: '7px 10px', whiteSpace: 'nowrap' },
  filters: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
  search: { minWidth: 270, flex: '1 1 280px', border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.ink, fontFamily: FONT, fontSize: 13, outlineColor: C.navy, padding: '9px 12px' },
  source: { width: 132, border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.ink, fontFamily: FONT, fontSize: 12.5, outlineColor: C.navy, padding: '9px 10px' },
  select: { border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.ink, fontFamily: FONT, fontSize: 12.5, padding: '9px 10px' },
  dateLabel: { display: 'flex', alignItems: 'center', gap: 4, color: C.muted, fontFamily: FONT, fontSize: 11.5 },
  date: { width: 126, border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.ink, fontFamily: FONT, fontSize: 11.5, padding: '8px 8px' },
  clear: { border: 0, background: 'transparent', color: C.navy, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 700, padding: '8px 5px', whiteSpace: 'nowrap' },
  copyNotice: { borderRadius: R.card, background: C.greenBg, color: C.green, fontFamily: FONT, fontSize: 12.5, fontWeight: 700, marginBottom: 12, padding: '9px 12px' },
  alert: { border: `1px solid ${C.pinkSoft}`, borderRadius: R.card, background: C.pinkBg, color: C.pinkDark, fontFamily: FONT, fontSize: 13, lineHeight: 1.5, marginBottom: 14, padding: '10px 13px' },
  linkButton: { border: 0, background: 'transparent', color: C.navy, cursor: 'pointer', fontFamily: FONT, fontWeight: 700, padding: 0 },
  card: { overflow: 'hidden', borderRadius: R.card, background: C.card },
  loading: { color: C.muted, fontFamily: FONT, fontSize: 13, padding: '45px 20px', textAlign: 'center' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTop: `1px solid ${C.line}`, color: C.muted, fontFamily: FONT, fontSize: 11.5, padding: '11px 13px' },
  pageButtons: { display: 'flex', gap: 6 },
  pageButton: { border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.navy, cursor: 'pointer', fontFamily: FONT, fontSize: 11.5, fontWeight: 700, padding: '6px 9px' },
  drawerBackdrop: { position: 'fixed', inset: 0, zIndex: 35, display: 'flex', justifyContent: 'flex-end', background: 'rgba(20,40,63,.3)' },
  drawer: { width: 'min(500px, 100%)', minHeight: '100%', overflowY: 'auto', background: C.card, boxShadow: '-18px 0 44px rgba(20,40,63,.16)', fontFamily: FONT, padding: '24px 23px' },
  drawerHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 },
  drawerTitle: { color: C.ink, fontFamily: FONT, fontSize: 21, lineHeight: 1.3, margin: '4px 0 0' },
  close: { border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.navy, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 700, padding: '7px 10px' },
  detailIntro: { display: 'flex', alignItems: 'center', gap: 9, color: C.muted, fontFamily: FONT, fontSize: 12, marginBottom: 13 },
  definitionList: { display: 'grid', gridTemplateColumns: '105px minmax(0, 1fr)', columnGap: 12, margin: 0 },
  term: { borderTop: `1px solid ${C.line}`, color: C.muted, fontFamily: FONT, fontSize: 11.5, padding: '9px 0' },
  definition: { borderTop: `1px solid ${C.line}`, color: C.body, fontFamily: FONT, fontSize: 12.5, margin: 0, overflowWrap: 'anywhere', padding: '9px 0', textAlign: 'right' },
  messageBlock: { borderTop: `1px solid ${C.line}`, color: C.body, fontFamily: FONT, fontSize: 13, lineHeight: 1.6, marginTop: 7, paddingTop: 13 },
  blockLabel: { color: C.muted, fontFamily: FONT, fontSize: 11.5, fontWeight: 700, marginBottom: 5 },
  requestRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTop: `1px solid ${C.line}`, marginTop: 15, paddingTop: 13 },
  requestId: { color: C.navy, fontFamily: 'monospace', fontSize: 12, overflowWrap: 'anywhere' },
  copyButton: { border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.navy, cursor: 'copy', flexShrink: 0, fontFamily: FONT, fontSize: 12, fontWeight: 700, padding: '7px 10px' },
  metadata: { marginTop: 17 },
};

export default AdminErrorsPage;
