import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import StatCard from '../components/StatCard';
import TaskRow, { GRID } from '../components/TaskRow';
import BarChart from '../components/BarChart';
import DonutChart from '../components/DonutChart';
import MiniCalendar from '../components/MiniCalendar';
import DeadlineList from '../components/DeadlineList';
import UrgentChecklist from '../components/UrgentChecklist';
import AddTaskModal from '../components/AddTaskModal';
import EditTaskModal from '../components/EditTaskModal';
import { PencilIcon, SpinnerIcon, CheckCircleIcon, HourglassIcon, RefreshIcon } from '../icons';
import { C, FONT, R, SHADOW, WEEKDAYS, TH_MONTHS_SHORT } from '../theme';

const HOUR = 1000 * 60 * 60;
const URGENT_H = 48;

const fmtDate = (d) => `${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]}`;
const fmtTime = (d) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const STATUS = {
  not_started: { label: 'ยังไม่เริ่ม', color: C.muted, bg: C.lineSoft },
  in_progress: { label: 'กำลังทำ', color: C.blueText, bg: C.blueBg },
  submitted: { label: 'ส่งแล้ว', color: C.amber, bg: C.amberBg },
  completed: { label: 'เสร็จสมบูรณ์', color: C.green, bg: C.greenBg },
};

// Anything the backend hasn't heard of falls back rather than rendering blank.
const normalizeStatus = (s) => (s in STATUS ? s : 'not_started');

// The order the student picks from, and the order the filter lists.
const STATUS_OPTIONS = Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }));

// UR26: neither a submitted nor a completed task should still be nagging the
// student, so both drop out of the urgent surfaces.
const DONE = ['submitted', 'completed'];
const isDone = (a) => DONE.includes(a.status);


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

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [cutoffDate, setCutoffDate] = useState(
    () => localStorage.getItem('classroomSyncCutoff') || '2026-06-28'
  );
  const [cal, setCal] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

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
    const withDate = assignments.map((a) => ({
      ...a,
      status: normalizeStatus(a.status),
      due: a.due_date ? new Date(a.due_date) : null,
    }));

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

  const isCurrentMonth =
    cal.year === view.now.getFullYear() && cal.month === view.now.getMonth();

  const activeFilter = FILTERS.find((f) => f.key === filter) || FILTERS[0];
  // const filteredTasks = view.withDate.filter(activeFilter.match);

  const filteredTasks = view.withDate

    //Platform
    .filter(activeFilter.match)

    //Status
    .filter(a =>

      statusFilter === "all"

      || a.status === statusFilter

    )

    //Course
    .filter(a =>

      courseFilter === "all"

      || a.course_name === courseFilter

    )
    
    //Search
    .filter((a) => {

      if (!search) return true;

      const keyword = search.toLowerCase();

      return (

        a.title.toLowerCase().includes(keyword) ||

        a.course_name.toLowerCase().includes(keyword) ||

        (a.description || "")
          .toLowerCase()
          .includes(keyword)

      );

    });

  const isUrgent = (a) =>
    !isDone(a) && a.due && a.due - view.now >= 0 && a.due - view.now <= URGENT_H * HOUR;

  const [editOpen, setEditOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);

  const handleDelete = async (id) => {
    if (!window.confirm('คุณแน่ใจว่าต้องการลบงานนี้?')) return;
    try {
      const res = await fetch(`/api/assignments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setAssignments((prev) => prev.filter((a) => a.assignment_id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (assignment) => {
    setEditingAssignment(assignment);
    setEditOpen(true);
  };

  const handleEditSave = (updated) => {
    setAssignments((prev) =>
      prev.map((a) => (a.assignment_id === updated.assignment_id ? updated : a))
    );
  };

  // Per-row rather than the page-level `error`: that one blanks the whole
  // dashboard (the body renders only when !error), and UC-5 ext 4a wants the
  // failure shown while everything else — including the old status — stays put.
  const [statusPending, setStatusPending] = useState({});
  const [statusErrors, setStatusErrors] = useState({});

  const handleStatusChange = async (id, next) => {
    setStatusErrors((prev) => {
      const { [id]: _dropped, ...rest } = prev;
      return rest;
    });
    setStatusPending((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/assignments/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (res.status === 401) {
        navigate('/login');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'อัปเดตสถานะไม่สำเร็จ');
      // Nothing else to do for UC-5 step 5: `view` is memoised on `assignments`,
      // so the stat cards, donut, progress bar and urgent lists all follow.
      setAssignments((prev) =>
        prev.map((a) => (a.assignment_id === data.assignment_id ? data : a))
      );
    } catch (err) {
      // `assignments` is untouched, so the select snaps back on its own.
      setStatusErrors((prev) => ({ ...prev, [id]: err.message }));
    } finally {
      setStatusPending((prev) => {
        const { [id]: _dropped, ...rest } = prev;
        return rest;
      });
    }
  };

  return (
    <div style={styles.page}>
      <Sidebar active="home" student={student} onLogout={handleLogout} />

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

                <div style={{ ...styles.card, padding: 22 }}>
                  <div style={styles.cardHead}>
                    <span style={{ ...styles.cardTitle, fontSize: 15 }}>งานทั้งหมด</span>
                    <div style={styles.tabs}>
                      {FILTERS.map((f) => (
                        <span
                          key={f.key}
                          onClick={() => setFilter(f.key)}
                          style={{
                            ...styles.tab,
                            background: filter === f.key ? C.pinkBg : 'transparent',
                            color: filter === f.key ? C.navy : C.muted,
                            fontWeight: filter === f.key ? 700 : 500,
                          }}
                        >
                          {f.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={styles.searchBar}>
                    <input
                      type="text"
                      placeholder="ค้นหางาน..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={styles.searchInput}
                    />
                  </div>

                  <div style={styles.filterBar}>

                    <select
                      value={statusFilter}
                      style={styles.filterSelect}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">ทุกสถานะ</option>
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={courseFilter}
                      style={styles.filterSelect}
                      onChange={(e) => setCourseFilter(e.target.value)}
                    >
                      <option value="all">ทุกรายวิชา</option>

                      {[...new Set(assignments.map(a => a.course_name))].map(course => (
                        <option key={course} value={course}>
                          {course}
                        </option>
                      ))}

                    </select>

                  </div>

                  <div style={styles.tableHead}>
                    <span>งาน</span>
                    <span>รายวิชา</span>
                    <span>แพลตฟอร์ม</span>
                    <span>กำหนดส่ง</span>
                    <span>สถานะ</span>
                  </div>

                  {filteredTasks.length === 0 && <p style={styles.muted}>ไม่มีงานในหมวดนี้</p>}
                  {filteredTasks.map((a, i) => {
                    const pill = STATUS[a.status];
                    return (
                      <TaskRow
                        key={a.assignment_id}
                        title={a.title}
                        course={a.course_name}
                        platform={a.platform_source || 'เพิ่มเอง'}
                        due={a.due ? fmtDate(a.due) : '—'}
                        status={a.status}
                        statusOptions={STATUS_OPTIONS}
                        onStatusChange={(next) => handleStatusChange(a.assignment_id, next)}
                        statusPending={!!statusPending[a.assignment_id]}
                        statusError={statusErrors[a.assignment_id] || null}
                        urgent={isUrgent(a)}
                        badgeText={pill.label}
                        badgeColor={pill.color}
                        badgeBg={pill.bg}
                        last={i === filteredTasks.length - 1}
                        isManual={!a.platform_source}
                        onEdit={() => handleEdit(a)}
                        onDelete={() => handleDelete(a.assignment_id)}
                      />
                    );
                  })}
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
        <EditTaskModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          assignment={editingAssignment}
          onSave={handleEditSave}
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

  tabs: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tab: { fontSize: 12, padding: '5px 12px', borderRadius: R.pill, cursor: 'pointer' },

  searchBar: {
    marginBottom: 15,
  },

  searchInput: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #ddd',
    fontSize: 14,
  },

 filterBar: {
  display: "flex",
  alignItems: "center",
  gap: 16,
  marginBottom: 18,
},

filterSelect: {
  minWidth: 200,
  height: 40,

  padding: "0 14px",

  borderRadius: 10,
  border: `1px solid ${C.lineInput}`,

  background: "#fff",
  color: C.ink,

  fontFamily: FONT,
  fontSize: 13,
  fontWeight: 500,

  cursor: "pointer",
  outline: "none",

  transition: "border-color .2s ease, box-shadow .2s ease",

  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",

  backgroundImage: `
    linear-gradient(45deg, transparent 50%, ${C.muted} 50%),
    linear-gradient(135deg, ${C.muted} 50%, transparent 50%)
  `,
  backgroundPosition:
    "calc(100% - 18px) calc(50% - 2px), calc(100% - 12px) calc(50% - 2px)",
  backgroundSize: "6px 6px, 6px 6px",
  backgroundRepeat: "no-repeat",
},

  tableHead: {
    display: 'grid',
    gridTemplateColumns: GRID,
    gap: 8,
    fontSize: 11.5,
    color: C.mutedLight,
    padding: '0 4px 10px',
    borderBottom: `1px solid ${C.lineSoft}`,
  },
};

export default HomePage;
