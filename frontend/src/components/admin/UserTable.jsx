import React from 'react';
import { formatDate, providerLabel } from './adminApi';
import { C, FONT, R } from '../../theme';

function StatusBadge({ status }) {
  const suspended = status === 'suspended';
  return <span style={{ ...styles.status, background: suspended ? C.pinkBg : C.greenBg, color: suspended ? C.pinkDark : C.green }}>{suspended ? 'ระงับแล้ว' : 'ใช้งานอยู่'}</span>;
}

function UserTable({ users, onOpen, onChangeStatus, currentUserId }) {
  if (!users.length) return <div style={styles.empty}>ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข</div>;

  return (
    <div className="ah-admin-table-wrap">
      <table style={styles.table}>
        <thead><tr style={styles.headRow}><th style={styles.head}>ผู้ใช้</th><th style={styles.head}>รหัสนักศึกษา</th><th style={styles.head}>มหาวิทยาลัย</th><th style={styles.head}>ผู้ให้บริการ</th><th style={styles.head}>สถานะบัญชี</th><th className="ah-admin-hide-mobile" style={styles.head}>ใช้งานล่าสุด</th><th className="ah-admin-hide-mobile" style={styles.head}>เข้าร่วม</th><th style={{ ...styles.head, textAlign: 'right' }}>จัดการ</th></tr></thead>
        <tbody>{users.map((user) => {
          const id = user.user_id || user.id;
          const suspended = user.account_status === 'suspended';
          const isSelf = String(id) === String(currentUserId);
          return <tr key={id} style={styles.row} onClick={() => onOpen(id)} tabIndex="0" onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(id); } }}>
            <td style={styles.cell}><div style={styles.user}><span style={styles.avatar}>{String(user.student_name || user.university_email || '?').slice(0, 1)}</span><span style={styles.userCopy}><strong>{user.student_name || 'ไม่ระบุชื่อ'}</strong><small>{user.university_email || '—'}</small></span></div></td>
            <td style={styles.cell}>{user.student_id || '—'}</td><td style={styles.cell}>{user.university_name || '—'}</td><td style={styles.cell}><span style={styles.provider}>{providerLabel(user)}</span></td><td style={styles.cell}><StatusBadge status={user.account_status} /></td>
            <td className="ah-admin-hide-mobile" style={styles.cell}>{formatDate(user.last_seen_at)}</td><td className="ah-admin-hide-mobile" style={styles.cell}>{formatDate(user.created_at, false)}</td>
            <td style={{ ...styles.cell, textAlign: 'right' }}><button type="button" onClick={(event) => { event.stopPropagation(); onChangeStatus(user); }} disabled={isSelf} title={isSelf ? 'ไม่สามารถเปลี่ยนสถานะบัญชีของตัวเอง' : undefined} style={{ ...styles.action, opacity: isSelf ? .42 : 1 }}>{suspended ? 'เปิดใช้งาน' : 'ระงับ'}</button></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  );
}

const styles = {
  table: { width: '100%', minWidth: 960, borderCollapse: 'collapse', color: C.body, fontFamily: FONT, fontSize: 12.5 },
  headRow: { background: C.pageBg },
  head: { color: C.muted, fontSize: 11.5, fontWeight: 700, padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' },
  row: { borderBottom: `1px solid ${C.line}`, cursor: 'pointer', outlineOffset: -2 },
  cell: { maxWidth: 210, padding: '11px 12px', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle', whiteSpace: 'nowrap' },
  user: { display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 },
  avatar: { display: 'grid', placeItems: 'center', width: 31, height: 31, borderRadius: '50%', flexShrink: 0, background: C.indigoBg, color: C.navy, fontWeight: 700 },
  userCopy: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  provider: { color: C.muted, fontSize: 11.5 },
  status: { display: 'inline-flex', borderRadius: R.sso, fontSize: 11, fontWeight: 700, padding: '4px 7px', whiteSpace: 'nowrap' },
  action: { border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.navy, cursor: 'pointer', fontFamily: FONT, fontSize: 11.5, fontWeight: 700, padding: '6px 9px', whiteSpace: 'nowrap' },
  empty: { color: C.muted, fontFamily: FONT, fontSize: 13, padding: '45px 20px', textAlign: 'center' },
};

export { StatusBadge };
export default UserTable;
