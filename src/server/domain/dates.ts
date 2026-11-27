// Calendar days of the platform. Offers carry plain dates (available from, collection deadline); "today" for those
// rules is the day in Germany, where the sites are – not the day in UTC, which is one behind for up to two hours
// after midnight. Pure → used by the server rules and passed to the form.

export const PLATFORM_TIME_ZONE = "Europe/Berlin";

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: PLATFORM_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** The date as YYYY-MM-DD in the platform's time zone. */
export function calendarDay(now: Date = new Date()): string {
  return dayFormat.format(now);
}

/** The day `days` after a YYYY-MM-DD date (calendar arithmetic in UTC, so no time zone shifts the day). */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** A listing whose collection deadline is at most this many days away is labelled "urgent" (function no. 41). */
export const URGENT_WITHIN_DAYS = 7;

/** Urgent = the material must be gone soon: deadline today or within the next URGENT_WITHIN_DAYS days, not past. */
export function isUrgent(deadline: string | null, today: string): boolean {
  return deadline !== null && deadline >= today && deadline <= addDays(today, URGENT_WITHIN_DAYS);
}
