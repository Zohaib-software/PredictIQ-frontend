/**
 * When the actual series is hidden, the projected line is hidden too (projection has no anchor).
 * Clicking the projected legend still toggles only the projection key in `hidden`.
 *
 * @param {Set<string>} hidden
 * @param {string} actualKey
 * @param {string} projectedKey
 */
export function projectedLineHidden(hidden, actualKey, projectedKey) {
  return hidden.has(actualKey) || hidden.has(projectedKey);
}

/**
 * Dim legend text when that series would not be drawn (including projected dimmed when actual is off).
 *
 * @param {Set<string>} hidden
 * @param {string} dataKey
 * @param {{ actual: string, projected: string }[]} actualProjectionPairs
 */
export function legendEntryDimmed(hidden, dataKey, actualProjectionPairs) {
  const dk = String(dataKey);
  for (const { actual, projected } of actualProjectionPairs) {
    if (projected === dk) return projectedLineHidden(hidden, actual, projected);
    if (actual === dk) return hidden.has(actual);
  }
  return hidden.has(dk);
}

/** Tooltip row has a realised value for this key (used to hide duplicate projected points on bridge months). */
export function tooltipDatumHasActualValue(data, actualKey) {
  if (!data || typeof data !== 'object') return false;
  const v = data[actualKey];
  if (v === null || v === undefined) return false;
  return Number.isFinite(Number(v));
}

/**
 * Recharts Tooltip: remove projected series entries when the same datum already has the paired actual.
 * @param {unknown[]|undefined|null} payload
 * @param {{ actual: string, projected: string }[]} pairs
 */
export function filterTooltipPayloadPreferActualOverProjection(payload, pairs) {
  if (!Array.isArray(payload) || !payload.length || !pairs?.length) return payload ?? [];
  const data = payload[0]?.payload;
  if (!data || typeof data !== 'object') return payload;
  return payload.filter((item) => {
    const dk = item?.dataKey;
    for (const { actual, projected } of pairs) {
      if (dk === projected && tooltipDatumHasActualValue(data, actual)) return false;
    }
    return true;
  });
}
