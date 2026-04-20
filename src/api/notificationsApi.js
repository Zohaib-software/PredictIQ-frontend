import { fetchWithAuth } from './fetchWithAuth.js';
import origin from './apiOrigin.js';

const API_BASE = `${origin}/api/notifications`;

async function request(endpoint, options = {}) {
  const res = await fetchWithAuth(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data.data;
}

/**
 * POST /api/notifications/sync-expense-anomalies: align DB alerts with unverified chart anomalies.
 * @returns {Promise<{ synced: boolean }>}
 */
export async function syncExpenseAnomalyNotifications() {
  return request('/sync-expense-anomalies', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * POST /api/notifications/sync-two-factor-reminder: align enable-2FA reminder with account state.
 * @returns {Promise<{ synced: boolean }>}
 */
export async function syncTwoFactorReminderNotifications() {
  return request('/sync-two-factor-reminder', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * @returns {Promise<{ notifications: Array<{ _id: string, title: string, message: string, read: boolean, createdAt: string }>, unreadCount: number }>}
 */
export async function getNotifications() {
  return request('');
}

/**
 * @param {string} id
 * @returns {Promise<{ notification: object }>}
 */
export async function markNotificationAsRead(id) {
  return request(`/${id}/read`, { method: 'PATCH' });
}

/**
 * @returns {Promise<{ notifications: array, unreadCount: number }>}
 */
export async function markAllNotificationsAsRead() {
  return request('/read-all', { method: 'PATCH' });
}

/** Must match backend `NOTIFICATION_BULK_DELETE_MAX` in notificationController.js */
export const NOTIFICATION_BULK_DELETE_CHUNK_SIZE = 250;

/**
 * POST /api/notifications/bulk-delete (max {@link NOTIFICATION_BULK_DELETE_CHUNK_SIZE} ids).
 * @returns {Promise<{ deletedCount: number }>}
 */
export async function deleteNotificationsBulk(ids) {
  const res = await fetchWithAuth(`${API_BASE}/bulk-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Failed to delete notifications');
  return data.data;
}

/**
 * Deletes any number of notifications by chunking to the API limit.
 * @returns {Promise<{ deletedCount: number }>}
 */
export async function deleteNotificationsBulkAll(ids) {
  const unique = [...new Set(ids.map(String))];
  let deletedCount = 0;
  for (let i = 0; i < unique.length; i += NOTIFICATION_BULK_DELETE_CHUNK_SIZE) {
    const chunk = unique.slice(i, i + NOTIFICATION_BULK_DELETE_CHUNK_SIZE);
    const result = await deleteNotificationsBulk(chunk);
    deletedCount += result?.deletedCount ?? chunk.length;
  }
  return { deletedCount };
}
