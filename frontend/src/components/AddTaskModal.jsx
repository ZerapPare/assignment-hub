import React, { useEffect, useState } from 'react';
import { C, FONT, R, SHADOW } from '../theme';

const TASK_TYPES = [
  { value: 'homework', label: 'การบ้าน' },
  { value: 'project', label: 'โปรเจกต์' },
  { value: 'quiz', label: 'ควิซ' },
  { value: 'exam', label: 'สอบ' },
  { value: 'reading', label: 'อ่านหนังสือ' },
  { value: 'other', label: 'อื่น ๆ' },
];

const EMPTY = {
  title: '',
  task_type: 'homework',
  course_name: '',
  description: '',
  due_date: '',
};

function AddTaskModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'เพิ่มงานไม่สำเร็จ');
      onCreated(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <form style={styles.card} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 style={styles.heading}>เพิ่มงานใหม่</h2>

        <label style={styles.field}>
          <span style={styles.label}>ชื่องาน</span>
          <input
            type="text"
            value={form.title}
            onChange={set('title')}
            style={styles.input}
            placeholder="เช่น รายงานบทที่ 3"
            required
            autoFocus
          />
        </label>

        <div style={styles.row}>
          <label style={styles.field}>
            <span style={styles.label}>ประเภทงาน</span>
            <select value={form.task_type} onChange={set('task_type')} style={styles.input}>
              {TASK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>รายวิชา</span>
            <input
              type="text"
              value={form.course_name}
              onChange={set('course_name')}
              style={styles.input}
              placeholder="งานที่เพิ่มเอง"
            />
          </label>
        </div>

        <label style={styles.field}>
          <span style={styles.label}>กำหนดส่ง</span>
          <input
            type="datetime-local"
            value={form.due_date}
            onChange={set('due_date')}
            style={styles.input}
          />
        </label>

        <label style={styles.field}>
          <span style={styles.label}>คำอธิบาย</span>
          <textarea
            value={form.description}
            onChange={set('description')}
            style={{ ...styles.input, ...styles.textarea }}
            rows={3}
            placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
          />
        </label>

        {error && <p style={styles.error}>⚠️ {error}</p>}

        <div style={styles.actions}>
          <button type="button" onClick={onClose} style={styles.ghostBtn}>
            ยกเลิก
          </button>
          <button
            type="submit"
            style={{ ...styles.primaryBtn, opacity: saving ? 0.6 : 1 }}
            disabled={saving}
          >
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </form>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(20,40,63,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 50,
  },
  card: {
    background: C.card,
    borderRadius: R.panelCard,
    padding: 24,
    width: '100%',
    maxWidth: 460,
    maxHeight: '90vh',
    overflowY: 'auto',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    fontFamily: FONT,
    boxShadow: SHADOW.loginCard,
  },
  heading: { margin: 0, fontSize: 17, fontWeight: 700, color: C.ink },

  row: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 160px', minWidth: 0 },
  label: { fontSize: 12.5, color: C.muted },
  input: {
    padding: '9px 12px',
    borderRadius: R.pill,
    border: `1px solid ${C.lineInput}`,
    background: C.card,
    color: C.ink,
    fontFamily: FONT,
    fontSize: 13.5,
    width: '100%',
    boxSizing: 'border-box',
  },
  textarea: { resize: 'vertical', lineHeight: 1.5 },

  error: { color: C.pinkDark, fontSize: 13, margin: 0 },

  actions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  ghostBtn: {
    padding: '9px 18px',
    borderRadius: R.pill,
    border: `1px solid ${C.lineInput}`,
    background: C.card,
    color: C.ink,
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
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
    boxShadow: SHADOW.primaryBtn,
  },
};

export default AddTaskModal;
