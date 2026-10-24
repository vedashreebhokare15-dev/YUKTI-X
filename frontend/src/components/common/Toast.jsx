import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

const TOAST_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export default function ToastStack({ toasts, onClose }) {
  return (
    <div className="toast-stack" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const Icon = TOAST_ICONS[toast.type] || Info;
        return (
          <div className={`toast ${toast.type || 'success'}`} key={toast.id}>
            <Icon size={17} className="toast-icon" aria-hidden="true" />
            <div className="toast-copy">
              <div className="toast-title">{toast.title}</div>
              {toast.message && <div className="toast-message">{toast.message}</div>}
            </div>
            <button
              type="button"
              className="toast-close"
              onClick={() => onClose(toast.id)}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
