import React, { useState, useEffect } from 'react';
import { C, FONT, R, SHADOW } from '../theme';

const TASK_TYPES = ['homework', 'project', 'quiz', 'exam', 'reading', 'other'];

function EditTaskModal({ open, onClose, assignment, onSave }) {
  const [title, setTitle] = useState('');
  const [courseName, setCourseName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [taskType, setTaskType] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (assignment) {
      setTitle(assignment.title || '');
      setCourseName(assignment.course_name || '');
      const due = assignment.due_date ? new Date(assignment.due_date) : null;
      if (due) {
        const local = new Date(due.getTime() - due.getTimezoneOffset() * 60000);
        setDueDate(local.toISOString().split('T')[0]);
        setDueTime(local.toTimeString().slice(0, 5));
      } else {
        setDueDate('');
        setDueTime('');
      }
      setTaskType(assignment.task_type || '');
      setDescription(assignment.description || '');
    }
  }, [assignment]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) {
      setError('ต้องระบุชื่องาน');
      return;
    }

    const payload = { title: title.trim() };
    if (courseName.trim()) payload.course_name = courseName.trim();
    if (taskType) payload.task_type = taskType;
    if (description.trim()) payload.description = description.trim();

    // Build due date string
    if (dueDate) {
      const combined = dueTime ? `${dueDate}T${dueTime}` : `${dueDate}T23:59`;
      payload.due_date = combined;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/assignments/${assignment.assignment_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      onSave(data); // updated assignment
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !assignment) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.heading}>แก้ไขงาน</h2>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            ชื่องาน *
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={styles.input}
              required
            />
          </label>
          <label style={styles.label}>
            รายวิชา
            <input
              type="text"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              style={styles.input}
            />
          </label>
          <div style={styles.row}>
            <label style={{ ...styles.label, flex: 1 }}>
              กำหนดส่ง (วันที่)
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={styles.input}
              />
            </label>
            <label style={{ ...styles.label, flex: 1 }}>
              เวลา
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                style={styles.input}
              />
            </label>
          </div>
          <label style={styles.label}>
            ประเภทงาน
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              style={styles.input}
            >
              <option value="">ไม่ระบุ</option>
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            คำอธิบาย
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ ...styles.input, minHeight: 60, resize: 'vertical' }}
            />
          </label>
          {error && <p style={styles.error}>{error}</p>}
          <div style={styles.actions}>
            <button type="button" style={styles.cancelBtn} onClick={onClose}>
              ยกเลิก
            </button>
            <button type="submit" style={styles.saveBtn} disabled={submitting}>
              {submitting ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: C.card,
    borderRadius: R.card,
    padding: 28,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: SHADOW.card,
    fontFamily: FONT,
  },
  heading: { fontSize: 18, fontWeight: 700, margin: '0 0 18px', color: C.ink },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  label: { fontSize: 13, fontWeight: 600, color: C.ink },
  input: {
    width: '100%',
    padding: '8px 10px',
    marginTop: 4,
    border: `1px solid ${C.lineInput}`,
    borderRadius: R.input,
    fontSize: 13,
    fontFamily: FONT,
    background: 'white',
    boxSizing: 'border-box',
  },
  row: { display: 'flex', gap: 12 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  cancelBtn: {
    padding: '8px 18px',
    borderRadius: R.pill,
    border: `1px solid ${C.lineInput}`,
    background: 'transparent',
    color: C.muted,
    fontWeight: 600,
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '8px 20px',
    borderRadius: R.pill,
    border: 'none',
    background: C.navy,
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: SHADOW.primaryBtn,
  },
  error: { color: C.pinkDark, fontSize: 13, margin: '4px 0 0' },
};

export default EditTaskModal;