import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function AddMealSheet({ title, onClose, children }) {
  const start = useRef(null);
  const panel = useRef(null);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const previous = document.activeElement;
    panel.current?.focus();
    return () => previous?.focus?.();
  }, []);
  return createPortal(
    <div className="add-sheet-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="add-sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panel}
        style={offset ? { transform: `translateY(${offset}px)`, animation: 'none' } : undefined}
        onKeyDown={event => {
          if (event.key === 'Escape') onClose();
          if (event.key === 'Tab') {
            const buttons = panel.current.querySelectorAll('button:not(:disabled)');
            const first = buttons[0], last = buttons[buttons.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }
        }}>
        <div className="add-sheet-drag-area"
          onPointerDown={event => { start.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerMove={event => { if (start.current !== null) setOffset(Math.max(0, event.clientY - start.current)); }}
          onPointerUp={event => { const distance = start.current === null ? 0 : event.clientY - start.current; start.current = null; setOffset(0); if (distance > 60) onClose(); }}
          onPointerCancel={() => { start.current = null; setOffset(0); }}>
          <div className="add-sheet-grip" />
          <div className="add-sheet-title">{title}</div>
        </div>
        {children}
      </div>
    </div>, document.body,
  );
}
