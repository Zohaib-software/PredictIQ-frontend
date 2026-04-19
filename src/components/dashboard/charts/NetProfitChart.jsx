import { useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useFinancialRecords } from '../../../context/FinancialRecordsContext';
import { useReducedMotionSetting } from '../../../context/ReducedMotionContext';
import { chartColors, chartProjectionStroke } from '../../../theme';
import { paddedNumericDomain } from '../../../utils/chartAxisDomain';
import { formatChartAxisGBP, formatGbp } from '../../../utils/displayFormat';
import { getFuturePeriodLabels, projectForwardIndices } from '../../../utils/seriesProjection';

const ACTUAL_FILL = chartColors[0];

/**
 * @param {{ date: string[], netProfit?: number[] }} data
 * @param {number} projectionMonths
 * @param {'daily'|'weekly'|'monthly'|'yearly'} periodType — bucket style for projection x-axis labels
 */
export function NetProfitChart({ data, projectionMonths = 1, periodType = 'monthly' }) {
  const { reducedMotionEnabled } = useReducedMotionSetting();
  const { hasFinancialRecords } = useFinancialRecords();
  const projectionActive = hasFinancialRecords;
  const [hiddenLegendIds, setHiddenLegendIds] = useState(() => new Set());

  const onNetLegendClick = useCallback((e) => {
    const id = e?.id ?? e?.payload?.id;
    const v = String(e?.value ?? '');
    let key = null;
    if (id === 'actual' || v === 'Actual') key = 'actual';
    if (id === 'proj' || v === 'Projected (linear trend)') key = 'proj';
    if (!key) return;
    setHiddenLegendIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (!data?.date?.length) return null;

  const baseRows = data.date.map((d, i) => ({
    period: d,
    netProfit: data.netProfit?.[i] ?? 0,
    netProj: null,
  }));

  let extended = baseRows;
  if (projectionActive && baseRows.length >= 2) {
    const pred = projectForwardIndices(
      data.date.map((_, i) => data.netProfit?.[i] ?? 0),
      projectionMonths
    );
    if (pred.length > 0) {
      const lastLabel = data.date[data.date.length - 1];
      const futureLabels = getFuturePeriodLabels(lastLabel, periodType, pred.length);
      if (futureLabels && futureLabels.length === pred.length) {
        const future = pred.map((v, j) => ({
          period: futureLabels[j],
          netProfit: null,
          netProj: v,
        }));
        extended = [...baseRows, ...future];
      }
    }
  }

  /** One value per row + flag so a single Bar is full-width (avoids grouped half-width projected bars). */
  const chartRows = extended.map((r) => {
    const isProjected = r.netProj != null && r.netProfit == null;
    const barValue = r.netProfit != null ? r.netProfit : r.netProj;
    return {
      ...r,
      barValue,
      isProjected,
    };
  });

  const yDomain = paddedNumericDomain(
    [
      data.netProfit,
      chartRows.map((r) => r.netProj).filter((v) => v != null),
    ],
    { includeZeroIfStraddles: true }
  );

  const showProj = projectionActive && baseRows.length >= 2;

  const legendPayload = [
    { value: 'Actual', type: 'rect', id: 'actual', color: ACTUAL_FILL },
    ...(showProj
      ? [{ value: 'Projected (linear trend)', type: 'rect', id: 'proj', color: chartProjectionStroke }]
      : []),
  ];

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartRows} margin={{ top: 10, right: 12, left: 4, bottom: 12 }}>
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
          cursor={{ fill: 'rgba(55, 193, 165, 0.08)', stroke: 'transparent' }}
          contentStyle={{
            background: 'var(--color-card-bg)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 8,
            color: 'var(--color-primary-text)',
          }}
          labelStyle={{ color: 'var(--color-primary-text)' }}
          itemStyle={{ color: 'var(--color-primary-text)' }}
          formatter={(value, _name, item) =>
            value != null
              ? [
                  formatGbp(value),
                  item?.payload?.isProjected ? 'Net profit (projected)' : 'Net profit (actual)',
                ]
              : [null, null]
          }
          labelFormatter={(l) => `Period: ${l}`}
        />
        <Legend
          wrapperStyle={{ cursor: 'pointer', fontSize: 12, paddingTop: 8 }}
          payload={legendPayload}
          onClick={onNetLegendClick}
          formatter={(value, entry) => {
            const id = entry?.id ?? entry?.payload?.id;
            const dim =
              ((id === 'actual' || value === 'Actual') && hiddenLegendIds.has('actual')) ||
              ((id === 'proj' || value === 'Projected (linear trend)') &&
                hiddenLegendIds.has('proj'));
            return <span style={{ opacity: dim ? 0.45 : 1 }}>{value}</span>;
          }}
        />
        <Bar
          dataKey="barValue"
          name="Net profit"
          radius={[4, 4, 0, 0]}
          isAnimationActive={!reducedMotionEnabled}
          activeBar={{ stroke: 'var(--color-accent)', strokeWidth: 1 }}
        >
          {chartRows.map((entry, index) => {
            const hideCell =
              (entry.isProjected && hiddenLegendIds.has('proj')) ||
              (!entry.isProjected && hiddenLegendIds.has('actual'));
            return (
              <Cell
                key={`cell-${entry.period}-${index}`}
                fill={entry.isProjected ? chartProjectionStroke : ACTUAL_FILL}
                fillOpacity={hideCell ? 0 : entry.isProjected ? 0.95 : 1}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
