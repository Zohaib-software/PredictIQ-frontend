import { fetchWithAuth } from './fetchWithAuth.js';

export function createJsonApiRequest(apiBase) {
  return async function request(endpoint, options = {}) {
    const res = await fetchWithAuth(`${apiBase}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data.data;
  };
}
