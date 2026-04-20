import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { chartColors } from '../../../theme';
import { useReducedMotionSetting } from '../../../context/ReducedMotionContext';
import { countAxisDomain } from '../../../utils/chartAxisDomain';
import { formatInteger } from '../../../utils/displayFormat';

function integerCountTicks(yMax) {
  const max = Math.max(1, Math.ceil(Number(yMax) || 0));
  if (max <= 1) return [0, 1];
  const step =
    max <= 10 ? 1 : max <= 25 ? 5 : max <= 50 ? 10 : Math.max(10, Math.ceil(max / 5));
  const ticks = [0];
  for (let t = step; t < max; t += step) {
    ticks.push(t);
  }
  if (ticks[ticks.length - 1] !== max) ticks.push(max);
  return ticks;
}

export function RoiHistogramChart({ data }) {
  const { reducedMotionEnabled } = useReducedMotionSetting();
  const labels = data?.binLabels ?? [];
  const rawCounts = data?.counts ?? [];
  if (labels.length === 0) return null;
  const counts = rawCounts.map((c) => Math.round(Math.max(0, Number(c) || 0)));
  const series = labels.map((label, i) => ({ bin: label, count: counts[i] ?? 0 }));
  const yDomain = countAxisDomain(counts);
  const yMax = yDomain[1];
  const yTicks = useMemo(() => integerCountTicks(yMax), [yMax]);

  const binCount = labels.length;
  const xAxisHeight = binCount > 10 ? 96 : 72;
  const bottomMargin = binCount > 10 ? 20 : 10;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={series}
        margin={{ top: 8, right: 12, left: 10, bottom: bottomMargin }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
        <XAxis
          dataKey="bin"
          stroke="var(--color-secondary-text)"
          fontSize={binCount > 10 ? 10 : 11}
          interval={0}
          angle={-40}
          textAnchor="end"
          height={xAxisHeight}
        />
        <YAxis
          stroke="var(--color-secondary-text)"
          fontSize={12}
          width={48}
          domain={yDomain}
          ticks={yTicks}
          allowDecimals={false}
          tickFormatter={(v) => formatInteger(v)}
        />
        <Tooltip
          allowEscapeViewBox={{ x: false, y: false }}
          contentStyle={{
            background: 'var(--color-card-bg)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 8,
          }}
          formatter={(value) => [(value != null ? formatInteger(value) : '-'), 'Count']}
          labelFormatter={(l) => `ROI range: ${l}`}
        />
        <Bar
          dataKey="count"
          name="Count"
          fill={chartColors[0]}
          radius={[4, 4, 0, 0]}
          isAnimationActive={!reducedMotionEnabled}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
