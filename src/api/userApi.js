import { fetchWithAuth } from './fetchWithAuth.js';
import { createJsonApiRequest } from './createJsonApiRequest.js';
import origin from './apiOrigin.js';

const API_BASE = `${origin}/api/user`;
const request = createJsonApiRequest(`${origin}/api/user`);

export function deleteMyData() {
  return request('/data', { method: 'DELETE' });
}

export function deleteMyAccount() {
  return request('/account', { method: 'DELETE' });
}

export function updateConsent(consentGiven) {
  return request('/consent', {
    method: 'PATCH',
    body: JSON.stringify({ consentGiven }),
  });
}

export function changeMyPassword(currentPassword, newPassword) {
  return request('/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function fetchMyDataExport() {
  const res = await fetchWithAuth(`${API_BASE}/export`, { method: 'GET' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || 'Request failed');
  return body.data;
}

/** @param {Record<string, boolean>} prefs */
export function patchNotificationPreferences(prefs) {
  return request('/notification-preferences', {
    method: 'PATCH',
    body: JSON.stringify(prefs),
  });
}
