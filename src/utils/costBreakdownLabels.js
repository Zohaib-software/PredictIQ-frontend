/**
 * True when the API returned only a single non-ad bucket (plus "Ad spend"),
 * i.e. no per-category amounts were found in record notes.
 */
export function costBreakdownIsOnlyUncategorizedOperating(costBreakdown) {
  if (!costBreakdown?.labels?.length) return false;
  const lower = (l) => String(l).trim().toLowerCase();
  const nonAd = costBreakdown.labels.filter((l) => lower(l) !== 'ad spend');
  if (nonAd.length !== 1) return false;
  const bucket = lower(nonAd[0]);
  return bucket === 'other' || bucket === 'other expenses' || bucket === 'expenses';
}
