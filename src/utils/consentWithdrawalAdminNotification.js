/** Must match PredictIQ-backend/services/consentWithdrawalAdminNotification.js */
export const CONSENT_WITHDRAWAL_ADMIN_PERIOD_KEY = '__consent_wd__';

export function showConsentWithdrawalAdminCta(n) {
  const id = n?.relatedUserId;
  return (
    n?.type === 'security' &&
    String(n.periodLabel || '').trim() === CONSENT_WITHDRAWAL_ADMIN_PERIOD_KEY &&
    id != null &&
    String(id).trim() !== ''
  );
}

export function navigateToAdminUserForConsent(navigate, relatedUserId) {
  const id = encodeURIComponent(String(relatedUserId));
  navigate(`/admin/users?highlight=${id}`);
}
