import { formatFunnelGbp, formatGbpFull } from '../../../utils/displayFormat';
import styles from './EfficiencyFunnelChart.module.css';

const STAGE_COLORS = [
  'var(--color-accent)',
  'var(--color-success)',
  '#4b5563',
];

function pctOfRevenue(part, revenueTop) {
  const p = Number(part);
  const r = Number(revenueTop);
  if (!Number.isFinite(p) || !Number.isFinite(r) || r <= 0) return '—';
  return `${Math.round((p / r) * 1000) / 10}%`;
}

export function EfficiencyFunnelChart({ data }) {
  const stages = data?.stages ?? [];
  if (stages.length === 0) return null;

  const maxVal = Math.max(...stages.map((s) => Math.max(0, Number(s.value) || 0)), 1);
  const topVal = Math.max(Number(stages[0]?.value) || 0, 1);
  const revenue = Number(stages[0]?.value);
  const operating = stages.length > 1 ? Number(stages[1]?.value) : NaN;
  const net = stages.length > 2 ? Number(stages[2]?.value) : NaN;
  const nonAdCosts =
    Number.isFinite(revenue) && Number.isFinite(operating) ? revenue - operating : NaN;
  const marketingCosts =
    Number.isFinite(operating) && Number.isFinite(net) ? operating - net : NaN;

  return (
    <div className={styles.wrapper}>
      <div className={styles.funnel} role="list">
        {stages.map((stage, i) => {
          const v = Number(stage.value);
          const safe = Number.isFinite(v) ? v : 0;
          const rawPct = maxVal > 0 ? (safe / maxVal) * 100 : 0;
          const widthPct = safe > 0 ? Math.max(rawPct, 3) : 0;
          const pctOfTop =
            topVal > 0 ? Math.min(100, Math.round((safe / topVal) * 1000) / 10) : 0;
          const full = formatGbpFull(safe);
          const compact = formatFunnelGbp(safe);

          return (
            <div
              key={stage.name}
              className={styles.segment}
              role="listitem"
              style={{
                width: `${widthPct}%`,
                backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length],
              }}
            >
              <span className={styles.segmentLabel}>{stage.name}</span>
              <span
                className={styles.segmentValue}
                title={full}
              >
                {compact}
              </span>
              {i > 0 && (
                <span className={styles.segmentRatio} title="Share of total revenue">
                  {pctOfTop}% of revenue
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className={styles.funnelSummary}>
        <div className={styles.funnelSummaryTitle}>Funnel summary</div>
        <table className={styles.funnelSummaryTable}>
          <thead>
            <tr>
              <th scope="col">Stage</th>
              <th scope="col">Amount</th>
              <th scope="col">Of revenue</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage) => {
              const v = Number(stage.value);
              const safe = Number.isFinite(v) ? v : 0;
              return (
                <tr key={stage.name}>
                  <th scope="row">{stage.name}</th>
                  <td title={formatGbpFull(safe)}>{formatGbpFull(safe)}</td>
                  <td>{pctOfRevenue(safe, topVal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {stages.length >= 3 &&
          Number.isFinite(nonAdCosts) &&
          Number.isFinite(marketingCosts) && (
            <>
              <div className={styles.funnelSummarySubtitle}>Between funnel steps</div>
              <table className={styles.funnelSummaryTable}>
                <tbody>
                  <tr>
                    <th scope="row">
                      Revenue → operating
                      <span className={styles.funnelSummaryHint}> (non-ad costs)</span>
                    </th>
                    <td title="Revenue minus operating profit">
                      {formatGbpFull(nonAdCosts)}
                    </td>
                    <td>{pctOfRevenue(nonAdCosts, topVal)}</td>
                  </tr>
                  <tr>
                    <th scope="row">
                      Operating → net
                      <span className={styles.funnelSummaryHint}> (marketing portion)</span>
                    </th>
                    <td title="Operating profit minus net profit">
                      {formatGbpFull(marketingCosts)}
                    </td>
                    <td>{pctOfRevenue(marketingCosts, topVal)}</td>
                  </tr>
                </tbody>
              </table>
            </>
          )}
      </div>
    </div>
  );
}
