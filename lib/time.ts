/**
 * Date/time helpers for Estonia without a date library. Times are entered and shown in
 * Europe/Tallinn and stored as UTC timestamps.
 */

export const TIME_ZONE = "Europe/Tallinn";

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function tallinnParts(date: Date) {
  const parts = Object.fromEntries(
    partsFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DDTHH:mm" in Tallinn time, for <input type="datetime-local">. */
export function toLocalInput(date: Date = new Date()): string {
  const p = tallinnParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Today's date in Tallinn, "YYYY-MM-DD". */
export function todayInTallinn(now: Date = new Date()): string {
  return toLocalInput(now).slice(0, 10);
}

/**
 * Converts a Tallinn wall-clock "YYYY-MM-DDTHH:mm" to an ISO UTC string. Returns null for
 * malformed input. Handles daylight saving: the offset is taken at the target instant.
 */
export function localInputToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  const wall = Date.UTC(year, month - 1, day, hour, minute);
  // Guess the instant, then correct by the zone offset observed at that instant (twice,
  // to settle across a DST boundary).
  let instant = wall;
  for (let i = 0; i < 2; i++) {
    const p = tallinnParts(new Date(instant));
    const observed = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    instant += wall - observed;
  }
  const check = tallinnParts(new Date(instant));
  if (check.year !== year || check.month !== month || check.day !== day) return null;
  return new Date(instant).toISOString();
}

const dateTimeFormatter = new Intl.DateTimeFormat("et-EE", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "12.03.2026 14:05" */
export function formatDateTime(value: string | Date): string {
  return dateTimeFormatter.format(typeof value === "string" ? new Date(value) : value).replace(",", "");
}

/** True if `iso` is less than `ms` milliseconds ago. */
export function isWithin(iso: string, ms: number, now: Date = new Date()): boolean {
  return now.getTime() - new Date(iso).getTime() < ms;
}
