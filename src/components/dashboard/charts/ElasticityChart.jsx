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
  if (isProjected && row.period != null) return `Projected — after ${row.period}`;
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
            : ['—', name]
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

export function ElasticityChart({
  data,
  startDate = '',
  endDate = '',
  projectionMonths = 1,
  enableProjection = true,
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
      <div className={styles.chartArea}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 34, right: 16, bottom: 10, left: 44 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
            <XAxis
              type="number"
              dataKey="x"
              name="Δ Expenses %"
              domain={xDomain}
              tickFormatter={(v) => `${formatDecimal(v, 0)}%`}
              stroke="var(--color-secondary-text)"
              fontSize={12}
              label={{
                value: 'Δ Expenses vs prior month (%)',
                position: 'bottom',
                offset: 6,
                fill: 'var(--color-secondary-text)',
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Δ Revenue %"
              domain={yDomain}
              tickFormatter={(v) => `${formatDecimal(v, 0)}%`}
              stroke="var(--color-secondary-text)"
              fontSize={12}
              width={56}
              label={{
                value: 'Δ Revenue vs prior month (%)',
                angle: -90,
                position: 'left',
                offset: 6,
                fill: 'var(--color-secondary-text)',
                fontSize: 11,
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
                legendType="plainline"
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
                fontSize: 12,
                paddingTop: 28,
                paddingBottom: 0,
                cursor: 'pointer',
              }}
              onClick={onElasticityLegendClick}
              formatter={(value) => {
                const key =
                  value === MONTHS_LEGEND ? 'months' : value === FIT_LEGEND ? 'fit' : value === PROJECTED_LEGEND ? 'projected' : null;
                return (
                  <span style={{ opacity: key && legendHidden.has(key) ? 0.45 : 1 }}>{value}</span>
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
