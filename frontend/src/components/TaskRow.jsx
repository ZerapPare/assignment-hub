import React, { useState } from 'react';
import { C } from '../theme';
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
      <span style={styles.cellTitle} title={title}>{title}</span>
      <span style={styles.cell} title={course}>{course}</span>
      <span style={styles.cell} title={platform}>{platform}</span>
      <span style={styles.cell}>{due}</span>
      <span style={styles.cell}>
        <span style={{ ...styles.badge, background: badgeBg, color: badgeColor }}>
          {badgeText}
        </span>
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
  badge: {
    display: 'inline-block',
    fontSize: 11.5,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 6,
    whiteSpace: 'nowrap',
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