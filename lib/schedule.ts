/**
 * Derived state of a scheduled activity. Nothing here is stored: the state follows from
 * next_due_on and today's date in Tallinn (docs/DATABASE.md §12).
 */

export type DueState = "overdue" | "soon" | "upcoming" | "done";

/** "Varsti" = due within this many days (today included). */
export const DUE_SOON_DAYS = 14;

/** Adds days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function dueState(nextDueOn: string | null, today: string): DueState {
  if (nextDueOn === null) return "done";
  if (nextDueOn < today) return "overdue";
  if (nextDueOn <= addDays(today, DUE_SOON_DAYS)) return "soon";
  return "upcoming";
}

/** Date bounds of a due state, for filtering in the database. */
export function dueStateRange(state: DueState, today: string) {
  switch (state) {
    case "overdue":
      return { before: today };
    case "soon":
      return { from: today, to: addDays(today, DUE_SOON_DAYS) };
    case "upcoming":
      return { after: addDays(today, DUE_SOON_DAYS) };
    case "done":
      return { done: true as const };
  }
}
