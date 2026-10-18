import React, { useCallback, useEffect, useState } from 'react';
import { adminRequest } from '../../components/admin/adminApi';
import { C, FONT, R } from '../../theme';

const EMPTY_FORM = { title: '', linkUrl: '', isActive: true, image: null };

function describeAdError(err) {
  if (err.status === 401) return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่';
  if (err.status === 403) return 'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบสำหรับจัดการโฆษณา';
  if (err.status === 413) return 'รูปภาพมีขนาดใหญ่เกินกำหนด (สูงสุด 5 MB)';
  if (err.status >= 500) {
    const requestId = err.payload?.request_id;
    return requestId
      ? `เซิร์ฟเวอร์จัดการโฆษณาไม่สำเร็จ (รหัสคำขอ ${requestId}) กรุณาตรวจ log ของ backend`
      : 'เซิร์ฟเวอร์จัดการโฆษณาไม่สำเร็จ กรุณาตรวจ log ของ backend';
  }
  return err.message;
}

function AdminAdsPage() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadAds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminRequest('/api/admin/ads');
      setAds(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(describeAdError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAds(); }, [loadAds]);

  const startCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
  };

  const startEdit = (ad) => {
    setEditing(ad);
    setForm({ title: ad.title, linkUrl: ad.linkUrl, isActive: ad.isActive, image: null });
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const body = new FormData();
    body.set('title', form.title);
    body.set('linkUrl', form.linkUrl);
    body.set('isActive', String(form.isActive));
    if (form.image) body.set('image', form.image);

    try {
      const saved = await adminRequest(
        editing ? `/api/admin/ads/${editing.id}` : '/api/admin/ads',
        { method: editing ? 'PATCH' : 'POST', body }
      );
      if (editing) {
        setAds((current) => current.map((ad) => ad.id === editing.id ? saved : ad));
      } else {
        setAds((current) => [saved, ...current]);
      }
      startCreate();
    } catch (err) {
      setError(describeAdError(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (ad) => {
    setError(null);
    try {
      const updated = await adminRequest(`/api/admin/ads/${ad.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !ad.isActive }),
      });
      setAds((current) => current.map((item) => item.id === ad.id ? updated : item));
    } catch (err) {
      setError(describeAdError(err));
    }
  };

  const removeAd = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await adminRequest(`/api/admin/ads/${deleteTarget.id}`, { method: 'DELETE' });
      setAds((current) => current.filter((item) => item.id !== deleteTarget.id));
      if (editing?.id === deleteTarget.id) startCreate();
      setDeleteTarget(null);
    } catch (err) {
      setError(describeAdError(err));
    }
    finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <header className="ah-admin-page-header" style={styles.header}>
        <div>
          <div style={styles.kicker}>ADVERTISEMENT MANAGEMENT</div>
          <h1 style={styles.title}>จัดการโฆษณา</h1>
          <p style={styles.subtitle}>เพิ่มชื่อ รูปภาพ และลิงก์โฆษณาเพื่อแสดงเมื่อผู้ใช้ซิงก์งานหรือจัดตารางงาน</p>
        </div>
      </header>

      {error && <div role="alert" style={styles.error}>ดำเนินการไม่สำเร็จ: {error}</div>}

      <section style={styles.formCard}>
        <h2 style={styles.sectionTitle}>{editing ? 'แก้ไขโฆษณา' : 'เพิ่มโฆษณาใหม่'}</h2>
        <form onSubmit={save} style={styles.form}>
          <label style={styles.label}>
            ชื่อโฆษณา
            <input
              required
              maxLength={160}
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            ลิงก์ปลายทาง
            <input
              required
              type="url"
              maxLength={2048}
              placeholder="https://example.com"
              value={form.linkUrl}
              onChange={(event) => setForm((current) => ({ ...current, linkUrl: event.target.value }))}
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            รูปภาพ {editing && '(ไม่เลือกเพื่อใช้รูปเดิม)'}
            <input
              required={!editing}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setForm((current) => ({ ...current, image: event.target.files?.[0] || null }))}
              style={styles.fileInput}
            />
            <span style={styles.hint}>รองรับ JPEG, PNG หรือ WebP ขนาดไม่เกิน 5 MB</span>
          </label>
          <label style={styles.checkLabel}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            เปิดใช้งานและสุ่มแสดงให้ผู้ใช้
          </label>
          <div style={styles.formActions}>
            {editing && <button type="button" onClick={startCreate} style={styles.secondaryButton}>ยกเลิกแก้ไข</button>}
            <button type="submit" disabled={saving} style={styles.primaryButton}>
              {saving ? 'กำลังบันทึก…' : editing ? 'บันทึกการแก้ไข' : 'เพิ่มโฆษณา'}
            </button>
          </div>
        </form>
      </section>

      <section style={styles.listCard}>
        <div style={styles.listHeader}>
          <h2 style={styles.sectionTitle}>รายการโฆษณา</h2>
          <span style={styles.count}>{ads.length} รายการ</span>
        </div>
        {loading ? <p style={styles.empty}>กำลังโหลดรายการโฆษณา…</p> : ads.length === 0 ? (
          <p style={styles.empty}>ยังไม่มีโฆษณา เพิ่มรายการแรกได้จากแบบฟอร์มด้านบน</p>
        ) : (
          <div style={styles.list}>
            {ads.map((ad) => (
              <article key={ad.id} style={styles.adRow}>
                <img src={ad.imageUrl} alt="" style={styles.preview} />
                <div style={styles.adInfo}>
                  <strong style={styles.adTitle}>{ad.title}</strong>
                  <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>{ad.linkUrl}</a>
                  <span style={{ ...styles.status, color: ad.isActive ? C.green : C.muted, background: ad.isActive ? C.greenBg : C.pageBg }}>
                    {ad.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </span>
                </div>
                <div style={styles.rowActions}>
                  <button type="button" onClick={() => toggleActive(ad)} style={styles.secondaryButton}>
                    {ad.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  </button>
                  <button type="button" onClick={() => startEdit(ad)} style={styles.secondaryButton}>แก้ไข</button>
                  <button type="button" onClick={() => setDeleteTarget(ad)} style={styles.deleteButton}>ลบ</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {deleteTarget && (
        <div
          role="presentation"
          style={styles.modalBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) setDeleteTarget(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !deleting) setDeleteTarget(null);
          }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="delete-ad-title" style={styles.deleteModal}>
            <div style={styles.deleteIcon} aria-hidden="true">!</div>
            <div style={styles.modalKicker}>ยืนยันการลบโฆษณา</div>
            <h2 id="delete-ad-title" style={styles.modalTitle}>ต้องการลบโฆษณานี้หรือไม่?</h2>
            <p style={styles.modalText}>โฆษณา <strong style={styles.deleteName}>“{deleteTarget.title}”</strong> จะถูกลบและไม่สามารถกู้คืนได้</p>
            <div style={styles.modalActions}>
              <button type="button" autoFocus onClick={() => setDeleteTarget(null)} disabled={deleting} style={styles.cancelButton}>ยกเลิก</button>
              <button type="button" onClick={removeAd} disabled={deleting} style={styles.confirmDeleteButton}>
                {deleting ? 'กำลังลบ…' : 'ลบโฆษณา'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 19 },
  kicker: { color: C.pinkDark, fontFamily: FONT, fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em' },
  title: { color: C.ink, fontFamily: FONT, fontSize: 25, fontWeight: 700, margin: '3px 0 0' },
  subtitle: { color: C.muted, fontFamily: FONT, fontSize: 13, margin: '4px 0 0' },
  formCard: { background: C.card, border: `1px solid ${C.line}`, borderRadius: R.card, padding: 20, marginBottom: 18 },
  sectionTitle: { color: C.ink, fontFamily: FONT, fontSize: 16, margin: 0 },
  form: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 16 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, color: C.ink, fontFamily: FONT, fontSize: 12.5, fontWeight: 600 },
  input: { width: '100%', boxSizing: 'border-box', border: `1px solid ${C.lineInput}`, borderRadius: 8, padding: '10px 11px', fontFamily: FONT, fontSize: 13 },
  fileInput: { width: '100%', boxSizing: 'border-box', fontFamily: FONT, fontSize: 12 },
  hint: { color: C.muted, fontSize: 11, fontWeight: 400 },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 8, color: C.ink, fontFamily: FONT, fontSize: 12.5 },
  formActions: { gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  primaryButton: { border: 0, borderRadius: R.pill, background: C.navy, color: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, padding: '10px 16px', whiteSpace: 'nowrap' },
  secondaryButton: { border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.navy, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 600, padding: '8px 12px', whiteSpace: 'nowrap' },
  deleteButton: { border: `1px solid ${C.pinkDark}`, borderRadius: R.pill, background: C.card, color: C.pinkDark, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 600, padding: '8px 12px' },
  error: { background: C.pinkBg, border: `1px solid ${C.pinkDark}`, borderRadius: 8, color: C.pinkDark, fontFamily: FONT, fontSize: 13, marginBottom: 16, padding: 12 },
  listCard: { background: C.card, border: `1px solid ${C.line}`, borderRadius: R.card, padding: 20 },
  listHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  count: { color: C.muted, fontFamily: FONT, fontSize: 12 },
  empty: { color: C.muted, fontFamily: FONT, fontSize: 13, padding: '14px 0', textAlign: 'center' },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  adRow: { display: 'flex', alignItems: 'center', gap: 14, borderTop: `1px solid ${C.line}`, padding: '13px 0' },
  preview: { width: 100, height: 68, flexShrink: 0, objectFit: 'cover', borderRadius: 8, background: C.pageBg },
  adInfo: { display: 'flex', minWidth: 0, flex: 1, flexDirection: 'column', alignItems: 'flex-start', gap: 4 },
  adTitle: { color: C.ink, fontFamily: FONT, fontSize: 13 },
  link: { color: C.navy, fontFamily: FONT, fontSize: 11, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  status: { borderRadius: 99, fontFamily: FONT, fontSize: 10.5, fontWeight: 700, marginTop: 3, padding: '3px 8px' },
  rowActions: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  modalBackdrop: { position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(20,40,63,.48)', backdropFilter: 'blur(3px)' },
  deleteModal: { width: 'min(420px, 100%)', boxSizing: 'border-box', border: `1px solid ${C.line}`, borderRadius: 18, background: C.card, boxShadow: '0 24px 70px rgba(20,40,63,.28)', fontFamily: FONT, padding: '30px 28px 24px', textAlign: 'center' },
  deleteIcon: { display: 'grid', placeItems: 'center', width: 48, height: 48, margin: '0 auto 15px', borderRadius: '50%', background: C.pinkBg, color: C.pinkDark, fontFamily: 'sans-serif', fontSize: 26, fontWeight: 700 },
  modalKicker: { color: C.pinkDark, fontSize: 11, fontWeight: 700, letterSpacing: '.06em' },
  modalTitle: { color: C.ink, fontSize: 19, lineHeight: 1.4, margin: '7px 0 9px' },
  modalText: { color: C.body, fontSize: 13, lineHeight: 1.7, margin: 0, overflowWrap: 'anywhere' },
  deleteName: { color: C.ink, fontWeight: 700 },
  modalActions: { display: 'flex', justifyContent: 'center', gap: 10, marginTop: 24 },
  cancelButton: { border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.navy, cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, padding: '9px 18px' },
  confirmDeleteButton: { border: 0, borderRadius: R.pill, background: C.pinkDark, color: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, padding: '9px 18px' },
};

export default AdminAdsPage;
