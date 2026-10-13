/** Dates travel through the app as plain "YYYY-MM-DD" strings (UTC calendar days). */
export type ISODate = string;

const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function utcMs(d: ISODate): number {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
}

function fromMs(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function todayISO(now: Date = new Date()): ISODate {
  return now.toISOString().slice(0, 10);
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((utcMs(to) - utcMs(from)) / DAY_MS);
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromMs(utcMs(d) + n * DAY_MS);
}

/** "Oct 31", or "Oct 31, 2027" when the year differs from `today`'s year. Locale-independent on purpose. */
export function formatDate(d: ISODate, today: ISODate): string {
  const [y, m, day] = d.split("-").map(Number);
  const base = `${MONTHS[m - 1]} ${day}`;
  return String(y) === today.slice(0, 4) ? base : `${base}, ${y}`;
}

/**
 * Turns whatever a Google Sheets cell holds into an ISO date, or null.
 * Handles date serial numbers (what the API returns for date cells), "YYYY-MM-DD"
 * and "M/D/YYYY" text.
 */
export function normalizeDate(value: unknown): ISODate | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 1 || value > 80_000) return null;
    // Sheets serial 0 = 1899-12-30.
    return fromMs(Date.UTC(1899, 11, 30) + Math.floor(value) * DAY_MS);
  }
  const s = String(value).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
  if (m) return validISO(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return validISO(+m[3], +m[1], +m[2]);
  return null;
}

function validISO(y: number, m: number, d: number): ISODate | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}
