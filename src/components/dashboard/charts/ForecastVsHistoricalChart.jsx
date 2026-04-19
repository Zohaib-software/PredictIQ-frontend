import { useMemo } from 'react';
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
import { formatChartAxisGBP, formatGbp } from '../../../utils/displayFormat';

const FORECAST_VS_HISTORICAL_LEGEND_GROUPS = {
  historicalCashFlow: ['historicalCashFlow'],
  predictedCashFlow: ['predictedCashFlow'],
};

const FORECAST_VS_HIST_ACTUAL_PROJ_PAIRS = [
  { actual: 'historicalCashFlow', projected: 'predictedCashFlow' },
];

/**
 * @param {{
 *   chartRows: Array<{ period: string, historicalCashFlow?: number | null, predictedCashFlow?: number | null }>,
 * }} props
 */
export function ForecastVsHistoricalChart({ chartRows }) {
  const { reducedMotionEnabled } = useReducedMotionSetting();
  const lineAnim = !reducedMotionEnabled;
  const hasPredictedInView = useMemo(
    () =>
      (chartRows ?? []).some(
        (r) => r.predictedCashFlow != null && Number.isFinite(Number(r.predictedCashFlow))
      ),
    [chartRows]
  );

  const { hidden, onLegendClick } = useLegendToggleGroups(FORECAST_VS_HISTORICAL_LEGEND_GROUPS);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartRows} margin={{ top: 26, right: 16, left: 4, bottom: 12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
        <XAxis dataKey="period" stroke="var(--color-secondary-text)" />
        <YAxis stroke="var(--color-secondary-text)" tickFormatter={formatChartAxisGBP} />
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
                formatter={(value, name) => [
                  value != null ? formatGbp(Number(value)) : '—',
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
          wrapperStyle={{ cursor: 'pointer' }}
          onClick={onLegendClick}
          formatter={(value, entry) => (
            <span
              style={{
                opacity: hidden.has(String(entry.dataKey)) ? 0.45 : 1,
              }}
            >
              {value}
            </span>
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
