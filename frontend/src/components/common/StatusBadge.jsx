const TONE_MAP = {
  'Likely Forest Loss': 'badge-likely',
  'Possible Forest Loss': 'badge-possible',
  'No Detected Loss': 'badge-none',
  'Insufficient Evidence': 'badge-insufficient',
  Verified: 'badge-verified',
  Clear: 'badge-success',
  Active: 'badge-success',
  Completed: 'badge-success',
  Review: 'badge-warning',
  'Needs Review': 'badge-warning',
  Processing: 'badge-warning',
  Inactive: 'badge-danger',
  Failed: 'badge-danger',
  Error: 'badge-danger',
  Pending: 'badge-neutral',
  Draft: 'badge-neutral',
};

export default function StatusBadge({ value, withDot = true, className = '' }) {
  if (!value) return <span className="muted">—</span>;
  const tone = TONE_MAP[value] || 'badge-neutral';
  return (
    <span className={`badge ${tone} ${className}`.trim()}>
      {withDot && <span className="dot" aria-hidden="true" />}
      {value}
    </span>
  );
}
