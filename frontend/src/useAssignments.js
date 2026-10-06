import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Debug switch: 'load' | 'status' | 'delete' forces that failure; anything
// else is off. Remove this and its uses when the testing is done.
const TEST_ERROR = 'null';

// One hook for both pages: same list, same 401 bounce, same row handlers.
export default function useAssignments() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Per-row, not the page-level `error`, which blanks the screen. UC-5 ext 4a
  // wants the failure shown while the old status stays put.
  const [statusPending, setStatusPending] = useState({});
  const [statusErrors, setStatusErrors] = useState({});

  useEffect(() => {
    if (TEST_ERROR === 'load') {
      setError('ทดสอบ: โหลดข้อมูลงานไม่สำเร็จ');
      setLoading(false);
      return;
    }

    fetch('/api/me')
      .then((r) => {
        if (r.status === 401) {
          navigate('/login');
          return null;
        }
        if (!r.ok) throw new Error('Backend not ready');
        return r.json();
      })
      .then((me) => {
        if (!me) return null;
        setStudent(me);
        return fetch('/api/assignments').then((r) => {
          if (!r.ok) throw new Error('Backend not ready');
          return r.json();
        });
      })
      .then((a) => {
        if (a) setAssignments(a);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    navigate('/login');
  };

  const changeStatus = async (id, next) => {
    setStatusErrors((prev) => {
      const { [id]: _dropped, ...rest } = prev;
      return rest;
    });
    setStatusPending((prev) => ({ ...prev, [id]: true }));
    try {
      if (TEST_ERROR === 'status') throw new Error('ทดสอบ: เปลี่ยนสถานะไม่สำเร็จ');

      const res = await fetch(`/api/assignments/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (res.status === 401) {
        navigate('/login');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'อัปเดตสถานะไม่สำเร็จ');
      // UC-5 step 5: the dashboard is memoised on `assignments` and follows.
      setAssignments((prev) => prev.map((a) => (a.assignment_id === data.assignment_id ? data : a)));
    } catch (err) {
      // `assignments` is untouched, so the select snaps back on its own.
      setStatusErrors((prev) => ({ ...prev, [id]: err.message }));
    } finally {
      setStatusPending((prev) => {
        const { [id]: _dropped, ...rest } = prev;
        return rest;
      });
    }
  };

  const deleteTask = async (id) => {
    if (!window.confirm('คุณแน่ใจว่าต้องการลบงานนี้?')) return;
    try {
      if (TEST_ERROR === 'delete') throw new Error('ทดสอบ: ลบงานไม่สำเร็จ');

      const res = await fetch(`/api/assignments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setAssignments((prev) => prev.filter((a) => a.assignment_id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  const saveEdit = (updated) => {
    setAssignments((prev) =>
      prev.map((a) => (a.assignment_id === updated.assignment_id ? updated : a))
    );
  };

  return {
    student,
    assignments,
    setAssignments,
    loading,
    error,
    setError,
    logout,
    statusPending,
    statusErrors,
    changeStatus,
    deleteTask,
    saveEdit,
  };
}
