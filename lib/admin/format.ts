// Estonian formatting for the admin console (see lib/admin/strings.ts).

const TZ = "Europe/Tallinn";

export const fmtNumber = (n: number) => new Intl.NumberFormat("et-EE").format(n);

export const fmtDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("et-EE", { dateStyle: "medium", timeZone: TZ }).format(new Date(iso)) : "—";

export const fmtDateTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("et-EE", { dateStyle: "medium", timeStyle: "short", timeZone: TZ }).format(new Date(iso))
    : "—";

/** A date-only value (YYYY-MM-DD) without shifting it through a timezone. */
export const fmtDay = (day: string | null) =>
  day ? new Intl.DateTimeFormat("et-EE", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`)) : "—";

export function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${new Intl.NumberFormat("et-EE", { maximumFractionDigits: 1 }).format(value)} ${units[unit]}`;
}

/** "3 päeva üle tähtaja" / "täna" / "7 päeva jäänud" */
export function fmtDays(days: number | null) {
  if (days === null) return "";
  if (days === 0) return "Tähtaeg täna";
  if (days < 0) return `${-days} ${-days === 1 ? "päev" : "päeva"} üle tähtaja`;
  return `${days} ${days === 1 ? "päev" : "päeva"} jäänud`;
}
