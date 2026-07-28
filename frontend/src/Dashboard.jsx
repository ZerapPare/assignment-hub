import React, { useEffect, useState } from 'react';

// Assignment list wired to the backend API.
// Preserved for later — not currently rendered (App.jsx shows the login page).

const statusColors = {
  not_started: '#94a3b8',
  in_progress: '#38bdf8',
  completed: '#4ade80',
};

function Dashboard() {
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // calls the backend through the Vite proxy (/api -> backend:3000)
    fetch('/api/assignments')
      .then((res) => {
        if (!res.ok) throw new Error('Backend not ready yet');
        return res.json();
      })
      .then((data) => setAssignments(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Assignment Hub</h1>

      {loading && <p style={styles.muted}>Loading assignments…</p>}

      {error && (
        <p style={styles.error}>
          {error} — รอ database พร้อม (10–20 วิ) แล้ว refresh
        </p>
      )}

      {!loading && !error && (
        <div style={styles.list}>
          {assignments.map((a) => (
            <div key={a.assignment_id} style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.cardTitle}>{a.title}</span>
                <span
                  style={{
                    ...styles.badge,
                    color: statusColors[a.status] || '#94a3b8',
                    borderColor: statusColors[a.status] || '#94a3b8',
                  }}
                >
                  {a.status}
                </span>
              </div>
              <div style={styles.meta}>
                {a.course_name} · {a.platform_source}
              </div>
              <div style={styles.meta}>
                Due: {a.due_date ? new Date(a.due_date).toLocaleString() : '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    margin: 0,
    padding: '2rem',
    boxSizing: 'border-box',
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  title: {
    color: '#38bdf8',
    textAlign: 'center',
    textShadow: '0 0 10px rgba(56, 189, 248, 0.5)',
    marginBottom: '2rem',
  },
  muted: { textAlign: 'center', color: '#94a3b8' },
  error: { textAlign: 'center', color: '#fbbf24' },
  list: {
    maxWidth: 640,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: '1rem 1.25rem',
    border: '1px solid #334155',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  cardTitle: { fontWeight: 600, fontSize: '1.1rem' },
  badge: {
    fontSize: '0.75rem',
    padding: '0.15rem 0.6rem',
    borderRadius: 999,
    border: '1px solid',
  },
  meta: { fontSize: '0.85rem', color: '#94a3b8' },
};

export default Dashboard;
