export default function MetricCard({ icon: Icon, label, value, unit, help, tone = '' }) {
  return (
    <div className="metric-card">
      {Icon && (
        <span className={`metric-icon ${tone}`.trim()} aria-hidden="true">
          <Icon size={18} />
        </span>
      )}
      <div className="metric-copy">
        <div className="metric-label">{label}</div>
        <div className="metric-value">
          {value}
          {unit && <span className="unit">{unit}</span>}
        </div>
        {help && <div className="metric-help">{help}</div>}
      </div>
    </div>
  );
}
