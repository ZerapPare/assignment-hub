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

  const rows = useMemo(() => withDerived(assignments), [assignments]);
  // One `now` per render, so every row's urgency is measured against the same
  // instant. Nothing memoises on it, so a fresh value each time costs nothing.
  const now = new Date();

  const handleEdit = (a) => {
    setEditing(a);
    setEditOpen(true);
  };

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

        {!loading && !error && (
          <AssignmentTable
            assignments={rows}
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
};

export default AssignmentsPage;
