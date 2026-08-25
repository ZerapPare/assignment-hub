import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import AssignmentTable from '../components/AssignmentTable';
import AddTaskModal from '../components/AddTaskModal';
import EditTaskModal from '../components/EditTaskModal';
import useAssignments from '../useAssignments';
import { withDerived } from '../tasks';
import { C, FONT, R, SHADOW } from '../theme';

function StreamPage() {
  const {
    student,
    assignments,
    setAssignments,
    loading: assignmentsLoading,
    error: assignmentsError,
    logout,
    statusPending,
    statusErrors,
    changeStatus,
    deleteTask,
    saveEdit,
  } = useAssignments();

  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [announcementsError, setAnnouncementsError] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const rows = useMemo(() => withDerived(assignments), [assignments]);
  const now = new Date();

  // Fetch announcements from DB
  useEffect(() => {
    let isMounted = true;
    async function fetchAnnouncements() {
      try {
        const res = await fetch('/api/announcements');
        if (!res.ok) {
          throw new Error(`Failed to fetch announcements (${res.status})`);
        }
        const data = await res.json();
        if (isMounted) {
          setAnnouncements(data);
          setAnnouncementsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setAnnouncementsError(err.message);
          setAnnouncementsLoading(false);
        }
      }
    }
    fetchAnnouncements();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleEdit = (a) => {
    setEditing(a);
    setEditOpen(true);
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <div style={styles.page}>
      <Sidebar active="stream" student={student} onLogout={logout} />

      <div style={styles.main}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>ประกาศและงานทั้งหมด</h1>
          <button type="button" style={styles.primaryBtn} onClick={() => setAddOpen(true)}>
            + เพิ่มงานใหม่
          </button>
        </div>

        {/* Section 1: Announcements */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>📢 ประกาศล่าสุด</h2>

          {announcementsLoading && <p style={styles.muted}>กำลังโหลดประกาศ…</p>}
          {announcementsError && (
            <p style={styles.error}>⚠️ ไม่สามารถโหลดประกาศได้: {announcementsError}</p>
          )}

          {!announcementsLoading && !announcementsError && announcements.length === 0 && (
            <p style={styles.muted}>ไม่มีประกาศในขณะนี้</p>
          )}

          {!announcementsLoading && !announcementsError && announcements.length > 0 && (
            <div style={styles.announcementList}>
              {announcements.map((ann) => (
                <div key={ann.announcement_id} style={styles.announcementCard}>
                  <div style={styles.cardHeader}>
                    <span style={styles.courseBadge}>{ann.course_name}</span>
                    <span style={styles.postedAt}>{formatDate(ann.posted_at)}</span>
                  </div>

                  <p style={styles.announcementText}>{ann.text_content}</p>

                  {ann.origin_link && (
                    <a
                      href={ann.origin_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.link}
                    >
                      ดูบน Google Classroom ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Assignments */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>📋 รายการงาน</h2>

          {assignmentsLoading && <p style={styles.muted}>กำลังโหลด…</p>}
          {assignmentsError && (
            <p style={styles.error}>
              ⚠️ {assignmentsError} — รอ database พร้อม (10–20 วิ) แล้ว refresh
            </p>
          )}

          {!assignmentsLoading && !assignmentsError && (
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
        </div>

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
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  title: { fontSize: 22, fontWeight: 700, color: C.ink, margin: 0 },

  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: C.ink,
    margin: '0 0 12px 0',
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

  announcementList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  announcementCard: {
    background: 'white',
    borderRadius: 8,
    padding: '14px 18px',
    boxShadow: SHADOW.card || '0 1px 3px rgba(0,0,0,0.1)',
    borderLeft: `4px solid ${C.navy}`,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  courseBadge: {
    fontSize: 12,
    fontWeight: 600,
    color: C.navy,
    background: C.pageBg,
    padding: '2px 8px',
    borderRadius: 4,
  },
  postedAt: {
    fontSize: 12,
    color: C.mutedLight || '#888',
  },
  announcementText: {
    fontSize: 14,
    color: C.ink,
    margin: '0 0 8px 0',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.5,
  },
  link: {
    fontSize: 12,
    fontWeight: 500,
  },

  muted: { color: C.mutedLight || '#888', fontSize: 13, margin: '8px 0 0' },
  error: { color: C.pinkDark || '#d9381e', fontSize: 14 },
};

export default StreamPage;