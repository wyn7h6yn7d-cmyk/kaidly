import { TIME_ZONE } from "@/lib/time";
import { INTL_LOCALE, type Locale } from "./locales";

/** Locale-aware formatting. The time zone is always Europe/Tallinn (where the work happens). */
export function makeFormat(locale: Locale) {
  const tag = INTL_LOCALE[locale];
  const date = new Intl.DateTimeFormat(tag, { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
  const dateTime = new Intl.DateTimeFormat(tag, {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const time = new Intl.DateTimeFormat(tag, { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const number = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 });
  const toDate = (value: string | Date) => (typeof value === "string" ? new Date(value) : value);
  return {
    /** 12.03.2026 (et), 12/03/2026 (en), 12.03.2026 (ru) */
    date: (value: string | Date) => date.format(toDate(value)),
    /** 12.03.2026 14:05 */
    dateTime: (value: string | Date) => dateTime.format(toDate(value)).replace(",", ""),
    time: (value: string | Date) => time.format(toDate(value)),
    number: (value: number) => number.format(value),
    bytes: (bytes: number) =>
      bytes < 1024 * 1024
        ? `${number.format(Math.max(1, Math.round(bytes / 1024)))} kB`
        : `${number.format(Math.round((bytes / (1024 * 1024)) * 10) / 10)} MB`,
  };
}

export type Format = ReturnType<typeof makeFormat>;
