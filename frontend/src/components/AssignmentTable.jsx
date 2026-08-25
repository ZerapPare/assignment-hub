import React from 'react';
import { useNavigate } from 'react-router-dom';
import { C, FONT, R, SHADOW } from '../theme';

function AssignmentTable({
  assignments = [],
  statusPending = {},
  statusErrors = {},
  onStatusChange,
  onEdit,
  onDelete,
}) {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <table style={styles.table}>
        <thead>
          <tr style={styles.headerRow}>
            <th style={styles.th}>ชื่องาน</th>
            <th style={styles.th}>วิชา</th>
            <th style={styles.th}>กำหนดส่ง</th>
            <th style={styles.th}>สถานะ</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {assignments.length === 0 ? (
            <tr>
              <td colSpan={5} style={styles.emptyTd}>
                ไม่มีรายการงาน
              </td>
            </tr>
          ) : (
            assignments.map((a) => {
              const isPending = !!statusPending[a.assignment_id];
              const hasError = !!statusErrors[a.assignment_id];

              return (
                <tr key={a.assignment_id} style={styles.tr}>
                  {/* Clickable Title */}
                  <td style={styles.td}>
                    <span
                      style={styles.titleLink}
                      onClick={() => navigate(`/assignments/${a.assignment_id}`)}
                      title="ดูรายละเอียดงาน"
                    >
                      {a.title}
                    </span>
                  </td>

                  <td style={styles.td}>{a.course_name}</td>

                  <td style={styles.td}>
                    {a.due_date
                      ? new Date(a.due_date).toLocaleString('th-TH', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '-'}
                  </td>

                  {/* Status Selector */}
                  <td style={styles.td}>
                    <div style={styles.statusCell}>
                      <select
                        value={a.status || 'not_started'}
                        disabled={isPending}
                        onChange={(e) => onStatusChange(a.assignment_id, e.target.value)}
                        style={{
                          ...styles.selectStatus,
                          borderColor: hasError ? C.pinkDark : C.pageBg,
                        }}
                      >
                        <option value="not_started">ยังไม่เริ่ม</option>
                        <option value="in_progress">กำลังทำ</option>
                        <option value="submitted">ส่งแล้ว</option>
                        <option value="completed">เสร็จสิ้น</option>
                      </select>
                      {hasError && <span style={styles.errorText}>⚠️</span>}
                    </div>
                  </td>

                  {/* Actions & External Classroom Link */}
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <div style={styles.actionsGroup}>
                      {a.origin_link && (
                        <a
                          href={a.origin_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={styles.classroomBtn}
                          title="เปิดใน Google Classroom"
                        >
                          Classroom ↗
                        </a>
                      )}

                      {!a.platform_source && (
                        <>
                          <button
                            type="button"
                            style={styles.iconBtn}
                            onClick={() => onEdit(a)}
                          >
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            style={{ ...styles.iconBtn, color: C.pinkDark }}
                            onClick={() => onDelete(a.assignment_id)}
                          >
                            ลบ
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
    overflowX: 'auto',
    background: 'white',
    borderRadius: 12,
    boxShadow: SHADOW.card || '0 1px 3px rgba(0,0,0,0.08)',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontFamily: FONT, fontSize: 14 },
  headerRow: { borderBottom: `2px solid ${C.pageBg}` },
  th: { padding: '14px 18px', textAlign: 'left', fontWeight: 600, color: C.ink },
  tr: { borderBottom: `1px solid ${C.pageBg}` },
  td: { padding: '14px 18px', color: C.ink },
  emptyTd: { padding: 24, textAlign: 'center', color: C.mutedLight },
  titleLink: {
    fontWeight: 600,
    color: C.navy,
    cursor: 'pointer',
    textDecoration: 'none',
  },
  statusCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  selectStatus: {
    padding: '6px 10px',
    borderRadius: R.pill,
    border: `1px solid ${C.pageBg}`,
    background: C.pageBg,
    color: C.ink,
    fontFamily: FONT,
    fontSize: 13,
    cursor: 'pointer',
  },
  errorText: {
    fontSize: 12,
  },
  actionsGroup: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'flex-end',
  },
  classroomBtn: {
    padding: '6px 14px',
    borderRadius: R.pill,
    background: C.navy,
    color: 'white',
    fontSize: 12,
    fontWeight: 600,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    boxShadow: SHADOW.primaryBtn,
  },
  iconBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: 500,
    color: C.navy,
    padding: 0,
  },
};

export default AssignmentTable;