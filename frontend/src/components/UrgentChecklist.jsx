import React from 'react';
import { C } from '../theme';
import { CheckIcon } from '../icons';

function UrgentChecklist({ items = [] }) {
  if (items.length === 0) {
    return <p style={styles.empty}>ไม่มีงานด่วนใน 48 ชม.</p>;
  }

  return (
    <div style={styles.list}>
      {items.map((it) => (
        <div key={it.id} style={styles.row}>
          <div style={it.done ? styles.boxDone : styles.box}>
            {it.done && <CheckIcon size={11} color="white" />}
          </div>
          <span style={it.done ? styles.textDone : styles.text}>{it.title}</span>
        </div>
      ))}
    </div>
  );
}

const boxBase = {
  width: 16,
  height: 16,
  borderRadius: 4,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const textBase = {
  fontSize: 13,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const styles = {
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  row: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  box: { ...boxBase, border: `1.6px solid ${C.checkbox}` },
  boxDone: { ...boxBase, background: C.green, border: `1.6px solid ${C.green}` },
  text: { ...textBase, color: C.body },
  textDone: { ...textBase, color: C.mutedLight, textDecoration: 'line-through' },
  empty: { fontSize: 13, color: C.mutedLight, margin: 0 },
};

export default UrgentChecklist;
