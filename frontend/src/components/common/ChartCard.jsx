export default function ChartCard({ title, subtitle, icon: Icon, actions, children, footer, className = '' }) {
  return (
    <section className={`card ${className}`.trim()}>
      <div className="card-head">
        <div>
          <h2 className="card-title">
            {Icon && <Icon size={16} aria-hidden="true" />}
            {title}
          </h2>
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="card-actions">{actions}</div>}
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {children}
      </div>
      {footer && <div className="card-foot">{footer}</div>}
    </section>
  );
}
