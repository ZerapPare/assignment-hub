import React, { useState } from 'react';
import { Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import { C, FONT, R } from '../../theme';
import AdminSidebar from './AdminSidebar';

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

function AdminLayout() {
  const navigate = useNavigate();
  const parentContext = useOutletContext() || {};
  const { admin, reloadAdmin } = parentContext;
  const [menuOpen, setMenuOpen] = useState(false);

  const logout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } finally {
      navigate('/admin/login', { replace: true });
    }
  };

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
        <Outlet context={{ admin, reloadAdmin }} />
      </main>
    </div>
  );
}

const styles = {
  shell: { minHeight: '100vh', display: 'flex', background: C.pageBg, fontFamily: FONT },
  main: { boxSizing: 'border-box' },
  menuButton: { border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.navy, cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, padding: '7px 11px' },
  mobileAdmin: { color: C.navy, fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: '.1em' },
};

export default AdminLayout;
