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

export function deleteAdminUser(userId) {
  return request(`/users/${userId}`, {
    method: 'DELETE',
  });
}

export function getSystemLogs() {
  return request('/logs');
}
