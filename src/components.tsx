import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X, FileText, File, Sparkles } from 'lucide-react';
import type { Source } from '../shared/models';

export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(interval);
  }, []);
  return now;
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          title="Close dialog"
          aria-label="Close dialog"
        >
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function SourceIcon({ kind, size = 18 }: { kind: Source['kind']; size?: number }) {
  return kind === 'topic' ? (
    <Sparkles size={size} />
  ) : kind === 'pdf' ? (
    <File size={size} />
  ) : (
    <FileText size={size} />
  );
}
export function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
