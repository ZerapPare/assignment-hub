import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import NotificationSettings from '../components/NotificationSettings';
import GoogleIcon from '../icons/GoogleIcon';
import MicrosoftIcon from '../icons/MicrosoftIcon';
import { C, FONT, R } from '../theme';

const PLATFORMS = [
  {
    key: 'google',
    name: 'Google Classroom',
    Icon: GoogleIcon,
    field: 'google_connected',
  },
  {
    key: 'microsoft',
    name: 'Microsoft Teams',
    Icon: MicrosoftIcon,
    field: 'microsoft_connected',
  },
];

function SettingsPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [studentId, setStudentId] = useState('');
  const [savingId, setSavingId] = useState(false);
  const [idError, setIdError] = useState(null);
  const [idSaved, setIdSaved] = useState(false);

  const justLinked = params.get('linked');

  useEffect(() => {
    fetch('/api/me')
      .then((r) => {
        if (r.status === 401) {
          navigate('/login');
          return null;
        }
        if (!r.ok) throw new Error('Backend not ready');
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setMe(data);
        setStudentId(data.student_id || '');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    navigate('/login');
  };

  const handleSaveStudentId = async (e) => {
    e.preventDefault();
    setSavingId(true);
    setIdError(null);
    setIdSaved(false);
    try {
      const r = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
      setMe((m) => ({ ...m, student_id: data.student_id }));
      setIdSaved(true);
    } catch (err) {
      setIdError(err.message);
    } finally {
      setSavingId(false);
    }
  };

  const connect = (key) => {
    window.location.href = `/api/auth/${key}?link=1`;
  };

  return (
    <div style={styles.page}>
      <Sidebar active="settings" student={me} onLogout={handleLogout} />

      <div style={styles.main}>
        <h1 style={styles.title}>ตั้งค่า</h1>

        {loading && <p style={styles.muted}>กำลังโหลด…</p>}
        {error && <p style={styles.error}>⚠️ {error} — รอ database พร้อม (10–20 วิ) แล้ว refresh</p>}

        {!loading && !error && me && (
          <div style={styles.stack}>
            <div style={styles.card}>
              <div style={styles.cardHead}>
                <span style={styles.cardTitle}>ข้อมูลนักศึกษา</span>
              </div>

              <div style={styles.infoGrid}>
                <span style={styles.infoLabel}>ชื่อ</span>
                <span style={styles.infoValue}>{me.student_name || '—'}</span>

                <span style={styles.infoLabel}>อีเมล</span>
                <span style={styles.infoValue}>{me.university_email || '—'}</span>

                <span style={styles.infoLabel}>มหาวิทยาลัย</span>
                <span style={styles.infoValue}>{me.university_name || '—'}</span>
              </div>

              <form onSubmit={handleSaveStudentId} style={styles.idForm}>
                <label style={styles.field}>
                  <span style={styles.infoLabel}>รหัสนักศึกษา</span>
                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) => {
                      setStudentId(e.target.value);
                      setIdSaved(false);
                      setIdError(null);
                    }}
                    style={styles.input}
                    placeholder="เช่น 67050115"
                  />
                </label>
                <button
                  type="submit"
                  style={{ ...styles.primaryBtn, opacity: savingId ? 0.6 : 1 }}
                  disabled={savingId}
                >
                  {savingId ? 'กำลังบันทึก…' : 'บันทึก'}
                </button>
              </form>

              {idError && <p style={styles.error}>⚠️ {idError}</p>}
              {idSaved && <p style={styles.success}>บันทึกรหัสนักศึกษาแล้ว</p>}
              {!me.student_id && !idSaved && (
                <p style={styles.muted}>
                  ระบบเดารหัสนักศึกษาจากอีเมลไม่ได้ กรอกเองได้ที่นี่
                </p>
              )}
            </div>

            <NotificationSettings email={me.university_email} />

            <div style={styles.card}>
              <div style={styles.cardHead}>
                <span style={styles.cardTitle}>บัญชีที่เชื่อมต่อ</span>
              </div>

              {justLinked && (
                <p style={styles.success}>
                  เชื่อมต่อ {justLinked === 'google' ? 'Google' : 'Microsoft'} เรียบร้อยแล้ว
                </p>
              )}

              <div style={styles.platformList}>
                {PLATFORMS.map(({ key, name, Icon, field }) => (
                  <div key={key} style={styles.platformRow}>
                    <span style={styles.platformIcon}>
                      <Icon />
                    </span>
                    <div style={styles.platformText}>
                      <div style={styles.platformName}>{name}</div>
                    </div>
                    {me[field] ? (
                      <span style={styles.connectedPill}>เชื่อมต่อแล้ว</span>
                    ) : (
                      <button type="button" style={styles.ghostBtn} onClick={() => connect(key)}>
                        เชื่อมต่อ
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', width: '100%', fontFamily: FONT, background: C.pageBg, display: 'flex' },
  main: { flex: 1, minWidth: 0, padding: '26px 28px 40px', boxSizing: 'border-box' },
  title: { fontSize: 22, fontWeight: 700, color: C.ink, margin: '0 0 22px' },

  muted: { color: C.mutedLight, fontSize: 13, margin: '8px 0 0' },
  error: { color: C.pinkDark, fontSize: 13, margin: '8px 0 0' },
  success: { color: C.green, fontSize: 13, margin: '0 0 12px' },

  stack: { display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 680 },
  card: { background: C.card, borderRadius: R.card, padding: 22, minWidth: 0 },
  cardHead: { marginBottom: 16 },
  cardTitle: { fontWeight: 700, fontSize: 15, color: C.ink },

  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0,120px) minmax(0,1fr)',
    rowGap: 10,
    columnGap: 12,
    alignItems: 'center',
  },
  infoLabel: { fontSize: 12.5, color: C.muted },
  infoValue: { fontSize: 13.5, color: C.ink, overflowWrap: 'anywhere' },

  idForm: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 10,
    marginTop: 18,
    paddingTop: 18,
    borderTop: `1px solid ${C.lineSoft}`,
    flexWrap: 'wrap',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 200px', minWidth: 0 },
  input: {
    padding: '9px 12px',
    borderRadius: R.pill,
    border: `1px solid ${C.lineInput}`,
    background: C.card,
    color: C.ink,
    fontFamily: FONT,
    fontSize: 13.5,
    width: '100%',
    boxSizing: 'border-box',
  },

  platformList: { display: 'flex', flexDirection: 'column', gap: 12 },
  platformRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: R.card,
    border: `1px solid ${C.line}`,
    flexWrap: 'wrap',
  },
  platformIcon: {
    width: 20,
    display: 'flex',
    justifyContent: 'center',
    flexShrink: 0,
  },
  platformText: { flex: '1 1 200px', minWidth: 0 },
  platformName: { fontSize: 13.5, fontWeight: 700, color: C.ink },
  connectedPill: {
    fontSize: 11.5,
    fontWeight: 700,
    padding: '5px 12px',
    borderRadius: R.pill,
    background: C.greenBg,
    color: C.green,
    whiteSpace: 'nowrap',
  },

  ghostBtn: {
    padding: '9px 16px',
    borderRadius: R.pill,
    border: `1px solid ${C.lineInput}`,
    background: C.card,
    color: C.ink,
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  primaryBtn: {
    padding: '9px 18px',
    borderRadius: R.pill,
    border: 'none',
    background: C.navy,
    color: 'white',
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};

export default SettingsPage;
