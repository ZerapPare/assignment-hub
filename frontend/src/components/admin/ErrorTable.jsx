import React from 'react';
import { formatDate } from './adminApi';
import { C, FONT, R } from '../../theme';

function SeverityBadge({ level }) {
  const warning = String(level || '').toLowerCase() === 'warn';
  return <span style={{ ...styles.severity, background: warning ? C.amberBg : C.pinkBg, color: warning ? C.amber : C.pinkDark }}>{warning ? 'warn' : 'error'}</span>;
}

function ErrorTable({ errors, onOpen, onCopy }) {
  if (!errors.length) return <div style={styles.empty}>ไม่พบ error ที่ตรงกับตัวกรอง</div>;
  return <div className="ah-admin-table-wrap"><table style={styles.table}><thead><tr style={styles.headRow}><th style={styles.head}>เวลา</th><th style={styles.head}>ระดับ</th><th style={styles.head}>แหล่งที่มา</th><th className="ah-admin-hide-mobile" style={styles.head}>Endpoint</th><th style={styles.head}>สถานะ</th><th style={styles.head}>ข้อความ</th><th className="ah-admin-hide-mobile" style={styles.head}>ผู้ใช้</th><th style={styles.head}>Request ID</th></tr></thead><tbody>{errors.map((item) => {
    const id = item.error_id || item.id;
    const endpoint = item.path ? `${item.method || ''} ${item.path}`.trim() : '—';
    return <tr key={id} onClick={() => onOpen(id)} tabIndex="0" onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(id); } }} style={styles.row}>
      <td style={styles.cell}>{formatDate(item.occurred_at || item.created_at)}</td><td style={styles.cell}><SeverityBadge level={item.level} /></td><td style={styles.cell}>{item.source || '—'}</td><td className="ah-admin-hide-mobile" style={{ ...styles.cell, maxWidth: 190 }}>{endpoint}</td><td style={styles.cell}>{item.status_code || item.status || '—'}</td><td style={{ ...styles.cell, maxWidth: 290 }} title={item.message}>{item.message || '—'}</td><td className="ah-admin-hide-mobile" style={styles.cell}>{item.student_name || item.university_email || item.user_id || '—'}</td><td style={styles.cell}>{item.request_id ? <button type="button" onClick={(event) => { event.stopPropagation(); onCopy(item.request_id); }} style={styles.copy} title="คัดลอก Request ID">{item.request_id}</button> : '—'}</td>
    </tr>;
  })}</tbody></table></div>;
}

const styles = {
  table: { width: '100%', minWidth: 1090, borderCollapse: 'collapse', color: C.body, fontFamily: FONT, fontSize: 12 },
  headRow: { background: C.pageBg },
  head: { color: C.muted, fontSize: 11.25, fontWeight: 700, padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' },
  row: { borderBottom: `1px solid ${C.line}`, cursor: 'pointer', outlineOffset: -2 },
  cell: { overflow: 'hidden', padding: '11px 12px', textOverflow: 'ellipsis', verticalAlign: 'middle', whiteSpace: 'nowrap' },
  severity: { borderRadius: R.sso, fontSize: 10.5, fontWeight: 700, padding: '4px 7px', textTransform: 'uppercase' },
  copy: { maxWidth: 116, overflow: 'hidden', border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.navy, cursor: 'copy', fontFamily: FONT, fontSize: 10.5, padding: '5px 7px', textOverflow: 'ellipsis', verticalAlign: 'middle', whiteSpace: 'nowrap' },
  empty: { color: C.muted, fontFamily: FONT, fontSize: 13, padding: '45px 20px', textAlign: 'center' },
};

export { SeverityBadge };
export default ErrorTable;
