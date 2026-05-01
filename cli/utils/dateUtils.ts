/** Parse "YYYY-MM-DD" as UTC midnight. */
export function toUtcMidnight(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Convert a Date to "YYYY-MM-DD" using UTC fields. */
export function toDateStr(date: Date): string {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Returns [start, end) bounds for a UTC calendar day given "YYYY-MM-DD". */
export function getDayBounds(dateStr: string): { start: Date; end: Date } {
  const start = toUtcMidnight(dateStr);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Returns [start, end) bounds for the ISO week containing `date`.
 * weekStartDay: 0 = Sunday, 1 = Monday (default).
 */
export function getWeekBounds(date: Date, weekStartDay = 1): { start: Date; end: Date } {
  const day = date.getUTCDay(); // 0=Sun … 6=Sat
  const diff = (day - weekStartDay + 7) % 7;
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - diff));
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Returns an array of 7 consecutive dates starting from the given start date. */
export function getWeekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 24 * 60 * 60 * 1000));
}

/** Returns [start, end) bounds for a calendar month (1-indexed month). */
export function getMonthBounds(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

/** Format a Date in the user's timezone for display. */
export function formatDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Format a date into a friendly "Week X" string based on ISO week of the year. */
export function getWeekLabel(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // ISO week starts on Monday. Make Sunday = 7
  const dayNum = d.getUTCDay() || 7;
  // Set to nearest Thursday: current date + 4 - current day number
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `Week ${weekNumber}`;
}

/** Format cents as a Rupee string, e.g. 500 → "₹5.00" */
export function formatMoney(cents: number): string {
  return `₹${(cents / 100).toFixed(2)}`;
}
