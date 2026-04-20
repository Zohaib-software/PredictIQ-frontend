/**
 * Modelled cash-flow forecast, narrate, and client-side trend projections require both
 * consent and (unless overridden by admins) forecasting access.
 */
export function canUseForecastingTools(user) {
  if (!user) return false;
  const consent = user.consentGiven !== false;
  const access = user.forecastingAccessEnabled !== false;
  return consent && access;
}

/** @returns {'consent'|'admin'|null} */
export function getForecastingLockReason(user) {
  if (!user) return 'consent';
  if (user.consentGiven === false) return 'consent';
  if (user.forecastingAccessEnabled === false) return 'admin';
  return null;
}
