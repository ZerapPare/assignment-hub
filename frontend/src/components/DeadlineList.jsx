import React from 'react';
import { C } from '../theme';

const BARS = [C.pink, C.blueMid, C.navy];

function DeadlineList({ items = [] }) {
  if (items.length === 0) {
    return <p style={styles.empty}>ไม่มีงานค้าง</p>;
  }

  return (
    <div style={styles.list}>
      {items.map((it, i) => (
        <div key={it.id} style={styles.item}>
          <div style={{ ...styles.bar, background: BARS[i % BARS.length] }} />
          <div style={{ minWidth: 0 }}>
            <div style={styles.when}>
              {it.dateText}
              {it.timeText ? ` · ${it.timeText}` : ''}
            </div>
            <div style={styles.title}>{it.title}</div>
            <div style={styles.source}>{it.source}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  item: { display: 'flex', gap: 10 },
  bar: { width: 6, borderRadius: 4, flexShrink: 0 },
  when: { fontSize: 12, color: C.mutedLight },
  title: { fontSize: 13.5, fontWeight: 600, color: C.ink },
  source: { fontSize: 11.5, color: C.mutedLight },
  empty: { fontSize: 13, color: C.mutedLight, margin: 0 },
};

export default DeadlineList;
