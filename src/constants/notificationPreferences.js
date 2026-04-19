// IMPORTANT: This file must mirror backend/utils/notificationPreferences.js. If you add or change a key in the backend defaults, update this file too.

export const DEFAULT_NOTIFICATION_PREFS = {
  enabled: true,
  liquidityAlerts: true,
  forecastAlerts: true,
  anomalyAlerts: true,
  insightAlerts: true,
  securityAlerts: true,
};

export function mergeNotificationPreferences(user) {
  return {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...(user?.notificationPreferences && typeof user.notificationPreferences === 'object'
      ? user.notificationPreferences
      : {}),
  };
}
