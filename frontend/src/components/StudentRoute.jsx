import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const ADMIN_PERMISSIONS = [
  'dashboard.view', 'user.read', 'user.suspend', 'error_log.read',
  'system.health.read', 'business.analytics.read', 'audit_log.read',
];

function StudentRoute() {
  const [state, setState] = useState({ loading: true, redirect: null });

  useEffect(() => {
    let active = true;
    fetch('/api/me')
      .then((response) => {
        if (response.status === 401) return { redirect: '/login' };
        if (!response.ok) throw new Error('Unable to verify account');
        return response.json();
      })
      .then((me) => {
        if (!active) return;
        const isAdmin = (me.permissions || []).some((permission) =>
          ADMIN_PERMISSIONS.includes(permission)
        );
        setState({ loading: false, redirect: isAdmin ? '/admin' : null });
      })
      .catch(() => {
        if (active) setState({ loading: false, redirect: '/login' });
      });

    return () => { active = false; };
  }, []);

  if (state.loading) return null;
  if (state.redirect) return <Navigate to={state.redirect} replace />;
  return <Outlet />;
}

export default StudentRoute;