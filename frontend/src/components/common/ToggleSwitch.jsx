export default function ToggleSwitch({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="toggle-switch"
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span className="sr-only">{label}</span>
    </button>
  );
}
