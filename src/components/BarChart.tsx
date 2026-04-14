'use client';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';

interface BarChartDataPoint {
  label: string;
  value: number;
  highlight?: boolean;
}

interface BarChartProps {
  data: BarChartDataPoint[];
  valuePrefix?: string;
  valueSuffix?: string;
}

export default function BarChartComponent({
  data,
  valuePrefix = '',
  valueSuffix = '',
}: BarChartProps) {
  const formatValue = (val: number) =>
    `${valuePrefix}${val.toLocaleString('pl-PL')}${valueSuffix}`;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <ResponsiveContainer width="100%" height={300}>
        <RechartsBarChart
          data={data}
          margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(val) => val.toLocaleString('pl-PL')}
          />
          <Tooltip
            formatter={(val) => [formatValue(Number(val)), 'Wartość']}
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
            <LabelList
              dataKey="value"
              position="top"
              formatter={(val) => formatValue(Number(val))}
              style={{ fontSize: 11, fill: 'var(--text-secondary)', fontWeight: 600 }}
            />
            {data.map((entry, idx) => (
              <Cell
                key={idx}
                fill={entry.highlight ? 'var(--primary)' : '#93b5f1'}
              />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
