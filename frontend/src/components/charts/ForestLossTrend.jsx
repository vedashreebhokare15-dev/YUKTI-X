import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="recharts-tooltip-custom">
      <div className="tt-title">{label}</div>
      <div className="tt-row">
        <span
          style={{ width: 6, height: 6, borderRadius: '50%', background: '#16845C', display: 'inline-block' }}
        />
        {payload[0].value} km² estimated affected area
      </div>
    </div>
  );
}

export default function ForestLossTrend({ data }) {
  return (
    <div
      className="trend-chart-wrap"
      role="img"
      aria-label="Line chart of estimated potential forest-loss area across the year, using illustrative demo data."
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 18, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#E6EFEC" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: '#7C8B96' }}
            dy={6}
          />
          <YAxis
            width={36}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10.5, fill: '#8A98A3' }}
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip content={<TrendTooltip />} cursor={{ stroke: '#C7DBD5', strokeWidth: 1 }} />
          <Line
            type="monotone"
            dataKey="area"
            stroke="#16845C"
            strokeWidth={2.4}
            dot={{ r: 3.4, fill: '#FFFFFF', stroke: '#08764F', strokeWidth: 2 }}
            activeDot={{ r: 5, fill: '#16845C', stroke: '#FFFFFF', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
