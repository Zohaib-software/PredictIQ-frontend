import origin from './apiOrigin.js';

/**
 * Anonymous feedback — no auth. Server applies per-IP rate limits.
 * `website` is a honeypot field; leave empty.
 */
export async function submitFeedback({ message, category, page, website = '' }) {
  const res = await fetch(`${origin}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, category, page, website }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}
