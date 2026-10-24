export function localDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addDateKeyDays(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function zonedDayStartUtc(key: string, timeZone: string) {
  const [year, month, day] = key.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  let guess = target;
  for (let attempt = 0; attempt < 4; attempt++) {
    const local = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const values = Object.fromEntries(local.map((part) => [part.type, part.value]));
    const represented = Date.UTC(
      Number(values.year), Number(values.month) - 1, Number(values.day),
      Number(values.hour), Number(values.minute), Number(values.second),
    );
    const adjustment = target - represented;
    guess += adjustment;
    if (adjustment === 0) break;
  }
  return new Date(guess);
}

/** Convert shop-local date filters to half-open UTC ranges for database queries. */
export function reportDateRange(from: string | null, to: string | null, timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
  } catch {
    throw new RangeError("Shop timezone is invalid.");
  }

  const parseBoundary = (value: string | null, isEnd: boolean) => {
    if (value === null) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-").map(Number);
      const check = new Date(Date.UTC(year, month - 1, day));
      if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
        throw new RangeError("Date filters must use valid YYYY-MM-DD dates.");
      }
      const key = isEnd ? addDateKeyDays(value, 1) : value;
      return zonedDayStartUtc(key, timeZone);
    }
    const instant = new Date(value);
    if (!Number.isFinite(instant.getTime())) throw new RangeError("Date filters must use YYYY-MM-DD or ISO date-time values.");
    if (isEnd) instant.setMilliseconds(instant.getMilliseconds() + 1);
    return instant;
  };

  const start = parseBoundary(from, false);
  const end = parseBoundary(to, true);
  if (start && end && start >= end) throw new RangeError("The start date must be on or before the end date.");
  // Mongo needs the $-prefixed operators; a bare { gte, lt } object fails to cast on every date filter.
  return start || end ? { ...(start ? { $gte: start } : {}), ...(end ? { $lt: end } : {}) } : undefined;
}
