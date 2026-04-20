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
import { useFinancialRecords, EMPTY_FINANCIAL_CHART_MESSAGE } from '../../../context/FinancialRecordsContext';
import { useReducedMotionSetting } from '../../../context/ReducedMotionContext';
import { useLegendToggleGroups } from '../../../hooks/useLegendToggleGroups';
import {
  filterTooltipPayloadPreferActualOverProjection,
  projectedLineHidden,
  tooltipDatumHasActualValue,
} from '../../../utils/chartLegendVisibility';
import {
  StructuredChartLegend,
  structuredLegendChartBottom,
  structuredLegendWrapperStyle,
} from '../StructuredChartLegend';
import { chartProjectionStroke } from '../../../theme';
import { paddedNumericDomain } from '../../../utils/chartAxisDomain';
import { formatDecimal, formatGbp, formatPercentPoints } from '../../../utils/displayFormat';
import { addMonthsToPeriodLabel, projectForwardIndices } from '../../../utils/seriesProjection';
import { filterForecastChartRowsByDateRange } from '../../../utils/forecastChartDisplay';

/** Historical margin (success green) */
const HIST_LINE = 'var(--color-success)';

const PROFIT_MARGIN_LEGEND_GROUPS = {
  profit_margin: ['profit_margin'],
  marginProj: ['marginProj'],
};

const PROFIT_MARGIN_ACTUAL_PROJ_PAIRS = [
  { actual: 'profit_margin', projected: 'marginProj' },
];

const PROFIT_MARGIN_LEGEND_SHORT_LABELS = {
  marginProj: 'Proj.',
};

const PROFIT_MARGIN_TOOLTIP_PANEL_STYLE = {
  background: 'var(--color-card-bg)',
  border: '1px solid var(--color-border-light)',
  borderRadius: 8,
};

/** Matches overview revenue line accent */
const PROFIT_MARGIN_TOOLTIP_REVENUE_COLOR = 'var(--color-primary, #37C1A5)';
/** Matches overview gross profit line */
const PROFIT_MARGIN_TOOLTIP_GROSS_COLOR = '#2ecc71';

function ProfitMarginTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const filteredPayload = filterTooltipPayloadPreferActualOverProjection(
    payload,
    PROFIT_MARGIN_ACTUAL_PROJ_PAIRS
  );
  const showRevenue = tooltipDatumHasActualValue(row, 'total_revenue');
  const showGross = tooltipDatumHasActualValue(row, 'gross_profit');

  return (
    <div style={PROFIT_MARGIN_TOOLTIP_PANEL_STYLE}>
      <DefaultTooltipContent
        active={active}
        payload={filteredPayload}
        label={label}
        formatter={(value, name) =>
          value != null && Number.isFinite(Number(value))
            ? [formatPercentPoints(Number(value), 2), name]
            : [null, name]
        }
        labelFormatter={(l) => `Period: ${l ?? row?.period ?? ''}`}
        contentStyle={{
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
        }}
        labelStyle={{ color: 'var(--color-secondary-text)', fontWeight: 600 }}
      />
      {(showRevenue || showGross) && (
        <ul
          style={{
            margin: 0,
            padding: '0 10px 10px',
            listStyle: 'none',
            fontSize: 12,
          }}
        >
          {showRevenue && (
            <li style={{ paddingTop: 4, color: PROFIT_MARGIN_TOOLTIP_REVENUE_COLOR }}>
              <span className="recharts-tooltip-item-name">Revenue</span>
              <span className="recharts-tooltip-item-separator"> : </span>
              <span style={{ fontWeight: 500 }}>{formatGbp(row.total_revenue)}</span>
            </li>
          )}
          {showGross && (
            <li style={{ paddingTop: 4, color: PROFIT_MARGIN_TOOLTIP_GROSS_COLOR }}>
              <span className="recharts-tooltip-item-name">Gross profit</span>
              <span className="recharts-tooltip-item-separator"> : </span>
              <span style={{ fontWeight: 500 }}>{formatGbp(row.gross_profit)}</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export function ProfitMarginChart({
  data,
  projectionMonths = 1,
  enableProjection = true,
  startDate = '',
  endDate = '',
}) {
  const { reducedMotionEnabled } = useReducedMotionSetting();
  const { hasFinancialRecords } = useFinancialRecords();
  const projectionActive = hasFinancialRecords;
  const { hidden, onLegendClick } = useLegendToggleGroups(PROFIT_MARGIN_LEGEND_GROUPS);

  if (!data?.date?.length) {
    return (
      <div
        className="chart-empty-financial-copy"
        style={{ padding: 48, color: 'var(--color-secondary-text)', fontSize: 14 }}
      >
        {EMPTY_FINANCIAL_CHART_MESSAGE}
      </div>
    );
  }

  const baseRows = data.date.map((d, i) => ({
    period: d,
    profit_margin: data.profit_margin?.[i] ?? 0,
    total_revenue: data.total_revenue?.[i] ?? 0,
    gross_profit: data.gross_profit?.[i] ?? 0,
    marginProj: null,
  }));

  const hasAnyMargin = baseRows.some((s) => Number(s.profit_margin) !== 0);
  if (!hasAnyMargin) {
    return (
      <div
        className="chart-empty-financial-copy"
        style={{ padding: 48, color: 'var(--color-secondary-text)', fontSize: 14 }}
      >
        {EMPTY_FINANCIAL_CHART_MESSAGE}
      </div>
    );
  }

  let mergedRows = baseRows;
  if (enableProjection && projectionActive && baseRows.length >= 2) {
    try {
      const marginValues = data.date.map((_, i) => Number(data.profit_margin?.[i]));
      const pred = projectForwardIndices(marginValues, projectionMonths);
      if (pred.length > 0) {
        const lastLabel = data.date[data.date.length - 1];
        const bridged = baseRows.map((row, i) =>
          i === baseRows.length - 1 ? { ...row, marginProj: row.profit_margin } : row
        );
        const future = pred.map((v, j) => ({
          period: addMonthsToPeriodLabel(lastLabel, j + 1),
          profit_margin: null,
          total_revenue: null,
          gross_profit: null,
          marginProj: v,
        }));
        mergedRows = [...bridged, ...future];
      }
    } catch {
      mergedRows = baseRows;
    }
  }

  const chartRows = filterForecastChartRowsByDateRange(mergedRows, startDate, endDate);

  if (!chartRows.length) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-secondary-text)', fontSize: 14 }}>
        No profit margin data in the selected date range. Adjust the filters or reset.
      </div>
    );
  }

  const yDomain = paddedNumericDomain(
    [
      chartRows.map((r) => r.profit_margin).filter((v) => v != null),
      chartRows.map((r) => r.marginProj).filter((v) => v != null),
    ],
    { padRatio: 0.06 }
  );

  const showProj =
    enableProjection &&
    projectionActive &&
    baseRows.length >= 2 &&
    chartRows.some((r) => r.marginProj != null);
  const lineAnim = !reducedMotionEnabled && chartRows.length <= 60;

  const legendRows = useMemo(
    () => (showProj ? [['profit_margin'], ['marginProj']] : [['profit_margin']]),
    [showProj]
  );
  const legendBottom = useMemo(() => structuredLegendChartBottom(legendRows), [legendRows]);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart
        data={chartRows}
        margin={{
          top: 10,
          bottom: Math.max(10, legendBottom),
          /* Recharts adds default YAxis width (60) to margin.left, which skews the plot right.
             Keep left+right inset sum stable so plot width unchanged while balancing gutters. */
          left: 2,
          right: 42,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
        <XAxis
          dataKey="period"
          stroke="var(--color-secondary-text)"
          fontSize={12}
        />
        <YAxis
          width={40}
          stroke="var(--color-secondary-text)"
          fontSize={12}
          tickFormatter={(v) => `${formatDecimal(v, 0)}%`}
          domain={yDomain}
        />
        <Tooltip
          allowEscapeViewBox={{ x: false, y: false }}
          content={(tipProps) => <ProfitMarginTooltip {...tipProps} />}
        />
        <Legend
          verticalAlign="bottom"
          align="center"
          wrapperStyle={structuredLegendWrapperStyle}
          content={(lp) => (
            <StructuredChartLegend
              payload={lp.payload}
              hidden={hidden}
              dimPairs={PROFIT_MARGIN_ACTUAL_PROJ_PAIRS}
              onItemClick={onLegendClick}
              rows={legendRows}
              shortLabels={PROFIT_MARGIN_LEGEND_SHORT_LABELS}
            />
          )}
        />
        <Line
          type="linear"
          dataKey="profit_margin"
          name="Profit margin %"
          stroke={HIST_LINE}
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={lineAnim}
          hide={hidden.has('profit_margin')}
        />
        {showProj && (
          <Line
            type="linear"
            dataKey="marginProj"
            name="Linear projection"
            stroke={chartProjectionStroke}
            strokeWidth={2}
            strokeDasharray="8 4"
            dot={false}
            connectNulls
            isAnimationActive={lineAnim}
            hide={projectedLineHidden(hidden, 'profit_margin', 'marginProj')}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
