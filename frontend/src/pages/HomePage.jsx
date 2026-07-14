import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import StatCard from '../components/StatCard';
import TaskRow from '../components/TaskRow';
import DonutChart from '../components/DonutChart';
import TrendChart from '../components/TrendChart';
import MiniCalendar from '../components/MiniCalendar';

const inter = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Sarabun', sans-serif";
const poppins = "'Poppins', sans-serif";
const HOUR = 1000 * 60 * 60;

const TH_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const fmtDate = (d) => `${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]}`;

// Status → label + colors for the "all tasks" list.
const STATUS = {
  not_started: { label: 'ยังไม่เริ่ม', color: 'oklch(45% 0.01 90)', bg: 'oklch(94% 0.01 90)', dot: 'oklch(70% 0.02 90)' },
  in_progress: { label: 'กำลังทำ', color: 'oklch(48% 0.15 250)', bg: 'oklch(93% 0.06 250)', dot: 'oklch(60% 0.15 250)' },
  completed: { label: 'ส่งแล้ว', color: 'oklch(45% 0.13 150)', bg: 'oklch(92% 0.06 150)', dot: 'oklch(66% 0.14 150)' },
};

const FILTERS = [
  { key: 'all', label: 'ทั้งหมด', match: () => true },
  { key: 'classroom', label: 'Classroom', match: (a) => a.platform_source === 'Google Classroom' },
  { key: 'teams', label: 'Teams', match: (a) => a.platform_source === 'Microsoft Teams' },
  { key: 'manual', label: 'เพิ่มเอง', match: (a) => !a.platform_source },
];

function HomePage() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [student, setStudent] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Gate on the session: /api/me returns 401 when not logged in → go to /login.
    fetch('/api/me')
      .then((r) => {
        if (r.status === 401) {
          navigate('/login');
          return null;
        }
        if (!r.ok) throw new Error('Backend not ready');
        return r.json();
      })
      .then((me) => {
        if (!me) return null;
        setStudent(me);
        return fetch('/api/assignments').then((r) => {
          if (!r.ok) throw new Error('Backend not ready');
          return r.json();
        });
      })
      .then((a) => {
        if (a) setAssignments(a);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    navigate('/login');
  };

  // Derive all view data from the assignments list.
  const view = useMemo(() => {
    const now = new Date();
    const withDate = assignments.map((a) => ({ ...a, due: a.due_date ? new Date(a.due_date) : null }));

    const total = withDate.length;
    const inProgress = withDate.filter((a) => a.status === 'in_progress').length;
    const completed = withDate.filter((a) => a.status === 'completed').length;

    const notDone = withDate.filter((a) => a.status !== 'completed' && a.due);
    const urgentCount = notDone.filter((a) => a.due - now <= 48 * HOUR && a.due - now >= 0).length;
    const urgentList = [...notDone].sort((a, b) => a.due - b.due).slice(0, 3);

    // Weekly workload buckets (6 weeks from the current week's Sunday).
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const trend = Array.from({ length: 6 }, (_, w) => {
      const s = new Date(weekStart);
      s.setDate(s.getDate() + w * 7);
      const e = new Date(s);
      e.setDate(e.getDate() + 7);
      const value = withDate.filter((a) => a.due && a.due >= s && a.due < e).length;
      return { label: `ส.${w + 1}`, value };
    });

    // Calendar: mark days in the current month that have a due date.
    const busyDays = new Set(
      withDate
        .filter((a) => a.due && a.due.getFullYear() === now.getFullYear() && a.due.getMonth() === now.getMonth())
        .map((a) => a.due.getDate())
    );

    return {
      now,
      withDate,
      total,
      inProgress,
      completed,
      urgentCount,
      urgentList,
      trend,
      busyDays,
      percent: total ? Math.round((completed / total) * 100) : 0,
    };
  }, [assignments]);

  const firstName = student?.student_name?.split(' ')[0] || 'ผู้ใช้';
  const activeFilter = FILTERS.find((f) => f.key === filter) || FILTERS[0];
  const filteredTasks = view.withDate.filter(activeFilter.match);

  // "เหลือ X" text + urgency color from hours until due.
  const remain = (due) => {
    if (!due) return { text: '—', color: 'oklch(60% 0.02 90)' };
    const h = (due - view.now) / HOUR;
    if (h < 0) return { text: 'เลยกำหนด', color: 'oklch(62% 0.19 25)' };
    if (h < 24) return { text: `เหลือ ${Math.max(1, Math.round(h))} ชม.`, color: 'oklch(62% 0.19 25)' };
    if (h < 72) return { text: `เหลือ ${Math.round(h)} ชม.`, color: 'oklch(58% 0.15 60)' };
    return { text: `เหลือ ${Math.round(h / 24)} วัน`, color: 'oklch(52% 0.14 290)' };
  };

  return (
    <div style={styles.page}>
      <Sidebar active="home" student={student} onLogout={handleLogout} />

      <div style={styles.main}>
        {loading && <p style={styles.muted}>กำลังโหลด…</p>}
        {error && (
          <p style={styles.error}>⚠️ {error} — รอ database พร้อม (10–20 วิ) แล้ว refresh</p>
        )}

        {!loading && !error && (
          <>
            {/* Header */}
            <div style={styles.header}>
              <div>
                <h1 style={styles.greeting}>สวัสดี {firstName} </h1>
                <p style={styles.subtitle}>
                  {view.urgentCount > 0
                    ? `วันนี้มีงาน ${view.urgentCount} ชิ้นที่ใกล้กำหนดส่ง อย่าลืมเช็คนะ`
                    : 'ไม่มีงานด่วนใน 48 ชม. สบายไปเลย '}
                </p>
              </div>
              <button style={styles.addBtn}>+ เพิ่มงานใหม่</button>
            </div>

            {/* Stat cards */}
            <div style={styles.statGrid}>
              <StatCard label="งานทั้งหมด" value={view.total} />
              <StatCard label="กำลังทำ" value={view.inProgress} color="oklch(60% 0.15 250)" />
              <StatCard label="ส่งแล้ว" value={view.completed} color="oklch(60% 0.14 150)" />
              <StatCard label="ด่วน (48 ชม.)" value={view.urgentCount} color="oklch(62% 0.19 25)" />
            </div>

            {/* Two-column body */}
            <div style={styles.body}>
              {/* Left column */}
              <div style={styles.leftCol}>
                {/* Urgent */}
                <div style={styles.card}>
                  <div style={styles.cardHead}>
                    <span style={styles.cardTitle}>งานด่วน · ใกล้ถึงกำหนดส่ง</span>
                    <span style={styles.urgentBadge}>ภายใน 48 ชม.</span>
                  </div>
                  <div style={styles.urgentList}>
                    {view.urgentList.length === 0 && (
                      <p style={styles.muted}>ไม่มีงานค้าง </p>
                    )}
                    {view.urgentList.map((a) => {
                      const r = remain(a.due);
                      return (
                        <div key={a.assignment_id} style={styles.urgentItem}>
                          <div style={{ ...styles.urgentBar, background: r.color }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={styles.urgentItemTitle}>{a.title}</div>
                            <div style={styles.urgentItemMeta}>
                              {a.platform_source || 'เพิ่มเอง'} · กำหนดส่ง{' '}
                              {a.due ? fmtDate(a.due) : '—'}
                            </div>
                          </div>
                          <span style={{ ...styles.urgentRemain, color: r.color }}>{r.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* All tasks */}
                <div style={styles.card}>
                  <div style={styles.cardHead}>
                    <span style={styles.cardTitle}>งานทั้งหมด</span>
                    <div style={styles.tabs}>
                      {FILTERS.map((f) => (
                        <span
                          key={f.key}
                          onClick={() => setFilter(f.key)}
                          style={{
                            ...styles.tab,
                            background: filter === f.key ? 'oklch(93% 0.05 290)' : 'transparent',
                            color: filter === f.key ? 'oklch(45% 0.16 290)' : 'oklch(50% 0.02 290)',
                            fontWeight: filter === f.key ? 600 : 500,
                          }}
                        >
                          {f.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    {filteredTasks.length === 0 && <p style={styles.muted}>ไม่มีงานในหมวดนี้</p>}
                    {filteredTasks.map((a, i) => {
                      const s = STATUS[a.status] || STATUS.not_started;
                      return (
                        <TaskRow
                          key={a.assignment_id}
                          title={a.title}
                          meta={`${a.course_name} · ${a.due ? fmtDate(a.due) : '—'}`}
                          dotColor={s.dot}
                          badgeText={s.label}
                          badgeColor={s.color}
                          badgeBg={s.bg}
                          last={i === filteredTasks.length - 1}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div style={styles.rightCol}>
                <div style={styles.card}>
                  <DonutChart percent={view.percent} done={view.completed} total={view.total} />
                </div>
                <div style={styles.card}>
                  <TrendChart data={view.trend} />
                </div>
                <div style={styles.card}>
                  <MiniCalendar
                    year={view.now.getFullYear()}
                    month={view.now.getMonth()}
                    today={view.now.getDate()}
                    busyDays={view.busyDays}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    width: '100%',
    fontFamily: inter,
    background: 'oklch(97.5% 0.01 90)',
    display: 'flex',
  },
  main: {
    flex: 1,
    padding: '32px 40px',
    boxSizing: 'border-box',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  muted: { color: 'oklch(55% 0.02 290)', fontSize: 14 },
  error: { color: 'oklch(60% 0.15 60)', fontSize: 14 },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
  },
  greeting: { fontFamily: poppins, fontSize: 26, fontWeight: 800, color: 'oklch(22% 0.02 290)', margin: '0 0 4px' },
  subtitle: { margin: 0, fontSize: 14, color: 'oklch(50% 0.02 290)' },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 20px',
    borderRadius: 12,
    border: 'none',
    background: 'oklch(55% 0.18 290)',
    color: 'white',
    fontFamily: inter,
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    boxShadow: '0 8px 20px -6px oklch(55% 0.18 290 / 0.5)',
  },

  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 },

  body: { display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, alignItems: 'start' },
  leftCol: { display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 },
  rightCol: { display: 'flex', flexDirection: 'column', gap: 20 },

  card: {
    background: 'white',
    borderRadius: 18,
    padding: 22,
    boxShadow: '0 2px 10px -4px oklch(30% 0.03 290 / 0.1)',
  },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  cardTitle: { fontFamily: poppins, fontWeight: 700, fontSize: 16, color: 'oklch(25% 0.02 290)' },
  urgentBadge: {
    fontSize: 12,
    background: 'oklch(92% 0.06 25)',
    color: 'oklch(45% 0.17 25)',
    padding: '4px 10px',
    borderRadius: 20,
    fontWeight: 600,
  },

  urgentList: { display: 'flex', flexDirection: 'column', gap: 10 },
  urgentItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 14,
    background: 'oklch(97% 0.01 290)',
    border: '1px solid oklch(91% 0.02 290)',
  },
  urgentBar: { width: 6, height: 36, borderRadius: 4, flexShrink: 0 },
  urgentItemTitle: { fontSize: 14, fontWeight: 600, color: 'oklch(25% 0.02 290)' },
  urgentItemMeta: { fontSize: 12, color: 'oklch(50% 0.02 290)', marginTop: 2 },
  urgentRemain: { fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' },

  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  tab: { fontSize: 12, padding: '5px 12px', borderRadius: 20, cursor: 'pointer' },
};

export default HomePage;
