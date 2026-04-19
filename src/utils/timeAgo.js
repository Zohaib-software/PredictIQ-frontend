/**
 * @param {string|Date} date
 * @returns {string} e.g. "2h ago", "5m ago", "Just now"
 */
export function timeAgo(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const sec = Math.floor((now - d) / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.floor(day / 7);
  if (week < 4) return `${week}w ago`;
  return d.toLocaleDateString();
}
