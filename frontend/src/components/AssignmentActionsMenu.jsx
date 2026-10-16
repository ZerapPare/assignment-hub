import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { C, FONT, R } from '../theme';
import './AssignmentActionsMenu.css';

function AssignmentActionsMenu({ assignment, hidden, disabled, onHiddenChange, onEdit, onDelete }) {
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();
  const open = position !== null;

  useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector('[role="menuitem"]')?.focus();

    const closeOutside = (event) => {
      if (!menuRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) {
        setPosition(null);
      }
    };
    const closeOnMove = (event) => {
      if (!menuRef.current?.contains(event.target)) setPosition(null);
    };
    const keyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setPosition(null);
        triggerRef.current?.focus();
        return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const items = [...menuRef.current.querySelectorAll('[role="menuitem"]')];
      const index = items.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      event.preventDefault();
      items[next]?.focus();
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    document.addEventListener('keydown', keyDown);
    window.addEventListener('scroll', closeOnMove, true);
    window.addEventListener('resize', closeOnMove);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
      document.removeEventListener('keydown', keyDown);
      window.removeEventListener('scroll', closeOnMove, true);
      window.removeEventListener('resize', closeOnMove);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      setPosition(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.min(228, window.innerWidth - 16);
    const above = window.innerHeight - rect.bottom < 180 && rect.top > 180;
    setPosition({
      width,
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      ...(above ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
      maxHeight: Math.max(40, above ? rect.top - 14 : window.innerHeight - rect.bottom - 14),
    });
  };

  const select = (action) => {
    setPosition(null);
    triggerRef.current?.focus();
    action();
  };

  if (!onHiddenChange && assignment.platform_source) return null;

  return (
    <>
      <button type="button" ref={triggerRef} className="assignment-actions-trigger"
        disabled={disabled} aria-label={`จัดการงาน ${assignment.title}`}
        aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
        onClick={toggle} onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            toggle();
          }
        }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
          <circle cx="9" cy="3" r="1.6" /><circle cx="9" cy="9" r="1.6" /><circle cx="9" cy="15" r="1.6" />
        </svg>
      </button>
      {open && createPortal(
        <div id={menuId} ref={menuRef} role="menu" aria-label={`จัดการงาน ${assignment.title}`}
          className="assignment-actions-menu" style={{
            ...position, background: C.card, color: C.ink, fontFamily: FONT,
            border: `1px solid ${C.lineInput}`, borderRadius: R.card,
          }}>
          {onHiddenChange && (
            <button type="button" role="menuitem" className="assignment-actions-item"
              onClick={() => select(() => onHiddenChange(assignment.assignment_id, !hidden))}>
              {hidden ? 'แสดงบน Dashboard อีกครั้ง' : 'ซ่อน'}
            </button>
          )}
          {!assignment.platform_source && (
            <>
              <button type="button" role="menuitem" className="assignment-actions-item"
                onClick={() => select(() => onEdit(assignment))}>แก้ไข</button>
              <button type="button" role="menuitem" className="assignment-actions-item"
                style={{ color: C.pinkDark }}
                onClick={() => select(() => onDelete(assignment.assignment_id))}>ลบ</button>
            </>
          )}
        </div>, document.body
      )}
    </>
  );
}

export default AssignmentActionsMenu;
