/**
 * formatDate — canonical DD/MM/YYYY formatter for all user-visible dates.
 *
 * Accepts an ISO timestamp, a date-only string (YYYY-MM-DD), or a Date object.
 * Date-only strings are parsed as local midnight to avoid UTC-offset shifts.
 * Returns '—' for null / undefined / invalid input.
 *
 * NOTE: Do NOT use this for <input type="date"> values — those must stay YYYY-MM-DD.
 */
export function formatDate(dateStringOrObject) {
  if (!dateStringOrObject) return '—';
  const raw = dateStringOrObject instanceof Date
    ? dateStringOrObject.toISOString()
    : String(dateStringOrObject);
  // Date-only strings (YYYY-MM-DD) would be treated as UTC midnight by the Date
  // constructor, which shifts the day back one day in UTC+N timezones.
  // Appending T00:00:00 forces local-time parsing instead.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(raw + 'T00:00:00')
    : new Date(raw);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}
