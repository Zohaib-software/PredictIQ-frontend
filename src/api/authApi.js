import { clearTokens } from './tokenStorage.js';
import { fetchWithAuth } from './fetchWithAuth.js';
import { getOrCreateTrustedDeviceId } from './deviceTrust.js';
import origin from './apiOrigin.js';

const API_BASE = `${origin}/api/auth`;

/**
 * @typedef {Object} ApiError
 * @property {boolean} success
 * @property {string} [message]
 * @property {Array<{field: string, message: string}>} [errors]
 */

/**
 * Register a new user.
 * @param {{ businessName: string, email: string, phoneNumber?: string, password: string }} payload
 * @returns {Promise<{ user: object, token: string, refreshToken: string }>}
 * @throws {ApiError}
 */
export async function register({ businessName, email, phoneNumber, password }) {
  const res = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessName, email, phoneNumber, password }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.message || 'Registration failed');
    err.status = res.status;
    err.errors = data.errors;
    throw err;
  }
  return data.data;
}

/**
 * Log in a user.
 * @param {{ identifier: string, password: string }} payload
 * @returns {Promise<{ user: object, token: string, refreshToken: string }>}
 * @throws {ApiError}
 */
/**
 * Sign in or register with a Google ID token (`credential` from GoogleLogin).
 * @param {{ credential: string }} payload
 * @returns {Promise<{ user: object, token: string, refreshToken: string } | { requiresTwoFactor: true, twoFactorToken: string, identifier?: string }>}
 */
export async function loginWithGoogle({ credential }) {
  const deviceId = getOrCreateTrustedDeviceId();
  const res = await fetch(`${API_BASE}/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential, deviceId }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    let message = data.message || 'Google sign-in failed';
    if (res.status === 404) {
      message =
        'Google sign-in is not available on this API yet. Deploy the latest backend (including POST /api/auth/google), then try again.';
    }
    const err = new Error(message);
    err.status = res.status;
    err.errors = data.errors;
    throw err;
  }
  return data.data;
}

export async function login({ identifier, password }) {
  const deviceId = getOrCreateTrustedDeviceId();
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password, deviceId }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.message || 'Login failed');
    err.status = res.status;
    err.errors = data.errors;
    throw err;
  }
  return data.data;
}

/**
 * Request a password reset email (response message is the same whether or not the email exists).
 * @param {{ email: string }} payload
 * @returns {Promise<{ message: string }>}
 */
export async function requestPasswordResetEmail({ email }) {
  const res = await fetch(`${API_BASE}/request-password-reset-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.message || 'Could not request password reset');
    err.status = res.status;
    err.errors = data.errors;
    throw err;
  }

  return { message: data.message };
}

/**
 * Complete password reset using the token from the email link.
 * @param {{ token: string, newPassword: string }} payload
 */
export async function completePasswordResetEmail({ token, newPassword }) {
  const deviceId = getOrCreateTrustedDeviceId();
  const res = await fetch(`${API_BASE}/complete-password-reset-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword, deviceId }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.message || 'Password reset failed');
    err.status = res.status;
    err.errors = data.errors;
    throw err;
  }

  return data.data;
}

/**
 * Step 1: verify email + authenticator code for password reset.
 * @returns {Promise<{ verificationToken: string, usedBackupCode?: boolean, remainingBackupCodes?: number }>}
 */
export async function verifyPasswordReset2fa({ email, code }) {
  const res = await fetch(`${API_BASE}/reset-password-2fa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      code: code.trim(),
    }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.message || 'Verification failed');
    err.status = res.status;
    err.errors = data.errors;
    throw err;
  }

  return data.data;
}

/**
 * Step 2: set new password after verifyPasswordReset2fa succeeded.
 */
export async function completePasswordReset2fa({ verificationToken, newPassword }) {
  const deviceId = getOrCreateTrustedDeviceId();
  const res = await fetch(`${API_BASE}/reset-password-2fa/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      verificationToken,
      newPassword,
      deviceId,
    }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.message || 'Password reset failed');
    err.status = res.status;
    err.errors = data.errors;
    throw err;
  }

  return data.data;
}

export async function verifyTwoFactorLogin({ twoFactorToken, code }) {
  const deviceId = getOrCreateTrustedDeviceId();
  const res = await fetch(`${API_BASE}/2fa/verify-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ twoFactorToken, code, deviceId }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.message || 'Two-factor verification failed');
    err.status = res.status;
    err.errors = data.errors;
    throw err;
  }

  return data.data;
}

/**
 * Get current user (uses access token; may refresh once on 401).
 * @returns {Promise<{ user: object }>}
 */
export async function getMe() {
  const res = await fetchWithAuth(`${API_BASE}/me`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Session invalid');
    err.status = res.status;
    throw err;
  }
  return data.data;
}

/**
 * Invalidate the server-side refresh token (call before clearing local session).
 */
export async function logoutApi() {
  try {
    await fetchWithAuth(`${API_BASE}/logout`, { method: 'POST' });
  } finally {
    clearTokens();
  }
}

export async function fetchSessions() {
  const res = await fetchWithAuth(`${API_BASE}/sessions`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Failed to load sessions');
    err.status = res.status;
    throw err;
  }
  return data.data?.sessions ?? [];
}

export async function setupTwoFactorApi() {
  const res = await fetchWithAuth(`${API_BASE}/2fa/setup`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Failed to prepare two-factor setup');
    err.status = res.status;
    throw err;
  }
  return data.data;
}

export async function verifyTwoFactorSetupApi(code) {
  const res = await fetchWithAuth(`${API_BASE}/2fa/verify-setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Failed to enable two-factor authentication');
    err.status = res.status;
    err.errors = data.errors;
    throw err;
  }
  return data.data;
}

export async function disableTwoFactorApi(payload) {
  const body =
    typeof payload === 'string'
      ? { currentPassword: payload }
      : { ...payload };
  const res = await fetchWithAuth(`${API_BASE}/2fa/disable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Failed to disable two-factor authentication');
    err.status = res.status;
    err.errors = data.errors;
    throw err;
  }
  return data.data;
}

export async function regenerateBackupCodesApi() {
  const res = await fetchWithAuth(`${API_BASE}/2fa/backup-codes/regenerate`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Failed to regenerate backup codes');
    err.status = res.status;
    throw err;
  }
  return data.data;
}

export async function logoutSessionApi(sessionId) {
  const res = await fetchWithAuth(`${API_BASE}/sessions/${sessionId}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Failed to log out session');
    err.status = res.status;
    throw err;
  }
  return data.data ?? {};
}

export async function logoutAllSessionsApi() {
  try {
    const res = await fetchWithAuth(`${API_BASE}/logout-all`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || 'Failed to log out all sessions');
      err.status = res.status;
      throw err;
    }
    return data.data ?? {};
  } finally {
    clearTokens();
  }
}
