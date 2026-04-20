import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  DefaultTooltipContent,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLegendToggleGroups } from '../../../hooks/useLegendToggleGroups';
import { useReducedMotionSetting } from '../../../context/ReducedMotionContext';
import { filterTooltipPayloadPreferActualOverProjection } from '../../../utils/chartLegendVisibility';
import {
  StructuredChartLegend,
  structuredLegendChartBottom,
  structuredLegendWrapperStyle,
} from '../StructuredChartLegend';
import { formatChartAxisGBP, formatChartAxisGBPNarrow, formatGbp } from '../../../utils/displayFormat';
import { paddedNumericDomain } from '../../../utils/chartAxisDomain';

const FORECAST_VS_HISTORICAL_LEGEND_GROUPS = {
  historicalCashFlow: ['historicalCashFlow'],
  predictedCashFlow: ['predictedCashFlow'],
};

const FORECAST_VS_HIST_ACTUAL_PROJ_PAIRS = [
  { actual: 'historicalCashFlow', projected: 'predictedCashFlow' },
];

const FORECAST_LEGEND_SHORT_LABELS = {
  historicalCashFlow: 'Historical',
  predictedCashFlow: 'Predicted',
};

/**
 * @param {{
 *   chartRows: Array<{ period: string, historicalCashFlow?: number | null, predictedCashFlow?: number | null }>,
 * }} props
 */
export function ForecastVsHistoricalChart({ chartRows }) {
  const { reducedMotionEnabled } = useReducedMotionSetting();
  const lineAnim = !reducedMotionEnabled;
  const [narrowChartLayout, setNarrowChartLayout] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setNarrowChartLayout(false);
      return undefined;
    }
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => setNarrowChartLayout(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const hasPredictedInView = useMemo(
    () =>
      (chartRows ?? []).some(
        (r) => r.predictedCashFlow != null && Number.isFinite(Number(r.predictedCashFlow))
      ),
    [chartRows]
  );

  const { hidden, onLegendClick } = useLegendToggleGroups(FORECAST_VS_HISTORICAL_LEGEND_GROUPS);

  const legendRows = useMemo(
    () =>
      hasPredictedInView ?
        [['historicalCashFlow'], ['predictedCashFlow']]
      : [['historicalCashFlow']],
    [hasPredictedInView]
  );
  const legendBottom = useMemo(() => structuredLegendChartBottom(legendRows), [legendRows]);

  const chartYDomain = useMemo(() => {
    const rows = chartRows ?? [];
    if (!rows.length) return ['auto', 'auto'];
    return paddedNumericDomain([
      rows.map((r) => r.historicalCashFlow),
      rows.map((r) => r.predictedCashFlow),
    ]);
  }, [chartRows]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartRows}
        margin={{
          top: 12,
          right: narrowChartLayout ? 8 : 14,
          left: narrowChartLayout ? 2 : 6,
          bottom: legendBottom,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
        <XAxis
          dataKey="period"
          stroke="var(--color-secondary-text)"
          tick={{
            fontSize: narrowChartLayout ? 10 : 12,
            fill: 'var(--color-secondary-text)',
          }}
          minTickGap={narrowChartLayout ? 16 : 28}
          interval="preserveStartEnd"
        />
        <YAxis
          stroke="var(--color-secondary-text)"
          tick={{
            fontSize: narrowChartLayout ? 10 : 13,
            fill: 'var(--color-secondary-text)',
            dx: narrowChartLayout ? -2 : 0,
          }}
          tickFormatter={narrowChartLayout ? formatChartAxisGBPNarrow : formatChartAxisGBP}
          tickMargin={narrowChartLayout ? 1 : 8}
          width={narrowChartLayout ? 34 : 58}
          tickCount={narrowChartLayout ? 4 : undefined}
          domain={chartYDomain}
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
                  FORECAST_VS_HIST_ACTUAL_PROJ_PAIRS
                )}
                label={label}
                labelFormatter={(l) => `Period: ${l}`}
                formatter={(value, name) => [
                  value != null ? formatGbp(Number(value)) : '-',
                  name,
                ]}
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
          wrapperStyle={{ ...structuredLegendWrapperStyle, paddingTop: 0 }}
          content={(lp) => (
            <StructuredChartLegend
              payload={lp.payload}
              hidden={hidden}
              dimPairs={FORECAST_VS_HIST_ACTUAL_PROJ_PAIRS}
              onItemClick={onLegendClick}
              rows={legendRows}
              shortLabels={FORECAST_LEGEND_SHORT_LABELS}
            />
          )}
        />
        <Line
          type="monotone"
          dataKey="historicalCashFlow"
          name="Historical cash flow"
          stroke="var(--color-accent)"
          strokeWidth={2}
          dot={{ r: 2 }}
          isAnimationActive={lineAnim}
          hide={hidden.has('historicalCashFlow')}
        />
        {hasPredictedInView ? (
          <Line
            type="monotone"
            dataKey="predictedCashFlow"
            name="Predicted cash flow"
            stroke="#6D5BD0"
            strokeWidth={2}
            strokeDasharray="8 4"
            dot={{ r: 2 }}
            connectNulls
            isAnimationActive={lineAnim}
            hide={hidden.has('predictedCashFlow')}
          />
        ) : null}
      </LineChart>
    </ResponsiveContainer>
  );
}
