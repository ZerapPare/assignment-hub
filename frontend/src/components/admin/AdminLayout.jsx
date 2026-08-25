import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { C, FONT, R } from '../../theme';
import AdminSidebar from './AdminSidebar';
import { adminRequest } from './adminApi';

const RESPONSIVE_CSS = `
  .ah-admin-main { flex: 1; min-width: 0; padding: 26px 28px 44px; }
  .ah-admin-mobile-bar { display: none; }
  .ah-admin-overlay { display: none; }
  .ah-admin-grid-6 { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
  .ah-admin-two-col { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(280px, .95fr); gap: 16px; }
  .ah-admin-table-wrap { overflow-x: auto; }
  @media (max-width: 1180px) { .ah-admin-grid-6 { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 900px) {
    .ah-admin-two-col { grid-template-columns: 1fr; }
    .ah-admin-sidebar { position: fixed; inset: 0 auto 0 0; transform: translateX(-104%); transition: transform .18s ease; box-shadow: 20px 0 42px rgba(20,40,63,.14); }
    .ah-admin-sidebar.is-open { transform: translateX(0); }
    .ah-admin-overlay { display: block; position: fixed; inset: 0; border: 0; padding: 0; background: rgba(20,40,63,.28); z-index: 15; }
    .ah-admin-mobile-bar { display: flex; align-items: center; justify-content: space-between; margin: -8px 0 18px; }
  }
  @media (max-width: 640px) {
    .ah-admin-main { padding: 19px 15px 32px; }
    .ah-admin-grid-6 { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .ah-admin-page-header { align-items: flex-start !important; flex-direction: column; }
    .ah-admin-filter-row { align-items: stretch !important; flex-direction: column; }
    .ah-admin-filter-row > * { width: 100%; }
    .ah-admin-hide-mobile { display: none !important; }
  }
  @media (prefers-reduced-motion: reduce) { .ah-admin-sidebar, .ah-admin-nav-link { transition: none !important; } }
`;

function AccessMessage({ title, detail, action }) {
  return (
    <div style={styles.accessPage}>
      <div style={styles.accessCard}>
        <div style={styles.accessKicker}>ASSIGNMENT HUB</div>
        <h1 style={styles.accessTitle}>{title}</h1>
        <p style={styles.accessDetail}>{detail}</p>
        {action}
      </div>
    </div>
  );
}

function AdminLayout() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await adminRequest('/api/me');
      setAdmin(me);
    } catch (err) {
      if (err.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { loadAdmin(); }, [loadAdmin]);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      navigate('/login');
    }
  };

  if (loading) return <AccessMessage title="กำลังตรวจสอบสิทธิ์" detail="กำลังโหลดพื้นที่ผู้ดูแลระบบ…" />;
  if (error === 'account suspended') {
    return <AccessMessage title="บัญชีนี้ถูกระงับ" detail="บัญชีผู้ดูแลนี้ไม่สามารถเข้าถึงระบบได้ในขณะนี้" action={<button type="button" onClick={logout} style={styles.primaryButton}>ออกจากระบบ</button>} />;
  }
  if (error === 'forbidden') {
    return <AccessMessage title="ไม่มีสิทธิ์เข้าถึง" detail="หน้านี้สงวนไว้สำหรับผู้ดูแลระบบเท่านั้น" action={<Navigate to="/home" replace />} />;
  }
  if (error) {
    return <AccessMessage title="เปิดพื้นที่ผู้ดูแลไม่ได้" detail={error} action={<button type="button" onClick={loadAdmin} style={styles.primaryButton}>ลองอีกครั้ง</button>} />;
  }
  if (admin?.account_status === 'suspended') {
    return <AccessMessage title="บัญชีนี้ถูกระงับ" detail="บัญชีผู้ดูแลนี้ไม่สามารถเข้าถึงระบบได้ในขณะนี้" action={<button type="button" onClick={logout} style={styles.primaryButton}>ออกจากระบบ</button>} />;
  }
  if (admin?.role !== 'admin') {
    return <AccessMessage title="ไม่มีสิทธิ์เข้าถึง" detail="หน้านี้สงวนไว้สำหรับผู้ดูแลระบบเท่านั้น" action={<Navigate to="/home" replace />} />;
  }

  return (
    <div style={styles.shell}>
      <style>{RESPONSIVE_CSS}</style>
      {menuOpen && <button type="button" aria-label="ปิดเมนู" className="ah-admin-overlay" onClick={() => setMenuOpen(false)} />}
      <AdminSidebar admin={admin} open={menuOpen} onNavigate={() => setMenuOpen(false)} onLogout={logout} />
      <main className="ah-admin-main" style={styles.main}>
        <div className="ah-admin-mobile-bar">
          <button type="button" onClick={() => setMenuOpen(true)} style={styles.menuButton} aria-label="เปิดเมนูผู้ดูแล">เมนู</button>
          <span style={styles.mobileAdmin}>ADMIN</span>
        </div>
        <Outlet context={{ admin, reloadAdmin: loadAdmin }} />
      </main>
    </div>
  );
}

const styles = {
  shell: { minHeight: '100vh', display: 'flex', background: C.pageBg, fontFamily: FONT },
  main: { boxSizing: 'border-box' },
  menuButton: { border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.navy, cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, padding: '7px 11px' },
  mobileAdmin: { color: C.navy, fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: '.1em' },
  accessPage: { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: C.pageBg, fontFamily: FONT },
  accessCard: { maxWidth: 440, padding: '30px 32px', borderRadius: 12, background: C.card, boxShadow: '0 16px 42px rgba(20,40,63,.08)', textAlign: 'center' },
  accessKicker: { color: C.pinkDark, fontSize: 11, fontWeight: 700, letterSpacing: '.12em' },
  accessTitle: { color: C.ink, fontSize: 24, margin: '10px 0 7px' },
  accessDetail: { color: C.muted, fontSize: 14, lineHeight: 1.7, margin: 0 },
  primaryButton: { marginTop: 20, border: 0, borderRadius: R.pill, background: C.navy, color: 'white', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700, padding: '10px 18px' },
};

export default AdminLayout;
