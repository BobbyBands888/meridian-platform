// Calendar math in a market's own time zone, without a date library.

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-09-15" for the given instant, as a calendar date in the time zone. */
export function localDate(timeZone: string, at = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

function localParts(timeZone: string, at: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return { year: +parts.year, month: +parts.month, day: +parts.day, hour: +parts.hour, minute: +parts.minute, second: +parts.second };
}

/** Minutes the time zone is ahead of UTC at that instant (negative in the Americas). */
function offsetMinutes(timeZone: string, at: Date) {
  const p = localParts(timeZone, at);
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - at.getTime()) / 60000;
}

/** The instant local midnight starts on a calendar date (month is 1-12) in the time zone. */
export function zonedMidnight(timeZone: string, year: number, month: number, day: number) {
  const guess = Date.UTC(year, month - 1, day);
  const first = guess - offsetMinutes(timeZone, new Date(guess)) * 60000;
  // Correct once more in case the offset differs at the result (a DST change that day).
  return new Date(guess - offsetMinutes(timeZone, new Date(first)) * 60000);
}

/** The calendar month before the one containing `at`, in the time zone: its label and [start, end) instants. */
export function previousMonth(timeZone: string, at = new Date()) {
  const { year, month } = localParts(timeZone, at);
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  return {
    period: `${prevYear}-${String(prevMonth).padStart(2, "0")}`,
    name: new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(prevYear, prevMonth - 1, 15))),
    start: zonedMidnight(timeZone, prevYear, prevMonth, 1),
    end: zonedMidnight(timeZone, year, month, 1),
  };
}

/** Day of the month (1-31) for the instant in the time zone. */
export const localDayOfMonth = (timeZone: string, at = new Date()) => localParts(timeZone, at).day;

export const daysAgo = (days: number, from = new Date()) => new Date(from.getTime() - days * DAY_MS);
