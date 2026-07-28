import React from 'react';
import { useNavigate } from 'react-router-dom';
import { C, FONT, R } from '../theme';
import BrandMark from './BrandMark';
import { HomeIcon, PencilIcon, CalendarIcon, GearIcon } from '../icons';

// Entries without a `path` have no page behind them yet, so they stay
// presentational — no pointer cursor, no click handler.
const NAV = [
  { key: 'home', label: 'หน้าแรก', Icon: HomeIcon, path: '/home' },
  { key: 'all', label: 'การบ้านทั้งหมด', Icon: PencilIcon },
  { key: 'stats', label: 'สถิติ', Icon: CalendarIcon },
  { key: 'settings', label: 'ตั้งค่า', Icon: GearIcon, path: '/settings' },
];

// Left navigation rail. `active` = current nav key. `student` powers the
// profile card. `onLogout` clears the session and returns to /login.
function Sidebar({ active = 'home', student, onLogout }) {
  const navigate = useNavigate();
  const name = student?.student_name || '—';
  // University is NULL until the University table is populated; fall back to
  // the real email rather than printing a generic word that looks like data.
  const sub = student?.university_name || student?.university_email || '';

  return (
    <div style={styles.rail}>
      <div style={{ padding: '0 8px' }}>
        <BrandMark size={22} fontSize={17} weight={700} />
      </div>

      <nav style={styles.nav}>
        {NAV.map(({ key, label, Icon, path }) => {
          const on = key === active;
          return (
            <div
              key={key}
              onClick={path && !on ? () => navigate(path) : undefined}
              style={{
                ...styles.navItem,
                background: on ? C.pinkBg : 'transparent',
                color: on ? C.navy : C.muted,
                fontWeight: on ? 700 : 500,
                cursor: path && !on ? 'pointer' : 'default',
              }}
            >
              <Icon size={14} color={on ? C.navy : C.muted} />
              {label}
            </div>
          );
        })}
      </nav>

      <div style={styles.footer}>
        <div style={styles.profile}>
          <div style={styles.avatar} />
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            <div style={styles.profileName}>{name}</div>
            {sub && <div style={styles.profileSub}>{sub}</div>}
          </div>
        </div>
        <button type="button" onClick={onLogout} style={styles.logout}>
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
}

const styles = {
  rail: {
    width: 220,
    flexShrink: 0,
    background: C.card,
    borderRight: `1px solid ${C.line}`,
    padding: '22px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    boxSizing: 'border-box',
  },
  nav: { display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: R.pill,
    fontSize: 13.5,
    fontFamily: FONT,
  },
  footer: { marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 },
  profile: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: R.pill,
    background: C.blue,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${C.navy}, ${C.pinkSoft})`,
    flexShrink: 0,
  },
  profileName: {
    fontSize: 12.5,
    fontWeight: 700,
    color: C.ink,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  profileSub: {
    fontSize: 11,
    color: C.muted,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  logout: {
    padding: 9,
    borderRadius: R.pill,
    border: `1px solid ${C.lineInput}`,
    background: C.card,
    color: C.ink,
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  },
};

export default Sidebar;
