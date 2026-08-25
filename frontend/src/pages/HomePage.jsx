import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '../components/Sidebar';
import StatCard from '../components/StatCard';
import BarChart from '../components/BarChart';
import DonutChart from '../components/DonutChart';
import MiniCalendar from '../components/MiniCalendar';
import DeadlineList from '../components/DeadlineList';
import UrgentChecklist from '../components/UrgentChecklist';
import AddTaskModal from '../components/AddTaskModal';
import useAssignments from '../useAssignments';
import { trackClientEvent } from '../analytics';
import { HOUR, URGENT_H, fmtDate, fmtTime, isDone, withDerived } from '../tasks';
import { PencilIcon, SpinnerIcon, CheckCircleIcon, HourglassIcon, RefreshIcon } from '../icons';
import { C, FONT, R, SHADOW, WEEKDAYS } from '../theme';

function HomePage() {
  const { student, assignments, setAssignments, loading, error, setError, logout } =
    useAssignments();

  const [syncing, setSyncing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [cutoffDate, setCutoffDate] = useState(
    () => localStorage.getItem('classroomSyncCutoff') || '2026-06-28'
  );
  const [cal, setCal] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const dashboardTracked = useRef(false);

  useEffect(() => {
    if (!student || loading || error || dashboardTracked.current) return;
    dashboardTracked.current = true;
    void trackClientEvent('dashboard.viewed');
  }, [student, loading, error]);

  const handleCutoffChange = (e) => {
    const val = e.target.value;
    setCutoffDate(val);
    localStorage.setItem('classroomSyncCutoff', val);
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const r = await fetch('/api/classroom/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cutoffDate: cutoffDate || null }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || data.error || 'Sync failed');
      const a = await fetch('/api/assignments').then((res) => res.json());
      setAssignments(a);
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const shiftMonth = (delta) =>
    setCal((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const view = useMemo(() => {
    const now = new Date();
    const withDate = withDerived(assignments);

    const total = withDate.length;
    const inProgress = withDate.filter((a) => a.status === 'in_progress').length;
    const submitted = withDate.filter((a) => a.status === 'submitted').length;
    const completed = withDate.filter((a) => a.status === 'completed').length;
    const notStarted = withDate.filter((a) => a.status === 'not_started').length;

    // UR15: overall completion, where handed-in work already counts (UR26
    // groups submitted with completed).
    const progressPct = total ? Math.round(((submitted + completed) / total) * 100) : 0;

    const notDone = withDate.filter((a) => !isDone(a) && a.due);
    const urgentCount = notDone.filter(
      (a) => a.due - now <= URGENT_H * HOUR && a.due - now >= 0
    ).length;
    const urgentList = [...notDone].sort((a, b) => a.due - b.due).slice(0, 3);

    // Deliberately unfiltered by status: this one is a checklist, so finished
    // work stays visible with a tick and feeds the "เหลือ X จาก Y" counter.
    // UR26 is about not *notifying* — that's what notDone/urgentCount cover.
    const checklist = withDate
      .filter((a) => a.due && a.due - now >= 0 && a.due - now <= URGENT_H * HOUR)
      .sort((a, b) => a.due - b.due)
      .slice(0, 5);

    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const week7 = Array.from({ length: 7 }, (_, i) => {
      const s = new Date(dayStart);
      s.setDate(s.getDate() + i);
      const e = new Date(s);
      e.setDate(e.getDate() + 1);
      return {
        label: WEEKDAYS[s.getDay()],
        value: withDate.filter((a) => a.due && a.due >= s && a.due < e).length,
        isToday: i === 0,
      };
    });

    return {
      now,
      withDate,
      total,
      inProgress,
      submitted,
      completed,
      notStarted,
      progressPct,
      urgentCount,
      urgentList,
      checklist,
      week7,
    };
  }, [assignments]);

  const busyDays = useMemo(
    () =>
      new Set(
        view.withDate
          .filter((a) => a.due && a.due.getFullYear() === cal.year && a.due.getMonth() === cal.month)
          .map((a) => a.due.getDate())
      ),
    [view.withDate, cal.year, cal.month]
  );

  const isCurrentMonth = cal.year === view.now.getFullYear() && cal.month === view.now.getMonth();

  return (
    <div style={styles.page}>
      <Sidebar active="home" student={student} onLogout={logout} />

      <div style={styles.main}>
        {loading && <p style={styles.muted}>กำลังโหลด…</p>}
        {error && <p style={styles.error}>⚠️ {error} — รอ database พร้อม (10–20 วิ) แล้ว refresh</p>}

        {!loading && !error && (
          <>
            <div style={styles.header}>
              <h1 style={styles.title}>แดชบอร์ด</h1>
              <div style={styles.toolbar}>
                <label style={styles.cutoff}>
                  <span style={styles.cutoffText}>งานตั้งแต่วันที่</span>
                  <input
                    type="date"
                    value={cutoffDate}
                    onChange={handleCutoffChange}
                    style={styles.cutoffInput}
                  />
                </label>
                <button
                  type="button"
                  style={{ ...styles.ghostBtn, opacity: syncing ? 0.6 : 1 }}
                  onClick={handleSync}
                  disabled={syncing}
                >
                  <RefreshIcon size={14} color={C.muted} />
                  {syncing ? 'กำลังซิงก์…' : 'ซิงก์ Classroom'}
                </button>
                <button type="button" style={styles.primaryBtn} onClick={() => setAddOpen(true)}>
                  + เพิ่มงานใหม่
                </button>
              </div>
            </div>

            <div style={styles.body}>
              <div style={styles.leftCol}>
                <div style={styles.statGrid}>
                  <StatCard
                    label="งานทั้งหมด"
                    value={view.total}
                    iconBg={C.indigoBg}
                    icon={<PencilIcon size={16} color={C.navy} />}
                  />
                  <StatCard
                    label="กำลังทำ"
                    value={view.inProgress}
                    iconBg={C.pinkBg}
                    icon={<SpinnerIcon size={16} color={C.pink} />}
                  />
                  <StatCard
                    label="ส่ง/เสร็จ"
                    value={view.submitted + view.completed}
                    iconBg={C.blueBg}
                    icon={<CheckCircleIcon size={16} color="#3b82f6" />}
                  />
                  <StatCard
                    label={`ด่วน ${URGENT_H} ชม.`}
                    value={view.urgentCount}
                    iconBg={C.navy}
                    icon={<HourglassIcon size={16} color={C.pink} />}
                  />
                </div>

                <div style={styles.chartGrid}>
                  <div style={styles.card}>
                    <div style={styles.cardHead}>
                      <span style={styles.cardTitle}>ปริมาณงานต่อสัปดาห์</span>
                      <span style={styles.badge}>7 วันข้างหน้า</span>
                    </div>
                    <BarChart data={view.week7} />
                  </div>

                  <div style={styles.card}>
                    <div style={styles.cardHead}>
                      <span style={styles.cardTitle}>สถานะงาน</span>
                      <span style={styles.badge}>{view.total} งาน</span>
                    </div>
                    <DonutChart
                      completed={view.completed}
                      submitted={view.submitted}
                      inProgress={view.inProgress}
                      notStarted={view.notStarted}
                      total={view.total}
                    />

                    <div style={styles.progressWrap}>
                      <div style={styles.progressTrack}>
                        <div style={{ ...styles.progressFill, width: `${view.progressPct}%` }} />
                      </div>
                      <span style={styles.progressLabel}>{view.progressPct}% สำเร็จ</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={styles.rightCol}>
                <div style={{ ...styles.card, background: C.blue }}>
                  <MiniCalendar
                    year={cal.year}
                    month={cal.month}
                    today={isCurrentMonth ? view.now.getDate() : null}
                    busyDays={busyDays}
                    onPrev={() => shiftMonth(-1)}
                    onNext={() => shiftMonth(1)}
                  />
                </div>

                <div style={styles.card}>
                  <div style={styles.cardHead}>
                    <span style={styles.cardTitle}>กำหนดส่งใกล้ถึง</span>
                  </div>
                  <DeadlineList
                    items={view.urgentList.map((a) => ({
                      id: a.assignment_id,
                      dateText: a.due ? fmtDate(a.due) : '—',
                      timeText: a.due ? fmtTime(a.due) : '',
                      title: a.title,
                      source: a.platform_source || 'เพิ่มเอง',
                    }))}
                  />
                </div>

                <div style={styles.card}>
                  <div style={styles.cardHead}>
                    <span style={styles.cardTitle}>งานด่วน</span>
                    {view.checklist.length > 0 && (
                      <span style={styles.badgeFaint}>
                        เหลือ {view.checklist.filter((a) => !isDone(a)).length} จาก{' '}
                        {view.checklist.length}
                      </span>
                    )}
                  </div>
                  <UrgentChecklist
                    items={view.checklist.map((a) => ({
                      id: a.assignment_id,
                      title: a.title,
                      done: isDone(a),
                    }))}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <AddTaskModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onCreated={(a) => setAssignments((prev) => [...prev, a])}
        />
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', width: '100%', fontFamily: FONT, background: C.pageBg, display: 'flex' },
  main: { flex: 1, minWidth: 0, padding: '26px 28px 40px', boxSizing: 'border-box' },

  muted: { color: C.mutedLight, fontSize: 13, margin: '8px 0 0' },
  error: { color: C.pinkDark, fontSize: 14 },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 22,
    flexWrap: 'wrap',
  },
  title: { fontSize: 22, fontWeight: 700, color: C.ink, margin: 0 },
  toolbar: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  cutoff: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: C.card,
    borderRadius: R.pill,
    padding: '9px 14px',
  },
  cutoffText: { fontSize: 13, color: C.muted, whiteSpace: 'nowrap' },
  cutoffInput: {
    border: 'none',
    fontSize: 13,
    color: C.ink,
    fontFamily: FONT,
    background: 'transparent',
  },
  ghostBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
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
    boxShadow: SHADOW.primaryBtn,
  },

  body: { display: 'grid', gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,1fr)', gap: 18 },
  leftCol: { display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 },
  rightCol: { display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 },

  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 },
  chartGrid: { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 },

  card: { background: C.card, borderRadius: R.card, padding: 20, minWidth: 0 },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  cardTitle: { fontWeight: 700, fontSize: 14.5, color: C.ink },
  badge: {
    fontSize: 11.5,
    padding: '5px 12px',
    borderRadius: 8,
    background: C.pageBg,
    color: C.muted,
    whiteSpace: 'nowrap',
  },
  badgeFaint: { fontSize: 11.5, color: C.mutedLight, whiteSpace: 'nowrap' },

  // UR15 — overall completion, under the donut it summarises.
  progressWrap: { marginTop: 12 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    background: C.lineSoft,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    background: C.navy,
    transition: 'width .3s ease',
  },
  progressLabel: {
    display: 'block',
    marginTop: 6,
    fontSize: 11,
    color: C.muted,
    textAlign: 'right',
  },
};

export default HomePage;
