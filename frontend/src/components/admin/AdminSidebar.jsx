import React from 'react';
import { NavLink } from 'react-router-dom';
import BrandMark from '../BrandMark';
import { BellIcon, GearIcon, HomeIcon, PencilIcon, SortIcon } from '../../icons';
import { C, FONT, R } from '../../theme';

const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'ภาพรวมระบบ', Icon: HomeIcon },
  { to: '/admin/business', label: 'Business Analytics', Icon: SortIcon },
  { to: '/admin/users', label: 'ผู้ใช้งาน', Icon: PencilIcon },
  { to: '/admin/errors', label: 'บันทึกข้อผิดพลาด', Icon: BellIcon },
  { to: '/admin/system', label: 'สถานะระบบ', Icon: GearIcon },
];

function AdminSidebar({ admin, open, onNavigate, onLogout }) {
  const name = admin?.display_name || 'ผู้ดูแลระบบ';
  const subtitle = admin?.email || 'Admin account';

  return (
    <aside className={`ah-admin-sidebar${open ? ' is-open' : ''}`} style={styles.rail}>
      <div style={styles.brandRow}>
        <BrandMark size={20} fontSize={15.5} weight={700} />
        <span style={styles.adminLabel}>ADMIN</span>
      </div>

      <nav aria-label="เมนูผู้ดูแล" style={styles.nav}>
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            style={({ isActive }) => ({
              ...styles.navItem,
              background: isActive ? C.pinkBg : 'transparent',
              color: isActive ? C.navy : C.muted,
              fontWeight: isActive ? 700 : 500,
            })}
          >
            {({ isActive }) => <><Icon size={15} color={isActive ? C.navy : C.muted} />{label}</>}
          </NavLink>
        ))}
      </nav>

      <div style={styles.footer}>
        <div style={styles.profile}>
          <div aria-hidden="true" style={styles.avatar}>{name.slice(0, 1)}</div>
          <div style={styles.profileCopy}>
            <div style={styles.profileName}>{name}</div>
            <div style={styles.profileSub}>{subtitle}</div>
          </div>
        </div>
        <button type="button" onClick={onLogout} style={styles.logout}>ออกจากระบบ</button>
      </div>
    </aside>
  );
}

const styles = {
  rail: {
    width: 238,
    minHeight: '100vh',
    flexShrink: 0,
    background: C.card,
    borderRight: `1px solid ${C.line}`,
    padding: '22px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
    zIndex: 20,
  },
  brandRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '0 4px' },
  adminLabel: {
    border: `1px solid ${C.lineInput}`,
    borderRadius: 99,
    color: C.navy,
    fontFamily: FONT,
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: '0.06em',
    padding: '2.5px 6px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  nav: { display: 'flex', flexDirection: 'column', gap: 3 },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    borderRadius: R.pill,
    fontFamily: FONT,
    fontSize: 13.5,
    padding: '10px 12px',
    transition: 'background .15s ease, color .15s ease',
  },
  footer: { marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 },
  profile: { display: 'flex', gap: 10, alignItems: 'center', padding: 10, borderRadius: R.pill, background: C.blue },
  avatar: {
    width: 34,
    height: 34,
    display: 'grid',
    placeItems: 'center',
    borderRadius: '50%',
    color: 'white',
    background: C.navy,
    fontFamily: FONT,
    fontWeight: 700,
    flexShrink: 0,
  },
  profileCopy: { minWidth: 0, overflow: 'hidden' },
  profileName: { color: C.ink, fontFamily: FONT, fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  profileSub: { color: C.muted, fontFamily: FONT, fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  logout: { background: C.card, border: `1px solid ${C.lineInput}`, borderRadius: R.pill, color: C.ink, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600, padding: 9 },
};

export default AdminSidebar;
