import React from 'react';

const poppins = "'Poppins', sans-serif";

const NAV = [
  { key: 'home', label: 'หน้าแรก' },
  { key: 'all', label: 'การบ้านทั้งหมด' },
  { key: 'stats', label: 'สถิติ' },
  { key: 'settings', label: 'ตั้งค่า' },
];

// Left navigation rail. `active` = current nav key. `student` powers the profile.
function Sidebar({ active = 'home', student }) {
  const name = student?.student_name || 'ผู้ใช้';
  const university = student?.university_name || 'มหาวิทยาลัย';

  return (
    <div style={styles.rail}>
      <div style={styles.brand}>
        <div style={styles.logoMark}>
          <div style={styles.logoInner} />
        </div>
        <span style={styles.brandName}>Assignment Hub</span>
      </div>

      <nav style={styles.nav}>
        {NAV.map((item) => {
          const on = item.key === active;
          return (
            <div
              key={item.key}
              style={{
                ...styles.navItem,
                background: on ? 'oklch(93% 0.05 290)' : 'transparent',
                color: on ? 'oklch(45% 0.16 290)' : 'oklch(45% 0.02 290)',
                fontWeight: on ? 600 : 500,
              }}
            >
              <div
                style={{
                  ...styles.navDot,
                  background: on ? 'oklch(55% 0.18 290)' : 'oklch(80% 0.02 290)',
                }}
              />
              {item.label}
            </div>
          );
        })}
      </nav>

      <div style={styles.profile}>
        <div style={styles.avatar} />
        <div style={{ overflow: 'hidden' }}>
          <div style={styles.profileName}>{name}</div>
          <div style={styles.profileUni}>{university}</div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  rail: {
    width: 240,
    flexShrink: 0,
    background: 'oklch(99% 0.005 90)',
    borderRight: '1px solid oklch(92% 0.01 90)',
    padding: '24px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
    boxSizing: 'border-box',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px' },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 11,
    background: 'linear-gradient(135deg, oklch(60% 0.18 290), oklch(65% 0.19 310))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logoInner: { width: 16, height: 16, borderRadius: 4, background: 'white' },
  brandName: { fontFamily: poppins, fontWeight: 800, fontSize: 17, color: 'oklch(25% 0.02 290)' },
  nav: { display: 'flex', flexDirection: 'column', gap: 4 },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '11px 12px',
    borderRadius: 12,
    fontSize: 14,
  },
  navDot: { width: 8, height: 8, borderRadius: 2 },
  profile: {
    marginTop: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 8px',
    borderRadius: 12,
    background: 'oklch(96% 0.02 90)',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, oklch(70% 0.14 25), oklch(72% 0.14 60))',
    flexShrink: 0,
  },
  profileName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'oklch(25% 0.02 290)',
    whiteSpace: 'nowrap',
  },
  profileUni: { fontSize: 11.5, color: 'oklch(55% 0.02 290)', whiteSpace: 'nowrap' },
};

export default Sidebar;
