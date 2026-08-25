import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import useAssignments from '../useAssignments';
import { C, FONT, R, SHADOW } from '../theme';

function AssignmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { student, assignments, loading, error, logout, changeStatus } = useAssignments();

  const assignment = useMemo(() => {
    return assignments.find((a) => String(a.assignment_id) === String(id));
  }, [assignments, id]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'ไม่ระบุกำหนดส่ง';
    return new Date(dateStr).toLocaleString('th-TH', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
  };

  return (
    <div style={styles.page}>
      <Sidebar active="all" student={student} onLogout={logout} />

      <div style={styles.main}>
        {/* Top Bar */}
        <button type="button" style={styles.backBtn} onClick={() => navigate(-1)}>
          ← กลับไปหน้างานทั้งหมด
        </button>

        {loading && <p style={styles.muted}>กำลังโหลดรายละเอียดงาน…</p>}
        {error && <p style={styles.error}>⚠️ {error}</p>}

        {!loading && !assignment && <p style={styles.error}>⚠️ ไม่พบข้อมูลงานนี้</p>}

        {!loading && assignment && (
          <div style={styles.card}>
            {/* Header section */}
            <div style={styles.header}>
              <div>
                <span style={styles.badge}>{assignment.course_name}</span>
                {assignment.platform_source && (
                  <span style={{ ...styles.badge, background: '#e8f0fe', color: '#1a73e8' }}>
                    {assignment.platform_source}
                  </span>
                )}
                <h1 style={styles.title}>{assignment.title}</h1>
              </div>

              {assignment.origin_link && (
                <a
                  href={assignment.origin_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.classroomBtn}
                >
                  เปิดบน Google Classroom ↗
                </a>
              )}
            </div>

            <hr style={styles.divider} />

            {/* Metadata Section */}
            <div style={styles.grid}>
              <div style={styles.metaItem}>
                <span style={styles.metaLabel}>📅 กำหนดส่ง</span>
                <span style={styles.metaValue}>{formatDate(assignment.due_date)}</span>
              </div>

              <div style={styles.metaItem}>
                <span style={styles.metaLabel}>📌 สถานะ</span>
                <select
                  value={assignment.status || 'not_started'}
                  onChange={(e) => changeStatus(assignment.assignment_id, e.target.value)}
                  style={styles.selectStatus}
                >
                  <option value="not_started">ยังไม่เริ่ม</option>
                  <option value="in_progress">กำลังทำ</option>
                  <option value="submitted">ส่งแล้ว</option>
                  <option value="completed">เสร็จสิ้น</option>
                </select>
              </div>

              {assignment.task_type && (
                <div style={styles.metaItem}>
                  <span style={styles.metaLabel}>🏷️ ประเภทงาน</span>
                  <span style={styles.metaValue}>{assignment.task_type}</span>
                </div>
              )}
            </div>

            {/* Description Section */}
            <div style={styles.descSection}>
              <h3 style={styles.descTitle}>รายละเอียด</h3>
              <div style={styles.descContent}>
                {assignment.description ? (
                  assignment.description
                ) : (
                  <span style={styles.muted}>ไม่มีรายละเอียดเพิ่มเติม</span>
                )}
              </div>
            </div>
          </div>
        )}
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

  backBtn: {
    background: 'none',
    border: 'none',
    color: C.navy,
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: 16,
    padding: 0,
  },

  card: {
    background: 'white',
    borderRadius: 12,
    padding: 24,
    boxShadow: SHADOW.card || '0 2px 8px rgba(0,0,0,0.08)',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },

  badge: {
    display: 'inline-block',
    fontSize: 12,
    fontWeight: 600,
    background: C.pageBg,
    color: C.navy,
    padding: '4px 10px',
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 8,
  },

  title: {
    fontSize: 22,
    fontWeight: 700,
    color: C.ink,
    margin: '4px 0 0 0',
  },

  classroomBtn: {
    padding: '8px 16px',
    borderRadius: R.pill || 20,
    background: '#0f9d58',
    color: 'white',
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
    boxShadow: SHADOW.primaryBtn,
  },

  divider: {
    border: 'none',
    borderTop: `1px solid ${C.pageBg || '#f4f5f7'}`,
    margin: '20px 0',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
    marginBottom: 24,
  },

  metaItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },

  metaLabel: {
    fontSize: 12,
    color: C.mutedLight || '#888',
  },

  metaValue: {
    fontSize: 14,
    fontWeight: 600,
    color: C.ink,
  },

  selectStatus: {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid #ccc',
    fontFamily: FONT,
    fontSize: 14,
    width: 'fit-content',
  },

  descSection: {
    background: C.pageBg || '#f9fafb',
    borderRadius: 8,
    padding: 16,
  },

  descTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: C.ink,
    margin: '0 0 8px 0',
  },

  descContent: {
    fontSize: 14,
    color: C.ink,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },

  muted: { color: C.mutedLight || '#888', fontSize: 13 },
  error: { color: C.pinkDark || '#d9381e', fontSize: 14 },
};

export default AssignmentDetailPage;