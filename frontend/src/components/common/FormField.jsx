import { AlertCircle } from 'lucide-react';

export default function FormField({ label, htmlFor, required = false, hint, error, children, className = '' }) {
  return (
    <div className={`form-field ${className}`.trim()}>
      {label && (
        <label className="form-label" htmlFor={htmlFor}>
          {label}
          {required && (
            <span className="req" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <span className="form-error" role="alert">
          <AlertCircle size={12} aria-hidden="true" />
          {error}
        </span>
      ) : (
        hint && <span className="form-hint">{hint}</span>
      )}
    </div>
  );
}
