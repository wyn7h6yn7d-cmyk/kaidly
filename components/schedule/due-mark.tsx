import { formatDate, t } from "@/lib/i18n";
import { daysBetween, dueState, type DueState } from "@/lib/schedule";
import { cn } from "@/lib/utils";

const TONE: Record<DueState, string> = {
  overdue: "bg-k-danger",
  soon: "bg-k-warn",
  upcoming: "bg-k-grey",
  done: "bg-k-green",
};

/** Square + word + distance in days. Calm: colour supports the words, never replaces them. */
export function DueMark({ nextDueOn, today }: { nextDueOn: string | null; today: string }) {
  const state = dueState(nextDueOn, today);
  const copy = t.app.schedule;
  let detail = "";
  if (nextDueOn && state === "overdue") detail = copy.overdueBy(daysBetween(nextDueOn, today));
  if (nextDueOn && state === "soon") detail = copy.dueIn(daysBetween(today, nextDueOn));
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-k-ink">
      <span aria-hidden="true" className={cn("size-2.5", TONE[state])} />
      {copy.states[state]}
      {detail && <span className="text-k-muted">· {detail}</span>}
    </span>
  );
}

export function DueDate({ nextDueOn }: { nextDueOn: string | null }) {
  if (!nextDueOn) return <span className="text-k-muted">—</span>;
  return (
    <time dateTime={nextDueOn} className="font-semibold tabular-nums">
      {formatDate(nextDueOn)}
    </time>
  );
}
