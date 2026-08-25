import React, { useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import AssignmentTable from '../components/AssignmentTable';
import AddTaskModal from '../components/AddTaskModal';
import EditTaskModal from '../components/EditTaskModal';
import useAssignments from '../useAssignments';
import { withDerived } from '../tasks';
import { C, FONT, R, SHADOW } from '../theme';

function AssignmentsPage() {
  const {
    student,
    assignments,
    setAssignments,
    loading,
    error,
    logout,
    statusPending,
    statusErrors,
    changeStatus,
    deleteTask,
    saveEdit,
  } = useAssignments();

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");

  const rows = useMemo(() => withDerived(assignments), [assignments]);
  // One `now` per render, so every row's urgency is measured against the same
  // instant. Nothing memoises on it, so a fresh value each time costs nothing.
  const now = new Date();

  const handleEdit = (a) => {
    setEditing(a);
    setEditOpen(true);
  };

  const filteredTasks = rows
    .filter(a => statusFilter === "all" || a.status === statusFilter)
    .filter(a => courseFilter === "all" || a.course_name === courseFilter)
    .filter((a) => {
      if (!search) return true;
      const keyword = search.toLowerCase();
      return (
        a.title.toLowerCase().includes(keyword) ||
        a.course_name.toLowerCase().includes(keyword) ||
        (a.description || "").toLowerCase().includes(keyword)
      );
    });


  return (
    <div style={styles.page}>
      <Sidebar active="all" student={student} onLogout={logout} />

      <div style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.title}>งานทั้งหมด</h1>
          <button type="button" style={styles.primaryBtn} onClick={() => setAddOpen(true)}>
            + เพิ่มงานใหม่
          </button>
        </div>

        {loading && <p style={styles.muted}>กำลังโหลด…</p>}
        {error && <p style={styles.error}>⚠️ {error} — รอ database พร้อม (10–20 วิ) แล้ว refresh</p>}

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
            <option value="not_started">ยังไม่เริ่ม</option>
            <option value="in_progress">กำลังทำ</option>
            <option value="submitted">ส่งแล้ว</option>
            <option value="completed">เสร็จสิ้น</option>
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

        {!loading && !error && (
          <AssignmentTable
            // assignments={rows}
            assignments={filteredTasks}
            now={now}
            statusPending={statusPending}
            statusErrors={statusErrors}
            onStatusChange={changeStatus}
            onEdit={handleEdit}
            onDelete={deleteTask}
          />
        )}

        <AddTaskModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onCreated={(a) => setAssignments((prev) => [...prev, a])}
        />
        <EditTaskModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          assignment={editing}
          onSave={saveEdit}
        />
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    width: '100%',
    fontFamily: FONT,
    background: C.pageBg,
    display: 'flex',
  },
  main: { flex: 1, minWidth: 0, padding: '26px 28px 40px', boxSizing: 'border-box' },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 22,
    flexWrap: 'wrap',
  },
  title: { fontSize: 22, fontWeight: 700, color: C.ink, margin: 0 },

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

  muted: { color: C.mutedLight, fontSize: 13, margin: '8px 0 0' },
  error: { color: C.pinkDark, fontSize: 14 },

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
};

export default AssignmentsPage;
