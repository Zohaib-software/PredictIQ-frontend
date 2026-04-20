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
import { useLegendToggleGroups } from '../../../hooks/useLegendToggleGroups';
import { useReducedMotionSetting } from '../../../context/ReducedMotionContext';
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

const AD_REV_LEGEND_GROUPS = {
  ad_spend: ['ad_spend'],
  adProj: ['adProj'],
  total_revenue: ['total_revenue'],
  revProj: ['revProj'],
};

const AD_REV_ACTUAL_PROJ_PAIRS = [
  { actual: 'ad_spend', projected: 'adProj' },
  { actual: 'total_revenue', projected: 'revProj' },
];

const AD_REV_LEGEND_SHORT_LABELS = {
  adProj: 'Ad (proj.)',
  revProj: 'Rev. (proj.)',
};

/**
 * @param {{
 *   chartRows: Array<{ period: string, ad_spend: number|null, total_revenue: number|null, adProj: number|null, revProj: number|null }>,
 *   showProjectedSeries?: boolean,
 * }} props
 */
export function AdSpendRevenueChart({ chartRows, showProjectedSeries = false }) {
  const { reducedMotionEnabled } = useReducedMotionSetting();
  const lineAnim = !reducedMotionEnabled;
  const { hidden, onLegendClick } = useLegendToggleGroups(AD_REV_LEGEND_GROUPS);

  if (!chartRows?.length) return null;

  const yDomain = paddedNumericDomain([
    chartRows.map((r) => r.ad_spend).filter((v) => v != null),
    chartRows.map((r) => r.total_revenue).filter((v) => v != null),
    chartRows.map((r) => r.adProj).filter((v) => v != null),
    chartRows.map((r) => r.revProj).filter((v) => v != null),
  ]);

  const legendRows = useMemo(
    () =>
      showProjectedSeries ?
        [
          ['ad_spend', 'total_revenue'],
          ['adProj', 'revProj'],
        ]
      : [['ad_spend', 'total_revenue']],
    [showProjectedSeries]
  );
  const legendBottom = useMemo(() => structuredLegendChartBottom(legendRows), [legendRows]);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartRows} margin={{ top: 10, right: 12, left: 4, bottom: legendBottom }}>
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
                  AD_REV_ACTUAL_PROJ_PAIRS
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
              dimPairs={AD_REV_ACTUAL_PROJ_PAIRS}
              onItemClick={onLegendClick}
              rows={legendRows}
              shortLabels={AD_REV_LEGEND_SHORT_LABELS}
            />
          )}
        />
        <Line
          type="monotone"
          dataKey="ad_spend"
          name="Ad Spend"
          stroke={chartColors[2]}
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={lineAnim}
          hide={hidden.has('ad_spend')}
        />
        <Line
          type="monotone"
          dataKey="total_revenue"
          name="Revenue"
          stroke={chartColors[0]}
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={lineAnim}
          hide={hidden.has('total_revenue')}
        />
        {showProjectedSeries && (
          <>
            <Line
              type="monotone"
              dataKey="adProj"
              name="Ad spend (projected)"
              stroke={chartProjectionStroke}
              strokeWidth={2}
              strokeDasharray="8 4"
              dot={false}
              connectNulls
              isAnimationActive={lineAnim}
              hide={projectedLineHidden(hidden, 'ad_spend', 'adProj')}
            />
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
              hide={projectedLineHidden(hidden, 'total_revenue', 'revProj')}
            />
          </>
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
