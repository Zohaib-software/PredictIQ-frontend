import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  DefaultTooltipContent,
} from 'recharts';
import { useFinancialRecords } from '../../../context/FinancialRecordsContext';
import { useReducedMotionSetting } from '../../../context/ReducedMotionContext';
import { useLegendToggleGroups } from '../../../hooks/useLegendToggleGroups';
import {
  filterTooltipPayloadPreferActualOverProjection,
  legendEntryDimmed,
  projectedLineHidden,
} from '../../../utils/chartLegendVisibility';
import { chartColors, chartProjectionStroke } from '../../../theme';
import { paddedNumericDomain } from '../../../utils/chartAxisDomain';
import { formatChartAxisGBP, formatGbp } from '../../../utils/displayFormat';
import { getFuturePeriodLabels, projectForwardIndices } from '../../../utils/seriesProjection';

const REV_EXP_LEGEND_GROUPS = {
  revenue: ['revenue'],
  revProj: ['revProj'],
  expenses: ['expenses'],
  expProj: ['expProj'],
};

const REV_EXP_ACTUAL_PROJ_PAIRS = [
  { actual: 'revenue', projected: 'revProj' },
  { actual: 'expenses', projected: 'expProj' },
];

/**
 * @param {{ labels: string[], revenue?: number[], expenses?: number[] }} data
 * @param {'daily'|'weekly'|'monthly'|'yearly'} periodType — bucket style for projection x-axis labels
 */
export function RevenueExpensesChart({ data, projectionMonths = 1, periodType = 'monthly' }) {
  const { reducedMotionEnabled } = useReducedMotionSetting();
  const { hasFinancialRecords } = useFinancialRecords();
  const projectionActive = hasFinancialRecords;
  const { hidden, onLegendClick } = useLegendToggleGroups(REV_EXP_LEGEND_GROUPS);

  if (!data?.labels?.length) return null;

  const baseRows = data.labels.map((label, i) => ({
    period: label,
    revenue: data.revenue?.[i] ?? 0,
    expenses: data.expenses?.[i] ?? 0,
    revProj: null,
    expProj: null,
  }));

  let chartRows = baseRows;
  if (projectionActive && baseRows.length >= 2) {
    const hr = projectForwardIndices(
      data.labels.map((_, i) => data.revenue?.[i] ?? 0),
      projectionMonths
    );
    const he = projectForwardIndices(
      data.labels.map((_, i) => data.expenses?.[i] ?? 0),
      projectionMonths
    );
    if (hr.length > 0) {
      const lastLabel = data.labels[data.labels.length - 1];
      const futureLabels = getFuturePeriodLabels(lastLabel, periodType, hr.length);
      if (futureLabels && futureLabels.length === hr.length) {
        const bridged = baseRows.map((row, i) =>
          i === baseRows.length - 1
            ? { ...row, revProj: row.revenue, expProj: row.expenses }
            : row
        );
        const future = hr.map((rv, j) => ({
          period: futureLabels[j],
          revenue: null,
          expenses: null,
          revProj: rv,
          expProj: he[j],
        }));
        chartRows = [...bridged, ...future];
      }
    }
  }

  const yDomain = paddedNumericDomain([
    data.revenue,
    data.expenses,
    chartRows.map((r) => r.revProj).filter((v) => v != null),
    chartRows.map((r) => r.expProj).filter((v) => v != null),
  ]);

  const manyPoints = chartRows.length > 20;
  const dotProps = manyPoints ? false : { r: 3 };
  const showProj = projectionActive && baseRows.length >= 2;
  const lineAnim = !reducedMotionEnabled && chartRows.length <= 60;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart
        data={chartRows}
        margin={{ top: 10, right: 12, left: 4, bottom: 12 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
        <XAxis
          dataKey="period"
          stroke="var(--color-secondary-text)"
          tick={{ fontSize: 12, fill: 'var(--color-secondary-text)' }}
          minTickGap={28}
          interval="preserveStartEnd"
        />
        <YAxis
          stroke="var(--color-secondary-text)"
          tick={{ fontSize: 13, fill: 'var(--color-secondary-text)' }}
          tickFormatter={formatChartAxisGBP}
          tickCount={5}
          tickMargin={8}
          width={58}
          domain={yDomain}
        />
        <Tooltip
          allowEscapeViewBox={{ x: false, y: false }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <DefaultTooltipContent
                active={active}
                payload={filterTooltipPayloadPreferActualOverProjection(
                  payload,
                  REV_EXP_ACTUAL_PROJ_PAIRS
                )}
                label={label}
                formatter={(value, name) =>
                  value != null ? [formatGbp(value), name] : [null, name]
                }
                labelFormatter={(l) => `Period: ${l}`}
                contentStyle={{
                  background: 'var(--color-card-bg)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: 8,
                }}
              />
            );
          }}
        />
        <Legend
          wrapperStyle={{ cursor: 'pointer' }}
          onClick={onLegendClick}
          formatter={(value, entry) => (
            <span
              style={{
                opacity: legendEntryDimmed(hidden, entry.dataKey, REV_EXP_ACTUAL_PROJ_PAIRS)
                  ? 0.45
                  : 1,
              }}
            >
              {value}
            </span>
          )}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke={chartColors[0]}
          strokeWidth={2.25}
          dot={dotProps}
          activeDot={{ r: 5 }}
          isAnimationActive={lineAnim}
          connectNulls={false}
          hide={hidden.has('revenue')}
        />
        <Line
          type="monotone"
          dataKey="expenses"
          name="Expenses"
          stroke={chartColors[2]}
          strokeWidth={2.25}
          dot={dotProps}
          activeDot={{ r: 5 }}
          isAnimationActive={lineAnim}
          connectNulls={false}
          hide={hidden.has('expenses')}
        />
        {showProj && (
          <>
            <Line
              type="monotone"
              dataKey="revProj"
              name="Revenue (projected)"
              stroke={chartProjectionStroke}
              strokeWidth={2}
              strokeDasharray="8 4"
              dot={false}
              connectNulls
              isAnimationActive={lineAnim}
              hide={projectedLineHidden(hidden, 'revenue', 'revProj')}
            />
            <Line
              type="monotone"
              dataKey="expProj"
              name="Expenses (projected)"
              stroke={chartProjectionStroke}
              strokeWidth={2}
              strokeDasharray="8 4"
              dot={false}
              connectNulls
              isAnimationActive={lineAnim}
              hide={projectedLineHidden(hidden, 'expenses', 'expProj')}
            />
          </>
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
