import { useMemo } from 'react';
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
  projectedLineHidden,
} from '../../../utils/chartLegendVisibility';
import {
  StructuredChartLegend,
  structuredLegendChartBottom,
  structuredLegendWrapperStyle,
} from '../StructuredChartLegend';
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

const REV_EXP_LEGEND_SHORT_LABELS = {
  revProj: 'Rev. (proj.)',
  expProj: 'Exp. (proj.)',
};

/**
 * @param {{ labels: string[], revenue?: number[], expenses?: number[] }} data
 * @param {'daily'|'weekly'|'monthly'|'yearly'} periodType - bucket style for projection x-axis labels
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
  /** Recharts line animation: cap was 60 points, which hid anim for ~5y monthly data; keep a higher cap for UX */
  const lineAnim = !reducedMotionEnabled && chartRows.length <= 144;

  const legendRows = useMemo(
    () =>
      showProj ?
        [
          ['revenue', 'expenses'],
          ['revProj', 'expProj'],
        ]
      : [['revenue', 'expenses']],
    [showProj]
  );
  const legendBottom = useMemo(() => structuredLegendChartBottom(legendRows), [legendRows]);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart
        data={chartRows}
        margin={{ top: 10, right: 12, left: 4, bottom: legendBottom }}
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
          verticalAlign="bottom"
          align="center"
          wrapperStyle={structuredLegendWrapperStyle}
          content={(lp) => (
            <StructuredChartLegend
              payload={lp.payload}
              hidden={hidden}
              dimPairs={REV_EXP_ACTUAL_PROJ_PAIRS}
              onItemClick={onLegendClick}
              rows={legendRows}
              shortLabels={REV_EXP_LEGEND_SHORT_LABELS}
            />
          )}
        />
        <Line
          key={`rev-${!hidden.has('revenue')}`}
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke={chartColors[0]}
          strokeWidth={2.25}
          dot={dotProps}
          activeDot={{ r: 5 }}
          isAnimationActive={lineAnim}
          animationDuration={lineAnim ? 600 : 0}
          connectNulls={false}
          hide={hidden.has('revenue')}
        />
        <Line
          key={`exp-${!hidden.has('expenses')}`}
          type="monotone"
          dataKey="expenses"
          name="Expenses"
          stroke={chartColors[2]}
          strokeWidth={2.25}
          dot={dotProps}
          activeDot={{ r: 5 }}
          isAnimationActive={lineAnim}
          animationDuration={lineAnim ? 600 : 0}
          connectNulls={false}
          hide={hidden.has('expenses')}
        />
        {showProj && (
          <>
            <Line
              key={`revp-${!projectedLineHidden(hidden, 'revenue', 'revProj')}`}
              type="monotone"
              dataKey="revProj"
              name="Revenue (projected)"
              stroke={chartProjectionStroke}
              strokeWidth={2}
              strokeDasharray="8 4"
              dot={false}
              connectNulls
              isAnimationActive={lineAnim}
              animationDuration={lineAnim ? 600 : 0}
              hide={projectedLineHidden(hidden, 'revenue', 'revProj')}
            />
            <Line
              key={`expp-${!projectedLineHidden(hidden, 'expenses', 'expProj')}`}
              type="monotone"
              dataKey="expProj"
              name="Expenses (projected)"
              stroke={chartProjectionStroke}
              strokeWidth={2}
              strokeDasharray="8 4"
              dot={false}
              connectNulls
              isAnimationActive={lineAnim}
              animationDuration={lineAnim ? 600 : 0}
              hide={projectedLineHidden(hidden, 'expenses', 'expProj')}
            />
          </>
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
