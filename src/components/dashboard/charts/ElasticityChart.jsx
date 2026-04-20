import { useMemo, useState, useCallback } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  DefaultTooltipContent,
} from 'recharts';
import { useFinancialRecords } from '../../../context/FinancialRecordsContext';
import { chartColors, chartLinearTrendStroke, chartProjectionStroke } from '../../../theme';
import { formatDecimal, formatPercentPoints } from '../../../utils/displayFormat';
import { computeElasticityRegression } from '../../../utils/chartSeriesRange';
import {
  addMonthsToPeriodLabel,
  parseMonthlyLabelToYm,
  projectForwardIndicesExact,
} from '../../../utils/seriesProjection';
import styles from './ElasticityChart.module.css';
import {
  StructuredChartLegend,
  structuredLegendChartBottom,
  structuredLegendWrapperStyle,
  defaultLegendEntryKey,
} from '../StructuredChartLegend';

function padDomain1D(min, max, ratio = 0.12) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    const d = Math.abs(min) || 1;
    return [min - d * ratio * 5, max + d * ratio * 5];
  }
  const pad = (max - min) * ratio;
  return [min - pad, max + pad];
}

/** Normalise period labels to YYYY-MM for stepping future months. */
function periodToYm(period) {
  const s = String(period ?? '').trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  return parseMonthlyLabelToYm(s) || s;
}

function periodWithinDateFilter(period, startDate, endDate) {
  if (!startDate && !endDate) return true;
  const ym = parseMonthlyLabelToYm(String(period ?? '').trim());
  if (!ym) return false;
  const monthStart = `${ym}-01`;
  if (startDate && monthStart < startDate) return false;
  if (endDate && monthStart > endDate) return false;
  return true;
}

const ELASTICITY_TOOLTIP_PANEL_STYLE = {
  background: 'var(--color-card-bg)',
  border: '1px solid var(--color-border-light)',
  borderRadius: 8,
};

function elasticityTooltipHeader(row) {
  if (!row) return null;
  const isFit = row.kind === 'fit';
  const isProjected = row.kind === 'projected';
  if (isFit) return 'OLS fit segment';
  if (isProjected && row.period != null) return `Projected after ${row.period}`;
  if (!isFit && !isProjected && row.period != null) return `After period ending ${row.period}`;
  return null;
}

function elasticityTooltipSeriesColor(row) {
  if (!row) return chartColors[0];
  if (row.kind === 'fit') return chartLinearTrendStroke;
  if (row.kind === 'projected') return chartProjectionStroke;
  return chartColors[0];
}

function ElasticityTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  const color = elasticityTooltipSeriesColor(p);
  const header = elasticityTooltipHeader(p);
  const syntheticPayload = [
    {
      dataKey: 'deltaExpenses',
      name: 'Δ Expenses (vs prior month)',
      value: p.x,
      color,
    },
    {
      dataKey: 'deltaRevenue',
      name: 'Δ Revenue (vs prior month)',
      value: p.y,
      color,
    },
  ];

  return (
    <div style={ELASTICITY_TOOLTIP_PANEL_STYLE}>
      {header ? (
        <p
          style={{
            margin: 0,
            padding: '10px 10px 0',
            fontWeight: 600,
            fontSize: 12,
            color: 'var(--color-secondary-text)',
          }}
        >
          {header}
        </p>
      ) : null}
      <DefaultTooltipContent
        active={active}
        payload={syntheticPayload}
        formatter={(value, name) =>
          value != null && Number.isFinite(Number(value))
            ? [formatPercentPoints(Number(value), 2), name]
            : ['-', name]
        }
        contentStyle={{
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
        }}
      />
    </div>
  );
}

function HistoricalDot(props) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={chartColors[0]}
      stroke="var(--color-border-light)"
      strokeWidth={1}
    />
  );
}

function ProjectedDot(props) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill={chartProjectionStroke}
      stroke="var(--color-card-bg)"
      strokeWidth={1.5}
    />
  );
}

/**
 * Elasticity is the relationship between paired changes: each month is (Δ expenses %, Δ revenue %).
 * The backend fits OLS: Δ revenue ≈ intercept + slope × Δ expenses; slope is reported as elasticity.
 */
const MONTHS_LEGEND = 'Months (MoM % changes)';
const FIT_LEGEND = 'OLS fit (elasticity)';
const PROJECTED_LEGEND = 'Projected';

const ELASTICITY_LEGEND_SHORT_LABELS = {
  months: 'Months',
  fit: 'OLS fit',
  projected: 'Proj.',
};

export function ElasticityChart({
  data,
  startDate = '',
  endDate = '',
  projectionMonths = 1,
  enableProjection = true,
  /** Match Overview chart gutters on small viewports (Reports mobile). */
  narrowLayout = false,
}) {
  const { hasFinancialRecords } = useFinancialRecords();
  const projectionActive = hasFinancialRecords;
  const [legendHidden, setLegendHidden] = useState(() => new Set());

  const onElasticityLegendClick = useCallback((e) => {
    const label = String(e?.value ?? '');
    const key =
      label === MONTHS_LEGEND ? 'months' : label === FIT_LEGEND ? 'fit' : label === PROJECTED_LEGEND ? 'projected' : null;
    if (!key) return;
    setLegendHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const fullPeriod = data?.period ?? [];
  const fullDE = data?.deltaExpenses ?? [];
  const fullDR = data?.deltaRevenue ?? [];

  const points = useMemo(() => {
    const periods = data?.period ?? [];
    const de = data?.deltaExpenses ?? [];
    const dr = data?.deltaRevenue ?? [];
    const out = [];
    for (let i = 0; i < periods.length; i += 1) {
      const p = periods[i];
      if (!periodWithinDateFilter(p, startDate, endDate)) continue;
      out.push({
        x: Number(de[i]) || 0,
        y: Number(dr[i]) || 0,
        period: p,
        kind: 'actual',
      });
    }
    return out;
  }, [data, startDate, endDate]);

  const regression = useMemo(() => {
    if (points.length >= 2) {
      return computeElasticityRegression(
        points.map((pt) => pt.x),
        points.map((pt) => pt.y)
      );
    }
    return computeElasticityRegression(fullDE, fullDR);
  }, [points, fullDE, fullDR]);

  const intercept = regression?.intercept ?? null;
  const slope = regression?.slope ?? null;

  const baseHorizon = Math.max(1, Math.min(3, projectionMonths ?? 1));
  const projectedPoints = useMemo(() => {
    if (
      !enableProjection ||
      !projectionActive ||
      !regression ||
      intercept == null ||
      slope == null ||
      fullPeriod.length < 2
    ) {
      return [];
    }
    const fullYm = fullPeriod.map(periodToYm);
    const fullDeNums = fullDE.map(Number);
    const lastYm = fullYm[fullYm.length - 1];
    /** Same horizon as other monthly charts: 1–3 forward months from the chart controls (~30–90 days), not the width of the date filter. */
    const effectiveSteps = baseHorizon;
    const predX = projectForwardIndicesExact(fullDeNums, effectiveSteps);
    if (!predX.length) return [];
    const futurePeriods = predX.map((_, i) => addMonthsToPeriodLabel(lastYm, i + 1));
    const out = [];
    for (let j = 0; j < futurePeriods.length; j += 1) {
      const p = futurePeriods[j];
      const x = Number(predX[j]);
      if (!Number.isFinite(x)) continue;
      const y = intercept + slope * x;
      if (!periodWithinDateFilter(p, startDate, endDate)) continue;
      out.push({
        x,
        y,
        period: p,
        kind: 'projected',
      });
    }
    return out;
  }, [
    enableProjection,
    projectionActive,
    regression,
    intercept,
    slope,
    fullPeriod,
    fullDE,
    baseHorizon,
    startDate,
    endDate,
  ]);

  const showProjected = projectedPoints.length > 0;

  const elasticityLegendKey = useCallback((entry) => {
    const v = String(entry.value ?? '');
    if (v === MONTHS_LEGEND) return 'months';
    if (v === FIT_LEGEND) return 'fit';
    if (v === PROJECTED_LEGEND) return 'projected';
    return defaultLegendEntryKey(entry);
  }, []);

  const legendRows = useMemo(
    () =>
      showProjected ?
        [
          ['months', 'fit'],
          ['projected'],
        ]
      : [['months', 'fit']],
    [showProjected]
  );
  const legendBottom = useMemo(() => structuredLegendChartBottom(legendRows), [legendRows]);

  /**
   * Gap between x-axis title and legend on narrow viewports (keep small; total margin.bottom also
   * includes structuredLegendChartBottom, which is tuned for line charts and can over-reserve on scatter).
   */
  const NARROW_AXIS_LEGEND_GAP = 6;

  const chartMargin = useMemo(() => {
    if (!narrowLayout) {
      return { top: 34, right: 16, bottom: legendBottom, left: 44 };
    }
    const rowCount = legendRows.filter((r) => r?.length).length;
    /** Tighter than generic charts: 2-row legend + axis labels need less band than structuredLegendChartBottom alone. */
    const tightLegendReserve =
      rowCount >= 2 ? Math.max(22, legendBottom - 12) : Math.max(18, legendBottom - 4);
    return {
      top: 12,
      right: 8,
      bottom: tightLegendReserve + NARROW_AXIS_LEGEND_GAP,
      left: 14,
    };
  }, [narrowLayout, legendBottom, legendRows]);

  const yAxisWidth = narrowLayout ? 34 : 56;
  const tickFontSize = narrowLayout ? 10 : 12;
  const axisLabelFontSize = narrowLayout ? 10 : 11;
  /** Keeps the rotated y-axis title inside the SVG; small offset toward the axis. */
  const yLabelOffset = narrowLayout ? 2 : 6;
  /** Nudge rotated y-axis title slightly upward along the chart. */
  const yLabelDy = narrowLayout ? -10 : -6;
  /** Negative offset moves the bottom x-axis title slightly up (toward the plot). */
  const xLabelOffset = narrowLayout ? -5 : 4;

  const fitLine = useMemo(() => {
    if (intercept == null || slope == null || !Number.isFinite(intercept) || !Number.isFinite(slope)) {
      return [];
    }
    const xs = [...points.map((pt) => pt.x), ...projectedPoints.map((p) => p.x)];
    if (xs.length === 0) return [];
    let xMin = Math.min(...xs);
    let xMax = Math.max(...xs);
    if (!Number.isFinite(xMin) || !Number.isFinite(xMax)) return [];
    if (xMin === xMax) {
      const pad = Math.max(Math.abs(xMin) * 0.05, 1);
      xMin -= pad;
      xMax += pad;
    }
    return [
      { x: xMin, y: intercept + slope * xMin, kind: 'fit' },
      { x: xMax, y: intercept + slope * xMax, kind: 'fit' },
    ];
  }, [points, projectedPoints, intercept, slope]);

  const { xDomain, yDomain } = useMemo(() => {
    const xs = [
      ...points.map((p) => p.x),
      ...fitLine.map((f) => f.x),
      ...projectedPoints.map((p) => p.x),
    ];
    const ys = [
      ...points.map((p) => p.y),
      ...fitLine.map((f) => f.y),
      ...projectedPoints.map((p) => p.y),
    ];
    if (xs.length === 0) return { xDomain: [0, 1], yDomain: [0, 1] };
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    return {
      xDomain: padDomain1D(xMin, xMax),
      yDomain: padDomain1D(yMin, yMax),
    };
  }, [points, fitLine, projectedPoints]);

  if (!data?.period?.length) return null;

  const hasAnythingToPlot = points.length > 0 || projectedPoints.length > 0;
  if (!hasAnythingToPlot) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-secondary-text)', fontSize: 14 }}>
        No elasticity data in the selected date range. Adjust the filters or reset.
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={`${styles.chartArea} ${narrowLayout ? styles.chartAreaNarrow : ''}`.trim()}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
            <XAxis
              type="number"
              dataKey="x"
              name="Δ Expenses %"
              domain={xDomain}
              tickFormatter={(v) => `${formatDecimal(v, 0)}%`}
              stroke="var(--color-secondary-text)"
              tick={{ fontSize: tickFontSize, fill: 'var(--color-secondary-text)' }}
              minTickGap={narrowLayout ? 12 : undefined}
              label={{
                value: 'Δ Expenses vs prior month (%)',
                position: 'bottom',
                offset: xLabelOffset,
                dy: narrowLayout ? -4 : -2,
                fill: 'var(--color-secondary-text)',
                fontSize: axisLabelFontSize,
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Δ Revenue %"
              domain={yDomain}
              tickFormatter={(v) => `${formatDecimal(v, 0)}%`}
              stroke="var(--color-secondary-text)"
              tick={{
                fontSize: tickFontSize,
                fill: 'var(--color-secondary-text)',
                dx: narrowLayout ? -2 : 0,
              }}
              tickMargin={narrowLayout ? 1 : 8}
              width={yAxisWidth}
              label={{
                value: 'Δ Revenue vs prior month (%)',
                angle: -90,
                position: 'left',
                offset: yLabelOffset,
                dy: yLabelDy,
                fill: 'var(--color-secondary-text)',
                fontSize: axisLabelFontSize,
                style: { textAnchor: 'middle', dominantBaseline: 'central' },
              }}
            />
            <Tooltip
              allowEscapeViewBox={{ x: false, y: false }}
              cursor={{ strokeDasharray: '4 4' }}
              content={(tipProps) => <ElasticityTooltip {...tipProps} />}
            />
            {points.length > 0 && (
              <Scatter
                name={MONTHS_LEGEND}
                data={points}
                fill={chartColors[0]}
                shape={(dotProps) => <HistoricalDot {...dotProps} />}
                legendType="circle"
                isAnimationActive={false}
                hide={legendHidden.has('months')}
              />
            )}
            {fitLine.length === 2 && (
              <Scatter
                name={FIT_LEGEND}
                data={fitLine}
                fill="none"
                line={{ stroke: chartLinearTrendStroke, strokeWidth: 2.5 }}
                lineType="joint"
                shape={() => null}
                legendType="line"
                isAnimationActive={false}
                hide={legendHidden.has('fit')}
              />
            )}
            {showProjected && (
              <Scatter
                name={PROJECTED_LEGEND}
                data={projectedPoints}
                fill={chartProjectionStroke}
                shape={(dotProps) => <ProjectedDot {...dotProps} />}
                legendType="circle"
                isAnimationActive={false}
                hide={legendHidden.has('projected')}
              />
            )}
            <Legend
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{
                ...structuredLegendWrapperStyle,
                fontSize: 12,
                paddingTop: narrowLayout ? 2 : 12,
              }}
              content={(lp) => (
                <StructuredChartLegend
                  payload={lp.payload}
                  hidden={legendHidden}
                  dimPairs={[]}
                  isDimmed={(h, k) => !!k && h.has(k)}
                  onItemClick={onElasticityLegendClick}
                  rows={legendRows}
                  resolveEntryKey={elasticityLegendKey}
                  shortLabels={ELASTICITY_LEGEND_SHORT_LABELS}
                  dashedKeys={new Set(['projected'])}
                />
              )}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
