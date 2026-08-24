import React, { useMemo, useState } from 'react';
import TaskRow, { GRID } from './TaskRow';
import { C, FONT, R } from '../theme';
import {
  PLATFORM_FILTERS,
  STATUS,
  STATUS_OPTIONS,
  STATUS_LOCKED_HINT,
  fmtDate,
  isStatusLocked,
  isUrgent,
} from '../tasks';

// The task list, with its own search and filter state — nothing outside cares
// which tab is open, so it stays here rather than in the page.
function AssignmentTable({
  assignments,
  now,
  statusPending = {},
  statusErrors = {},
  onStatusChange,
  onEdit,
  onDelete,
}) {
  const [platform, setPlatform] = useState('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');

  const courses = useMemo(
    () => [...new Set(assignments.map((a) => a.course_name))].sort(),
    [assignments]
  );

  const activeFilter = PLATFORM_FILTERS.find((f) => f.key === platform) || PLATFORM_FILTERS[0];

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return assignments
      .filter(activeFilter.match)
      .filter((a) => statusFilter === 'all' || a.status === statusFilter)
      .filter((a) => courseFilter === 'all' || a.course_name === courseFilter)
      .filter((a) => {
        if (!keyword) return true;
        return (
          a.title.toLowerCase().includes(keyword) ||
          (a.course_name || '').toLowerCase().includes(keyword) ||
          (a.description || '').toLowerCase().includes(keyword)
        );
      });
  }, [assignments, activeFilter, statusFilter, courseFilter, search]);

  return (
    <div style={styles.card}>
      <div style={styles.head}>
        <span style={styles.count}>
          {filtered.length === assignments.length
            ? `${assignments.length} งาน`
            : `${filtered.length} จาก ${assignments.length} งาน`}
        </span>
        <div style={styles.tabs}>
          {PLATFORM_FILTERS.map((f) => (
            <span
              key={f.key}
              onClick={() => setPlatform(f.key)}
              style={{
                ...styles.tab,
                background: platform === f.key ? C.pinkBg : 'transparent',
                color: platform === f.key ? C.navy : C.muted,
                fontWeight: platform === f.key ? 700 : 500,
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
          {courses.map((course) => (
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

      {filtered.length === 0 && <p style={styles.muted}>ไม่มีงานในหมวดนี้</p>}
      {filtered.map((a, i) => {
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
            onStatusChange={(next) => onStatusChange?.(a.assignment_id, next)}
            statusPending={!!statusPending[a.assignment_id]}
            statusError={statusErrors[a.assignment_id] || null}
            statusLocked={isStatusLocked(a)}
            statusLockedHint={STATUS_LOCKED_HINT}
            urgent={isUrgent(a, now)}
            badgeText={pill.label}
            badgeColor={pill.color}
            badgeBg={pill.bg}
            last={i === filtered.length - 1}
            isManual={!a.platform_source}
            onEdit={() => onEdit?.(a)}
            onDelete={() => onDelete?.(a.assignment_id)}
          />
        );
      })}
    </div>
  );
}

const styles = {
  card: { background: C.card, borderRadius: R.card, padding: 22, minWidth: 0 },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  count: { fontSize: 12.5, color: C.muted },

  tabs: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tab: { fontSize: 12, padding: '5px 12px', borderRadius: R.pill, cursor: 'pointer' },

  searchBar: { marginBottom: 15 },
  searchInput: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: `1px solid ${C.lineInput}`,
    fontFamily: FONT,
    fontSize: 14,
    color: C.ink,
    boxSizing: 'border-box',
  },

  filterBar: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18, flexWrap: 'wrap' },
  filterSelect: {
    minWidth: 200,
    height: 40,
    padding: '0 14px',
    borderRadius: 10,
    border: `1px solid ${C.lineInput}`,
    background: C.card,
    color: C.ink,
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    outline: 'none',
    transition: 'border-color .2s ease, box-shadow .2s ease',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    backgroundImage: `
      linear-gradient(45deg, transparent 50%, ${C.muted} 50%),
      linear-gradient(135deg, ${C.muted} 50%, transparent 50%)
    `,
    backgroundPosition: 'calc(100% - 18px) calc(50% - 2px), calc(100% - 12px) calc(50% - 2px)',
    backgroundSize: '6px 6px, 6px 6px',
    backgroundRepeat: 'no-repeat',
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

  muted: { color: C.mutedLight, fontSize: 13, margin: '12px 0 0' },
};

export default AssignmentTable;
