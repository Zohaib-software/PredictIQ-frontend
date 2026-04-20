import { legendEntryDimmed } from '../../utils/chartLegendVisibility';
import { chartLinearTrendStroke, chartProjectionStroke } from '../../theme';
import styles from '../../pages/dashboard/DataPage.module.css';

/**
 * @param {object} entry - Recharts legend payload item
 * @param {(entry: object) => string} [resolveEntryKey]
 */
export function defaultLegendEntryKey(entry) {
  if (!entry || typeof entry !== 'object') return '';
  if (entry.dataKey != null) return String(entry.dataKey);
  if (entry.payload?.dataKey != null) return String(entry.payload.dataKey);
  if (entry.id != null) return String(entry.id);
  return '';
}

function pickEntriesInOrder(payload, keys, resolveEntryKey) {
  const resolver = resolveEntryKey || defaultLegendEntryKey;
  const map = new Map();
  for (const item of payload || []) {
    const k = resolver(item);
    if (k) map.set(k, item);
  }
  return keys.map((k) => map.get(k)).filter(Boolean);
}

function projectedKeysFromPairs(dimPairs) {
  const s = new Set();
  for (const p of dimPairs || []) {
    if (p?.projected != null) s.add(String(p.projected));
  }
  return s;
}

function legendSwatchColor(entry, resolvedKey) {
  const c = entry?.color;
  if (c != null && c !== '' && c !== 'none') return c;
  if (resolvedKey === 'fit') return chartLinearTrendStroke;
  if (resolvedKey === 'projected') return chartProjectionStroke;
  return 'var(--color-secondary-text)';
}

function LegendChip({
  entry,
  resolvedKey,
  hidden,
  dimPairs,
  isDimmed,
  dashedKeys,
  onItemClick,
  shortLabels,
}) {
  const dimmed = isDimmed
    ? isDimmed(hidden, resolvedKey)
    : legendEntryDimmed(hidden, resolvedKey, dimPairs);
  const label = entry.value ?? resolvedKey;
  const short = shortLabels?.[resolvedKey];
  const useDashed = dashedKeys.has(resolvedKey);
  const iconType = entry.type;
  const swatchColor = legendSwatchColor(entry, resolvedKey);
  const lineLike =
    iconType === 'line' || iconType === 'plainline' || iconType === 'plainLine';

  return (
    <button
      type="button"
      className={styles.dataChartLegendItem}
      onClick={() =>
        onItemClick?.({
          dataKey: resolvedKey,
          id: entry.id,
          value: entry.value,
          payload: entry.payload,
        })
      }
      title={typeof label === 'string' ? label : resolvedKey}
      aria-label={`Toggle ${typeof label === 'string' ? label : resolvedKey}`}
      style={{ opacity: dimmed ? 0.45 : 1 }}
    >
      {iconType === 'rect' && useDashed ? (
        <span
          className={styles.dataChartLegendSwatchRectDashed}
          style={{ borderColor: swatchColor }}
          aria-hidden
        />
      ) : iconType === 'rect' ? (
        <span
          className={styles.dataChartLegendSwatchRect}
          style={{ backgroundColor: swatchColor }}
          aria-hidden
        />
      ) : useDashed ? (
        <span
          className={styles.dataChartLegendSwatchDashed}
          style={{ borderColor: swatchColor }}
          aria-hidden
        />
      ) : iconType === 'circle' ? (
        <span
          className={styles.dataChartLegendSwatchCircle}
          style={{ backgroundColor: swatchColor }}
          aria-hidden
        />
      ) : lineLike ? (
        <span
          className={styles.dataChartLegendSwatchSolid}
          style={{ backgroundColor: swatchColor }}
          aria-hidden
        />
      ) : (
        <span
          className={styles.dataChartLegendSwatchSolid}
          style={{ backgroundColor: swatchColor }}
          aria-hidden
        />
      )}
      <span className={styles.dataChartLegendLabel}>
        {short ? (
          <>
            <span className={styles.dataChartLegendLabelFull}>{label}</span>
            <span className={styles.dataChartLegendLabelShort}>{short}</span>
          </>
        ) : (
          label
        )}
      </span>
    </button>
  );
}

/**
 * Recharts `<Legend content={…} />` replacement: fixed rows of tappable chips
 * (better on narrow viewports than default legend wrap).
 *
 * @param {{
 *   payload: object[]|undefined,
 *   hidden: Set<string>,
 *   dimPairs?: { actual: string, projected: string }[],
 *   isDimmed?: (hidden: Set<string>, key: string) => boolean,
 *   onItemClick: (e: { dataKey: string, id?: string, value?: unknown }) => void,
 *   rows: string[][],
 *   resolveEntryKey?: (entry: object) => string,
 *   shortLabels?: Record<string, string>,
 *   dashedKeys?: string[]|Set<string>,
 * }} props
 */
export function StructuredChartLegend({
  payload,
  hidden,
  dimPairs = [],
  isDimmed,
  onItemClick,
  rows,
  resolveEntryKey,
  shortLabels,
  dashedKeys: dashedKeysProp,
}) {
  const dashedKeys =
    dashedKeysProp != null
      ? dashedKeysProp instanceof Set
        ? dashedKeysProp
        : new Set(dashedKeysProp)
      : projectedKeysFromPairs(dimPairs);

  const resolver = resolveEntryKey || defaultLegendEntryKey;

  const rowNodes = rows
    .map((keys, rowIdx) => {
      const entries = pickEntriesInOrder(payload, keys, resolveEntryKey);
      if (!entries.length) return null;
      const rowClass =
        rowIdx > 0 ?
          `${styles.dataChartLegendRow} ${styles.dataChartLegendRowProjected}`
        : styles.dataChartLegendRow;
      return (
        <div key={keys.join('-')} className={rowClass}>
          {entries.map((entry) => {
            const resolvedKey = resolver(entry);
            if (!resolvedKey) return null;
            return (
              <LegendChip
                key={resolvedKey}
                entry={entry}
                resolvedKey={resolvedKey}
                hidden={hidden}
                dimPairs={dimPairs}
                isDimmed={isDimmed}
                dashedKeys={dashedKeys}
                onItemClick={onItemClick}
                shortLabels={shortLabels}
              />
            );
          })}
        </div>
      );
    })
    .filter(Boolean);

  if (!rowNodes.length) return null;

  return <div className={styles.dataChartLegend}>{rowNodes}</div>;
}

/**
 * Bottom margin inside Recharts for the structured legend: legend block height + small gutter.
 * Keep trailing space under the last row to ~15–20px (avoid large empty band under toggles).
 */
export function structuredLegendChartBottom(rows) {
  const n = Array.isArray(rows) ? rows.filter((r) => r?.length).length : 1;
  if (n <= 1) return 18;
  if (n === 2) return 34;
  return 44;
}

/** Shared Legend wrapper styles — no extra padding below the custom legend content. */
export const structuredLegendWrapperStyle = {
  width: '100%',
  paddingTop: 2,
  paddingBottom: 0,
  marginBottom: 0,
  cursor: 'pointer',
};
