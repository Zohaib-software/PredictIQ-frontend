/**
 * Sentinel stored on security.periodLabel for the enable-2FA reminder row.
 * Must match PredictIQ-backend/services/alertService.js TWO_FACTOR_REMINDER_PERIOD_KEY.
 */
export const TWO_FACTOR_REMINDER_PERIOD_KEY = '__2fa_enable__';

export const TWO_FACTOR_SETTINGS_ANCHOR_ID = 'settings-two-factor';

/** Whether this row should show the Settings → 2FA CTA (same pattern as expense anomaly CTA). */
export function showTwoFactorReminderCta(n) {
  return n?.type === 'security' && String(n.periodLabel || '').trim() === TWO_FACTOR_REMINDER_PERIOD_KEY;
}

/** Navigate to Security settings with hash scroll to the enable-2FA block. */
export function navigateToTwoFactorSettingsSection(navigate) {
  navigate({
    pathname: '/settings/security',
    hash: TWO_FACTOR_SETTINGS_ANCHOR_ID,
  });
}
