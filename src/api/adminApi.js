import { createJsonApiRequest } from './createJsonApiRequest.js';
import origin from './apiOrigin.js';

const request = createJsonApiRequest(`${origin}/api/admin`);

export function getAdminUsers() {
  return request('/users');
}

export function updateAdminUserRole(userId, role) {
  return request(`/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export function patchAdminUserForecastingAccess(userId, forecastingAccessEnabled) {
  return request(`/users/${userId}/forecasting-access`, {
    method: 'PATCH',
    body: JSON.stringify({ forecastingAccessEnabled }),
  });
}

export function deleteAdminUser(userId) {
  return request(`/users/${userId}`, {
    method: 'DELETE',
  });
}

export function getSystemLogs() {
  return request('/logs');
}

/**
 * @param {object} [range] Optional date filter (local calendar days → ISO bounds sent to API).
 * @param {string} [range.createdAfter] ISO8601 lower bound for `createdAt`
 * @param {string} [range.createdBefore] ISO8601 upper bound for `createdAt`
 */
export function getAdminFeedback(page = 1, limit = 50, range = {}) {
  const q = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (range.createdAfter) q.set('createdAfter', range.createdAfter);
  if (range.createdBefore) q.set('createdBefore', range.createdBefore);
  return request(`/feedback?${q.toString()}`);
}
