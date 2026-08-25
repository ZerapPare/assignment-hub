import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import BrandMark from '../components/BrandMark';
import ProviderButton from '../components/ProviderButton';
import GoogleIcon from '../icons/GoogleIcon';
import MicrosoftIcon from '../icons/MicrosoftIcon';
import { C, FONT, R, SHADOW } from '../theme';

const ERROR_MESSAGES = {
  forbidden: 'บัญชีนี้ไม่ได้รับอนุญาตให้เข้าพื้นที่ผู้ดูแลระบบ',
  oauth: 'การเข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
  state: 'เซสชันการเข้าสู่ระบบหมดอายุ กรุณาเริ่มใหม่อีกครั้ง',
};

const RESPONSIVE_CSS = `
  @media (max-width: 700px) {
    .ah-admin-login-card { grid-template-columns: 1fr !important; }
    .ah-admin-login-aside { min-height: 260px !important; }
    .ah-admin-login-content { padding: 34px 25px !important; }
    .ah-admin-login-aside-content { bottom: 28px !important; left: 28px !important; right: 28px !important; }
    .ah-admin-login-aside-title { font-size: 24px !important; }
  }
  @media (max-width: 420px) {
    .ah-admin-login-page { padding: 16px !important; }
    .ah-admin-login-content { padding: 27px 20px !important; }
  }
`;

function AdminLoginPage() {
  const location = useLocation();
  const error = useMemo(() => {
    const code = new URLSearchParams(location.search).get('error');
    return ERROR_MESSAGES[code] || null;
  }, [location.search]);

  const handleLogin = (provider) => {
    window.location.assign(`/api/admin/auth/${provider}`);
  };

  return (
    <div className="ah-admin-login-page" style={styles.page}>
      <style>{RESPONSIVE_CSS}</style>
      <div style={{ ...styles.blob, ...styles.blobTop }} />
      <div style={{ ...styles.blob, ...styles.blobBottom }} />
      <main className="ah-admin-login-card" style={styles.card}>
        <section className="ah-admin-login-content" style={styles.content}>
          <div style={styles.brandRow}>
            <BrandMark size={26} fontSize={23} weight={800} hubColor={C.pinkSoft} />
            <span style={styles.adminBadge}>ADMIN ACCESS</span>
          </div>

          <div>
            <span style={styles.eyebrow}>Assignment Hub</span>
            <h1 style={styles.heading}>เข้าสู่ระบบผู้ดูแล</h1>
            <p style={styles.subtext}>
              ใช้บัญชีผู้ดูแลที่ได้รับอนุญาตเพื่อจัดการระบบและดูข้อมูลการใช้งาน
            </p>
          </div>

          {error && <div role="alert" style={styles.error}>{error}</div>}

          <div style={styles.buttons}>
            <ProviderButton
              icon={<GoogleIcon />}
              label="เข้าสู่ระบบด้วย Google"
              onClick={() => handleLogin('google')}
            />
            <ProviderButton
              icon={<MicrosoftIcon />}
              label="เข้าสู่ระบบด้วย Microsoft"
              onClick={() => handleLogin('microsoft')}
            />
          </div>

          <p style={styles.fine}>
            การเข้าสู่ระบบจะตรวจสอบอีเมลกับรายชื่อผู้ดูแลที่ได้รับอนุญาตเท่านั้น
            และจะไม่สร้างบัญชีนักเรียน
          </p>
          <Link to="/login" style={styles.studentLink}>กลับไปเข้าสู่ระบบนักเรียน</Link>
        </section>

        <aside className="ah-admin-login-aside" style={styles.aside} aria-label="ข้อมูลพื้นที่ผู้ดูแลระบบ">
          <div style={styles.grid} />
          <div className="ah-admin-login-aside-content" style={styles.asideContent}>
            <div style={styles.asideKicker}>CONTROL ROOM</div>
            <div className="ah-admin-login-aside-title" style={styles.asideTitle}>ดูแล Assignment Hub<br />จากมุมมองเดียว</div>
            <div style={styles.asideRule} />
            <p style={styles.asideText}>ตรวจสอบผู้ใช้งาน สุขภาพระบบ และสัญญาณการใช้งานจริงอย่างเป็นส่วนตัว</p>
            <div style={styles.signalRow}>
              <span style={styles.signalDot} />
              <span>Protected admin session</span>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
    background: C.loginBg,
    fontFamily: FONT,
  },
  blob: { position: 'absolute', borderRadius: '50%', pointerEvents: 'none' },
  blobTop: { top: -110, left: -100, width: 330, height: 330, background: C.blue },
  blobBottom: { bottom: -130, right: -80, width: 310, height: 310, background: C.pinkBg },
  card: {
    width: '100%',
    maxWidth: 960,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    overflow: 'hidden',
    borderRadius: R.loginCard,
    background: C.card,
    boxShadow: SHADOW.loginCard,
    position: 'relative',
    zIndex: 1,
  },
  content: { padding: '52px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 25, boxSizing: 'border-box' },
  brandRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  adminBadge: { border: `1px solid ${C.lineInput}`, borderRadius: R.pill, color: C.navy, fontSize: 10, fontWeight: 700, letterSpacing: '.08em', padding: '4px 8px' },
  eyebrow: { display: 'inline-block', color: C.pink, fontSize: 12.5, fontWeight: 700, letterSpacing: '.08em', marginBottom: 9, textTransform: 'uppercase' },
  heading: { color: C.inkAlt, fontSize: 32, fontWeight: 800, lineHeight: 1.2, margin: 0 },
  subtext: { color: C.mutedSoft, fontSize: 15, lineHeight: 1.7, margin: '10px 0 0' },
  error: { background: '#fff1f0', border: '1px solid #f1c5c1', borderRadius: 10, color: '#9d3028', fontSize: 13, lineHeight: 1.55, padding: '10px 12px' },
  buttons: { display: 'flex', flexDirection: 'column', gap: 12 },
  fine: { color: C.mutedFaint, fontSize: 12.5, lineHeight: 1.65, margin: 0 },
  studentLink: { color: C.navy, fontSize: 12.5, fontWeight: 700, textDecoration: 'none', width: 'fit-content' },
  aside: { background: `linear-gradient(150deg, ${C.navy} 0%, ${C.navyMid} 60%, ${C.pinkSoft} 100%)`, color: 'white', minHeight: 420, overflow: 'hidden', position: 'relative' },
  grid: { position: 'absolute', inset: 0, opacity: .18, backgroundImage: 'linear-gradient(rgba(255,255,255,.32) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.32) 1px, transparent 1px)', backgroundSize: '28px 28px', maskImage: 'linear-gradient(135deg, black, transparent 72%)' },
  asideContent: { bottom: 42, left: 42, maxWidth: 320, position: 'absolute', right: 38 },
  asideKicker: { fontSize: 10.5, fontWeight: 700, letterSpacing: '.16em', opacity: .72 },
  asideTitle: { fontSize: 29, fontWeight: 800, lineHeight: 1.25, marginTop: 14 },
  asideRule: { background: C.pinkSoft, height: 3, margin: '25px 0 17px', width: 42 },
  asideText: { fontSize: 13.5, lineHeight: 1.75, margin: 0, opacity: .85 },
  signalRow: { alignItems: 'center', display: 'flex', fontSize: 11, gap: 8, marginTop: 28, opacity: .8 },
  signalDot: { background: '#8fe0b8', borderRadius: '50%', boxShadow: '0 0 0 4px rgba(143,224,184,.16)', height: 7, width: 7 },
};

export default AdminLoginPage;
