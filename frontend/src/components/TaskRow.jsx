import React, { useState } from 'react';
import { C, FONT } from '../theme';
import { PencilIcon, TrashIcon } from '../icons';

// 6 columns layout definition
export const GRID = '1.5fr 1.5fr 1fr 1fr 1fr 0.6fr';

/**
 * Matching Header Component
 * Use this in your parent component above your list of TaskRows
 */
export function TaskHeader() {
  return (
    <div style={styles.headerRow}>
      <span style={styles.headerCell}>ชื่องาน</span>
      <span style={styles.headerCell}>รายวิชา</span>
      <span style={styles.headerCell}>แพลตฟอร์ม</span>
      <span style={styles.headerCell}>กำหนดส่ง</span>
      <span style={styles.headerCell}>สถานะ</span>
      <span style={{ ...styles.headerCell, textAlign: 'right' }} />
    </div>
  );
}

/**
 * Action Button Component (Handles hover in React inline styles)
 */
function ActionButton({ onClick, title, children }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...styles.actionBtn,
        background: isHovered ? C.lineSoft : 'transparent',
      }}
    >
      {children}
    </button>
  );
}

function TaskRow({
  title,
  course,
  platform,
  due,
  status,
  statusOptions = [],
  onStatusChange,
  statusPending = false,
  statusError = null,
  urgent = false,
  badgeText,
  badgeColor,
  badgeBg,
  last,
  isManual = false,
  onEdit,
  onDelete,
}) {
  return (
    <div
      style={{
        ...styles.row,
        borderBottom: last ? 'none' : `1px solid ${C.lineSoft}`,
      }}
    >
      {/* The urgent marker used to take over the status cell. Now that the cell
          is an editable control it has to show the real status, so urgency
          moves here — minWidth:0 keeps the title's ellipsis working. */}
      <span style={styles.titleWrap}>
        {urgent && <span style={styles.urgentPill}>ด่วน</span>}
        <span style={styles.cellTitle} title={title}>{title}</span>
      </span>
      <span style={styles.cell} title={course}>{course}</span>
      <span style={styles.cell} title={platform}>{platform}</span>
      <span style={styles.cell}>{due}</span>
      {/* overflow/whiteSpace relaxed so the error line below can wrap. The
          native select's own popup is painted outside the DOM flow, so it is
          never clipped by the row. */}
      <span style={{ ...styles.cell, overflow: 'visible', whiteSpace: 'normal' }}>
        <select
          value={status}
          disabled={statusPending}
          onChange={(e) => onStatusChange?.(e.target.value)}
          title={badgeText}
          style={{
            ...styles.statusSelect,
            backgroundColor: badgeBg,
            color: badgeColor,
            opacity: statusPending ? 0.6 : 1,
            cursor: statusPending ? 'default' : 'pointer',
          }}
        >
          {statusOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {statusError && <span style={styles.rowError}>{statusError}</span>}
      </span>
      <span style={{ ...styles.cell, textAlign: 'right' }}>
        {isManual && (
          <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <ActionButton onClick={onEdit} title="แก้ไข">
              <PencilIcon size={14} color={C.muted} />
            </ActionButton>
            <ActionButton onClick={onDelete} title="ลบ">
              <TrashIcon size={14} color={C.pinkDark} />
            </ActionButton>
          </span>
        )}
      </span>
    </div>
  );
}

const styles = {
  headerRow: {
    display: 'grid',
    gridTemplateColumns: GRID,
    alignItems: 'center',
    gap: 8,
    padding: '12px 4px',
    borderBottom: `1px solid ${C.lineSoft}`,
  },
  headerCell: {
    fontSize: 12,
    fontWeight: 600,
    color: C.muted,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: GRID,
    alignItems: 'center',
    gap: 8,
    padding: '12px 4px',
  },
  cellTitle: {
    fontSize: 12.5,
    fontWeight: 500,
    color: C.text || '#2D3748',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cell: {
    fontSize: 12.5,
    color: C.muted,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  titleWrap: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
  urgentPill: {
    flexShrink: 0,
    fontSize: 10,
    fontWeight: 600,
    padding: '2px 7px',
    borderRadius: 5,
    background: C.pinkBg,
    color: C.pinkDark,
    whiteSpace: 'nowrap',
  },
  // Same chevron trick as the dashboard filters, sized down to sit in a row.
  // backgroundColor (not the `background` shorthand) — the shorthand would
  // wipe out backgroundImage and take the chevron with it.
  statusSelect: {
    width: '100%',
    maxWidth: 132,
    height: 28,
    padding: '0 26px 0 10px',
    borderRadius: 6,
    border: '1px solid transparent',
    fontFamily: FONT,
    fontSize: 11.5,
    fontWeight: 600,
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    backgroundImage: `
      linear-gradient(45deg, transparent 50%, currentColor 50%),
      linear-gradient(135deg, currentColor 50%, transparent 50%)
    `,
    backgroundPosition: 'calc(100% - 14px) calc(50% - 1px), calc(100% - 9px) calc(50% - 1px)',
    backgroundSize: '5px 5px, 5px 5px',
    backgroundRepeat: 'no-repeat',
  },
  rowError: {
    display: 'block',
    marginTop: 3,
    fontSize: 10,
    lineHeight: 1.3,
    color: C.pinkDark,
    whiteSpace: 'normal',
  },
  actionBtn: {
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 4,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
  },
};

export default TaskRow;