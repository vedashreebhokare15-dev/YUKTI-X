export default function MapLegend({ items, title = 'Legend' }) {
  return (
    <div className="map-legend map-overlay">
      <div className="map-legend-head">
        <span>{title}</span>
        <span className="chip" style={{ fontSize: 8.5, padding: '1px 5px' }}>
          Demo
        </span>
      </div>
      <div className="legend-grid">
        {items.map((item) => (
          <div className="legend-row" key={item.label}>
            <span
              className={`legend-swatch ${item.type === 'line' ? 'line' : ''} ${
                item.type === 'outline' ? 'outline' : ''
              }`.trim()}
              style={
                item.type === 'outline'
                  ? undefined
                  : { background: item.color, borderColor: item.color }
              }
              aria-hidden="true"
            />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
