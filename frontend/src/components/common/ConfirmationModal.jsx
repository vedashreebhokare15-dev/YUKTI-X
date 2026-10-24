import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

export default function ConfirmationModal({
  open,
  title = 'Please confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onClose,
  busy = false,
  children,
  confirmDisabled = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="slim"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {tone === 'danger' && (
          <span
            aria-hidden="true"
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: 'var(--red-soft)',
              color: 'var(--red-dark)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={18} />
          </span>
        )}
        <div>
          <p style={{ fontSize: 12.8, lineHeight: 1.6, color: 'var(--text)' }}>{message}</p>
          {children}
        </div>
      </div>
    </Modal>
  );
}
