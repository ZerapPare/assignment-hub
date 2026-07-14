import React from 'react';
import ProviderButton from '../components/ProviderButton';
import GoogleIcon from '../icons/GoogleIcon';
import MicrosoftIcon from '../icons/MicrosoftIcon';

function LoginPage() {
  // Google = real OAuth (full-page redirect to the backend, which redirects to
  // Google and back). Microsoft is not wired yet.
  const handleLogin = (provider) => {
    if (provider === 'google') {
      window.location.href = '/api/auth/google';
    } else {
      alert('เข้าสู่ระบบด้วย Microsoft ยังไม่รองรับ (เร็วๆ นี้)');
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Left panel */}
        <div style={styles.left}>
          <div style={styles.brand}>
            <div style={styles.logoMark}>
              <div style={styles.logoInner} />
            </div>
            <span style={styles.brandName}>Assignment Hub</span>
          </div>

          <h1 style={styles.heading}>ยินดีต้อนรับกลับมา 👋</h1>
          <p style={styles.subtext}>
            รวมงาน การบ้าน และกำหนดส่งจาก Google Classroom และ Microsoft Teams
            ไว้ในที่เดียว
          </p>

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
            การเข้าสู่ระบบถือว่ายอมรับ{' '}
            <a href="#" style={styles.link}>
              ข้อตกลงการใช้งาน
            </a>{' '}
            และ{' '}
            <a href="#" style={styles.link}>
              นโยบายความเป็นส่วนตัว
            </a>
          </p>
        </div>

        {/* Right panel */}
        <div style={styles.right}>
          <div style={{ ...styles.circle, ...styles.circleTop }} />
          <div style={{ ...styles.circle, ...styles.circleBottom }} />

          <div style={styles.previewCard}>
            <div style={styles.previewHeader}>
              <span style={styles.previewTitle}>งานของฉันวันนี้</span>
              <span style={styles.previewBadge}>3 ด่วน</span>
            </div>

            <div style={styles.task}>
              <span style={{ ...styles.dot, background: '#6366f1' }} />
              <div>
                <div style={styles.taskTitle}>ส่งรายงาน Database</div>
                <div style={styles.taskMeta}>Google Classroom · วันนี้</div>
              </div>
            </div>

            <div style={{ ...styles.task, marginBottom: 0 }}>
              <span style={{ ...styles.dot, background: '#ef4444' }} />
              <div>
                <div style={styles.taskTitle}>Quiz บทที่ 4</div>
                <div style={styles.taskMeta}>MS Teams · พรุ่งนี้</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const fontStack =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Sarabun', sans-serif";

const styles = {
  page: {
    minHeight: '100vh',
    margin: 0,
    padding: '2rem',
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'linear-gradient(135deg, #f5ecd7 0%, #faf6ec 45%, #fdfbf6 100%)',
    fontFamily: fontStack,
    color: '#1e293b',
  },
  card: {
    display: 'flex',
    flexWrap: 'wrap',
    width: '100%',
    maxWidth: 960,
    minHeight: 560,
    background: '#ffffff',
    borderRadius: 24,
    boxShadow: '0 30px 60px -20px rgba(79, 70, 229, 0.25)',
    overflow: 'hidden',
  },

  // Left panel
  left: {
    flex: '1 1 420px',
    minWidth: 320,
    padding: '3rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    boxSizing: 'border-box',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    marginBottom: '2rem',
  },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: {
    width: 16,
    height: 16,
    borderRadius: 4,
    background: '#ffffff',
  },
  brandName: { fontSize: '1.35rem', fontWeight: 700, color: '#1e1b2e' },
  heading: {
    fontSize: '2rem',
    fontWeight: 700,
    margin: '0 0 0.75rem',
    color: '#1e1b2e',
  },
  subtext: {
    fontSize: '0.95rem',
    lineHeight: 1.6,
    color: '#64748b',
    margin: '0 0 2rem',
  },
  buttons: { display: 'flex', flexDirection: 'column', gap: '0.85rem' },
  fine: {
    fontSize: '0.8rem',
    lineHeight: 1.6,
    color: '#94a3b8',
    margin: '1.5rem 0 0',
  },
  link: { color: '#7c3aed', textDecoration: 'none' },

  // Right panel
  right: {
    flex: '1 1 340px',
    minWidth: 300,
    position: 'relative',
    overflow: 'hidden',
    background: 'linear-gradient(150deg, #7c3aed 0%, #9333ea 45%, #ec4899 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    boxSizing: 'border-box',
  },
  circle: {
    position: 'absolute',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.12)',
  },
  circleTop: { width: 160, height: 160, top: -40, right: -30 },
  circleBottom: { width: 180, height: 180, bottom: -50, left: -40 },
  previewCard: {
    position: 'relative',
    width: '100%',
    maxWidth: 300,
    background: '#ffffff',
    borderRadius: 16,
    padding: '1.25rem',
    boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.25)',
  },
  previewHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
  },
  previewTitle: { fontSize: '0.95rem', fontWeight: 700, color: '#1e1b2e' },
  previewBadge: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: '#e11d48',
    background: '#ffe4e6',
    padding: '0.2rem 0.6rem',
    borderRadius: 999,
  },
  task: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.7rem',
    background: '#f8f7fd',
    borderRadius: 12,
    padding: '0.75rem 0.9rem',
    marginBottom: '0.7rem',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: '50%',
    marginTop: 6,
    flexShrink: 0,
  },
  taskTitle: { fontSize: '0.9rem', fontWeight: 600, color: '#1e1b2e' },
  taskMeta: { fontSize: '0.78rem', color: '#94a3b8', marginTop: 2 },
};

export default LoginPage;
