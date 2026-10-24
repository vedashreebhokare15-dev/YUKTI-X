import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatArea, formatPercent, percentageOf } from '../../utils/formatters';

export default function ResultBreakdown({ data, total }) {
  const sum = data.reduce((accumulator, item) => accumulator + item.value, 0);
  const grandTotal = total ?? sum;

  return (
    <div className="donut-layout">
      <div
        className="donut-chart"
        role="img"
        aria-label="Donut chart of forest-change classification areas for the currently displayed demo results."
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={52}
              outerRadius={76}
              paddingAngle={2.5}
              stroke="#FFFFFF"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatArea(value)}
              contentStyle={{
                borderRadius: 8,
                border: '1px solid #DCE7E5',
                fontSize: 11,
                boxShadow: '0 6px 18px rgba(16,45,61,.1)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="donut-legend">
        {data.map((entry) => (
          <div className="donut-legend-row" key={entry.name}>
            <span className="donut-legend-label">
              <span className="dot" style={{ background: entry.color }} aria-hidden="true" />
              {entry.name}
            </span>
            <span className="donut-legend-value">
              <strong>{formatArea(entry.value)}</strong>
              <span>{formatPercent(percentageOf(entry.value, grandTotal))}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
