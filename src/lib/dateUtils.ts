/**
 * Formats a timestamp or date into a human-readable relative time string in Turkish.
 * Examples: "Az önce", "2 dk önce", "1 saat önce", "3 gün önce"
 */
export function formatRelativeTime(
  createdAt?: number | string,
  fallbackZaman?: string,
  id?: string
): string {
  let timestamp: number | undefined;

  if (typeof createdAt === 'number') {
    timestamp = createdAt;
  } else if (typeof createdAt === 'string') {
    const parsed = new Date(createdAt).getTime();
    if (!isNaN(parsed)) timestamp = parsed;
  }

  // Fallback: extract timestamp from ID if formatted like `c_1723223123456` or `ans_1723223123456`
  if (!timestamp && id) {
    const match = id.match(/^(?:c_|ans_)?(\d{12,14})$/);
    if (match) {
      timestamp = parseInt(match[1], 10);
    }
  }

  if (!timestamp || isNaN(timestamp) || timestamp <= 0) {
    return fallbackZaman && fallbackZaman !== 'Şimdi' ? fallbackZaman : 'Az önce';
  }

  const now = Date.now();
  const diffInSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));

  if (diffInSeconds < 30) {
    return 'Az önce';
  }
  if (diffInSeconds < 60) {
    return `${diffInSeconds} sn önce`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} dk önce`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} saat önce`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} gün önce`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} hafta önce`;
  }

  const date = new Date(timestamp);
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

/**
 * Returns today's YYYY-MM-DD date string specifically in Turkey timezone (Europe/Istanbul UTC+3).
 */
export function getTurkeyDateString(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch (e) {
    const d = new Date();
    d.setHours(d.getHours() + 3);
    return d.toISOString().split('T')[0];
  }
}
