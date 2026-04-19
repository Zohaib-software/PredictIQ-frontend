/**
 * Data-driven axis domains for Recharts: padded min/max from visible series,
 * avoiding a fixed £0 (or arbitrary) floor unless requested.
 */

/**
 * @param {Array<Array<number|undefined|null>>} seriesArrays - values to scan (each array is one series)
 * @param {{ padRatio?: number, absFloor?: number, includeZeroIfStraddles?: boolean }} [opts]
 * @returns {[number, number] | ['auto', 'auto']}
 */
export function paddedNumericDomain(seriesArrays, opts = {}) {
  const padRatio = opts.padRatio ?? 0.08;
  const absFloor = opts.absFloor ?? 0;
  let min = Infinity;
  let max = -Infinity;

  for (const arr of seriesArrays) {
    if (!Array.isArray(arr)) continue;
    for (const v of arr) {
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      min = Math.min(min, n);
      max = Math.max(max, n);
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return ['auto', 'auto'];
  }

  /** When Profit is negative and revenue positive, keep 0 in view for context */
  if (opts.includeZeroIfStraddles && min < 0 && max > 0) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }

  const span = max - min;
  if (span === 0) {
    const pad = Math.max(Math.abs(min) * padRatio || 1, absFloor || 1);
    return [min - pad, max + pad];
  }

  const pad = Math.max(span * padRatio, absFloor);
  return [min - pad, max + pad];
}

/** Count axis (histograms): always [0, padded max], integers — avoids Recharts float ticks (e.g. 81.00000001) */
export function countAxisDomain(counts, padRatio = 0.12) {
  const nums = (counts ?? []).map(Number).filter((n) => Number.isFinite(n));
  const mx = nums.length ? Math.max(...nums) : 0;
  if (mx <= 0) return [0, 1];
  const padded = mx * (1 + padRatio);
  const hi = Math.max(1, Math.ceil(Number.isFinite(padded) ? padded : mx));
  return [0, hi];
}
