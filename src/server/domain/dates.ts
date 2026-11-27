// Calendar days of the platform. Offers carry plain dates (available from, collection deadline); "today" for those
// rules is the day in Germany, where the sites are – not the day in UTC, which is one behind for up to two hours
// after midnight. Pure → used by the server rules and passed to the form.

export const PLATFORM_TIME_ZONE = "Europe/Berlin";

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: PLATFORM_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** The date as YYYY-MM-DD in the platform's time zone. */
export function calendarDay(now: Date = new Date()): string {
  return dayFormat.format(now);
}
