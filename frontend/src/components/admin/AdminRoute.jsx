import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { adminRequest } from './adminApi';
import { C, FONT, R } from '../../theme';

function AdminRoute() {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redirect, setRedirect] = useState(false);
  const [error, setError] = useState(null);

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const currentAdmin = await adminRequest('/api/admin/me');
      setAdmin(currentAdmin);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        setRedirect(true);
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAdmin(); }, [loadAdmin]);

  if (redirect) return <Navigate to="/admin/login" replace />;
  if (loading) return <AccessMessage title="กำลังตรวจสอบสิทธิ์" detail="กำลังโหลดพื้นที่ผู้ดูแลระบบ…" />;
  if (error) {
    return <AccessMessage title="เปิดพื้นที่ผู้ดูแลไม่ได้" detail={error} action={<button type="button" onClick={loadAdmin} style={styles.primaryButton}>ลองอีกครั้ง</button>} />;
  }

  return <Outlet context={{ admin, reloadAdmin: loadAdmin }} />;
}

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

const styles = {
  accessPage: { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: C.pageBg, fontFamily: FONT },
  accessCard: { maxWidth: 440, padding: '30px 32px', borderRadius: 12, background: C.card, boxShadow: '0 16px 42px rgba(20,40,63,.08)', textAlign: 'center' },
  accessKicker: { color: C.pinkDark, fontSize: 11, fontWeight: 700, letterSpacing: '.12em' },
  accessTitle: { color: C.ink, fontSize: 24, margin: '10px 0 7px' },
  accessDetail: { color: C.muted, fontSize: 14, lineHeight: 1.7, margin: 0 },
  primaryButton: { marginTop: 20, border: 0, borderRadius: R.pill, background: C.navy, color: 'white', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700, padding: '10px 18px' },
};

export default AdminRoute;
