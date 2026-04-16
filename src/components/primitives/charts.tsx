'use client';

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell,
} from 'recharts';
import { formatPLN, formatInt } from '@/lib/format';

const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
  'var(--color-chart-7)',
  'var(--color-chart-8)',
];

const axisStyle = {
  fill: 'var(--color-ink-tertiary)',
  fontSize: 11,
  fontFamily: 'var(--font-text)',
};

const gridStyle = {
  stroke: 'var(--color-border-subtle)',
  strokeDasharray: '3 4',
};

function TooltipBox({ active, payload, label, money, fmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[10px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] shadow-[var(--shadow-popover)] p-2.5 text-[12px]">
      <div className="font-semibold text-[var(--color-ink-primary)] mb-1.5">{label}</div>
      <div className="flex flex-col gap-1">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-[var(--color-ink-secondary)]">{p.name}</span>
            <span className="ml-auto font-semibold numeric text-[var(--color-ink-primary)]">
              {fmt ? fmt(p.value) : money ? formatPLN(p.value) : formatInt(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Line ------------------------------------------------------ */

export type LineSeries = {
  key: string;
  label: string;
  color?: string;
  axis?: 'left' | 'right';
  money?: boolean;
};

export function ChartLine({
  data,
  xKey = 'date',
  series,
  height = 240,
}: {
  data: Array<Record<string, any>>;
  xKey?: string;
  series: LineSeries[];
  height?: number;
}) {
  const hasRight = series.some((s) => s.axis === 'right');
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: hasRight ? 8 : 16, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridStyle} vertical={false} />
        <XAxis
          dataKey={xKey}
          axisLine={false}
          tickLine={false}
          tick={axisStyle as any}
          tickFormatter={(d: string) => (d?.length === 10 ? d.slice(5) : d)}
          minTickGap={24}
        />
        <YAxis
          yAxisId="left"
          axisLine={false}
          tickLine={false}
          tick={axisStyle as any}
          tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
          width={44}
        />
        {hasRight && (
          <YAxis
            yAxisId="right"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={axisStyle as any}
            tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            width={44}
          />
        )}
        <Tooltip content={(p) => <TooltipBox {...p} />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, color: 'var(--color-ink-secondary)', paddingTop: 10 }}
        />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            yAxisId={s.axis === 'right' ? 'right' : 'left'}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ---- Area (filled spark) -------------------------------------- */

export function ChartArea({
  data,
  xKey = 'date',
  series,
  height = 240,
}: {
  data: Array<Record<string, any>>;
  xKey?: string;
  series: LineSeries[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s, i) => {
            const color = s.color ?? CHART_COLORS[i % CHART_COLORS.length];
            return (
              <linearGradient id={`g-${s.key}`} key={s.key} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid {...gridStyle} vertical={false} />
        <XAxis
          dataKey={xKey}
          axisLine={false}
          tickLine={false}
          tick={axisStyle as any}
          tickFormatter={(d: string) => (d?.length === 10 ? d.slice(5) : d)}
          minTickGap={24}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={axisStyle as any}
          tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
          width={44}
        />
        <Tooltip content={(p) => <TooltipBox {...p} />} />
        {series.map((s, i) => {
          const color = s.color ?? CHART_COLORS[i % CHART_COLORS.length];
          return (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={color}
              strokeWidth={2}
              fill={`url(#g-${s.key})`}
            />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ---- Bar (horizontal or vertical) ----------------------------- */

export function ChartBar({
  data,
  xKey,
  yKey,
  label,
  height = 240,
  money = false,
  color = CHART_COLORS[1],
  horizontal = false,
}: {
  data: Array<Record<string, any>>;
  xKey: string;
  yKey: string;
  label?: string;
  height?: number;
  money?: boolean;
  color?: string;
  horizontal?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 8, right: 8, left: horizontal ? 80 : 0, bottom: 0 }}
      >
        <CartesianGrid {...gridStyle} vertical={!horizontal} horizontal={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" axisLine={false} tickLine={false} tick={axisStyle as any}
              tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              width={44}
            />
            <YAxis dataKey={xKey} type="category" axisLine={false} tickLine={false} tick={axisStyle as any} width={110} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={axisStyle as any}
              tickFormatter={(d: string) => (typeof d === 'string' && d.length === 10 ? d.slice(5) : d)}
              minTickGap={24}
            />
            <YAxis axisLine={false} tickLine={false} tick={axisStyle as any}
              tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              width={44}
            />
          </>
        )}
        <Tooltip content={(p) => <TooltipBox {...p} money={money} />} />
        <Bar dataKey={yKey} name={label ?? yKey} fill={color} radius={[6, 6, 6, 6]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---- Donut ---------------------------------------------------- */

export function ChartDonut({
  data,
  nameKey,
  valueKey,
  height = 220,
}: {
  data: Array<Record<string, any>>;
  nameKey: string;
  valueKey: string;
  height?: number;
}) {
  const total = data.reduce((s, d) => s + Number(d[valueKey] ?? 0), 0);
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            innerRadius="60%"
            outerRadius="86%"
            paddingAngle={1.5}
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={(p) => <TooltipBox {...p} money />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="overline">Total</span>
        <span className="hero-numeral text-[22px] mt-1 tabular text-[var(--color-ink-primary)]">
          {formatPLN(total)}
        </span>
      </div>
    </div>
  );
}
