const TRUSTED_DEVICE_ID_KEY = 'predictiq_trusted_device_id';

function generateDeviceId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `device-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function getOrCreateTrustedDeviceId() {
  const existing = localStorage.getItem(TRUSTED_DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const next = generateDeviceId();
  localStorage.setItem(TRUSTED_DEVICE_ID_KEY, next);
  return next;
}
