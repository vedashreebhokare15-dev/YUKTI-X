export default function LoadingState({ label = 'Loading…', inline = false }) {
  return (
    <div className="loading-state" role="status" aria-live="polite" style={inline ? { padding: 8 } : undefined}>
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
