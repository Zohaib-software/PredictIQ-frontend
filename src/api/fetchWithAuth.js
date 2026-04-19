import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './tokenStorage.js';
import origin from './apiOrigin.js';

let ongoingRefresh = null;

async function performRefresh() {
  const rt = getRefreshToken();
  if (!rt) return false;

  const res = await fetch(`${origin}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.data?.token || !data?.data?.refreshToken) {
    clearTokens();
    return false;
  }

  const { token, refreshToken } = data.data;
  setTokens(token, refreshToken);
  window.dispatchEvent(
    new CustomEvent('predictiq:session-refreshed', { detail: { accessToken: token } })
  );
  return true;
}

async function refreshTokensIfNeeded() {
  if (ongoingRefresh) return ongoingRefresh;
  ongoingRefresh = performRefresh().finally(() => {
    ongoingRefresh = null;
  });
  return ongoingRefresh;
}

/**
 * Like `fetch`, but attaches the access token and on 401 attempts one refresh + retry.
 * @param {RequestInfo} input
 * @param {RequestInit & { skipAuthRetry?: boolean }} [init]
 */
export async function fetchWithAuth(input, init = {}) {
  const { skipAuthRetry, ...rest } = init || {};

  const buildHeaders = () => {
    const h = new Headers(rest.headers || {});
    const access = getAccessToken();
    if (access) h.set('Authorization', `Bearer ${access}`);
    return h;
  };

  let res = await fetch(input, { ...rest, headers: buildHeaders() });

  if (res.status === 401 && !skipAuthRetry) {
    if (getRefreshToken()) {
      const recovered = await refreshTokensIfNeeded();
      if (recovered) {
        res = await fetch(input, { ...rest, headers: buildHeaders() });
      }
    }
    if (res.status === 401) {
      clearTokens();
      window.dispatchEvent(new CustomEvent('predictiq:auth-expired'));
    }
  }

  return res;
}
