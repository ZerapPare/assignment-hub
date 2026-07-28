import React from 'react';
import ProviderButton from '../components/ProviderButton';
import BrandMark from '../components/BrandMark';
import GoogleIcon from '../icons/GoogleIcon';
import MicrosoftIcon from '../icons/MicrosoftIcon';
import { RefreshIcon, SortIcon, BellIcon } from '../icons';
import { C, FONT, R, SHADOW } from '../theme';

const FEATURES = [
  { Icon: RefreshIcon, text: 'ซิงก์งานจาก Google Classroom อัตโนมัติ' },
  { Icon: SortIcon, text: 'เรียงทุกงานตามกำหนดส่งในที่เดียว' },
  { Icon: BellIcon, text: 'เห็นงานที่ใกล้ครบกำหนดได้ทันที' },
];

function LoginPage() {
  const handleLogin = (provider) => {
    window.location.href = provider === 'google' ? '/api/auth/google' : '/api/auth/microsoft';
  };

  return (
    <div style={styles.page}>
      <div style={{ ...styles.blob, ...styles.blobTop }} />
      <div style={{ ...styles.blob, ...styles.blobBottom }} />

      <div style={styles.card}>
        <div style={styles.left}>
          <BrandMark size={26} fontSize={23} weight={800} hubColor={C.pinkSoft} />

          <div>
            <span style={styles.eyebrow}>Student Task Portal</span>
            <h1 style={styles.heading}>ยินดีต้อนรับกลับมา</h1>
            <p style={styles.subtext}>
              รวมงาน การบ้าน และกำหนดส่งจาก Google Classroom และ Microsoft Teams
              ไว้ในที่เดียว
            </p>
          </div>

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
            เข้าสู่ระบบด้วยอีเมลของมหาวิทยาลัยเท่านั้น
            ระบบจะจำแนกสถาบันของคุณโดยอัตโนมัติจากโดเมนอีเมล
          </p>
          <p style={styles.fine}>
            การเข้าสู่ระบบถือว่ายอมรับ <a href="#">ข้อตกลงการใช้งาน</a> และ{' '}
            <a href="#">นโยบายความเป็นส่วนตัว</a>
          </p>
        </div>

        <div style={styles.right}>
          <div style={{ ...styles.circle, ...styles.circleTop }} />
          <div style={{ ...styles.circle, ...styles.circleBottom }} />

          <div style={styles.panelCard}>
            <div style={styles.panelTitle}>ทุกงานในที่เดียว</div>
            <div style={styles.featureList}>
              {FEATURES.map(({ Icon, text }) => (
                <div key={text} style={styles.feature}>
                  <div style={styles.featureIcon}>
                    <Icon size={14} color={C.navy} />
                  </div>
                  <span style={styles.featureText}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: FONT,
    background: C.loginBg,
    padding: 32,
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
  },
  blob: { position: 'absolute', borderRadius: '50%' },
  blobTop: { top: -100, left: -100, width: 340, height: 340, background: C.blue },
  blobBottom: { bottom: -120, right: -80, width: 300, height: 300, background: C.pinkBg },

  card: {
    width: '100%',
    maxWidth: 960,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    background: C.card,
    borderRadius: R.loginCard,
    overflow: 'hidden',
    boxShadow: SHADOW.loginCard,
    position: 'relative',
    zIndex: 1,
  },

  left: {
    padding: '56px 48px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 26,
    boxSizing: 'border-box',
  },
  eyebrow: {
    display: 'inline-block',
    fontSize: 12.5,
    fontWeight: 700,
    letterSpacing: '.06em',
    color: C.pink,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  heading: {
    fontSize: 33,
    fontWeight: 800,
    color: C.inkAlt,
    margin: '0 0 10px',
    lineHeight: 1.2,
  },
  subtext: { fontSize: 15, color: C.mutedSoft, margin: 0, lineHeight: 1.7 },
  buttons: { display: 'flex', flexDirection: 'column', gap: 12 },
  fine: { fontSize: 12.5, color: C.mutedFaint, lineHeight: 1.6, margin: 0 },

  right: {
    background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navyMid} 55%, ${C.pinkSoft} 100%)`,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    boxSizing: 'border-box',
  },
  circle: { position: 'absolute', borderRadius: '50%' },
  circleTop: {
    top: -30,
    right: -30,
    width: 140,
    height: 140,
    background: 'rgba(255,255,255,0.14)',
  },
  circleBottom: {
    bottom: 20,
    left: -40,
    width: 100,
    height: 100,
    background: 'rgba(255,255,255,0.1)',
  },
  panelCard: {
    background: C.card,
    borderRadius: R.panelCard,
    padding: 24,
    width: 280,
    boxShadow: SHADOW.previewCard,
    position: 'relative',
  },
  panelTitle: { fontWeight: 700, fontSize: 14, color: C.inkAlt, marginBottom: 16 },
  featureList: { display: 'flex', flexDirection: 'column', gap: 12 },
  feature: { display: 'flex', alignItems: 'center', gap: 10 },
  featureIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: '#eaf3fb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureText: { fontSize: 12.5, color: '#28282f', lineHeight: 1.45 },
};

export default LoginPage;
