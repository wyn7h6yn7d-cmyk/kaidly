import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Activity } from "@/lib/data/schedule";
import { dueState } from "@/lib/schedule";
import { DueDate, DueMark } from "./due-mark";
import type { T } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";

export function frequencyLabel(
  activity: Pick<Activity, "frequencyType" | "intervalValue" | "intervalUnit">,
  t: T,
) {
  const copy = t.app.schedule.frequency;
  return activity.frequencyType === "recurring" && activity.intervalValue && activity.intervalUnit
    ? copy.every(activity.intervalValue, activity.intervalUnit)
    : copy.once;
}

/** Due date and state first: what needs doing, and when. Rows, not cards. */
export async function ActivityList({
  items,
  today,
  orgSlug,
  canComplete,
  contextFor,
}: {
  items: Activity[];
  today: string;
  orgSlug: string;
  canComplete: boolean;
  contextFor?: (item: Activity) => string | null;
}) {
  const t = await getT();
  const copy = t.app.schedule;
  return (
    <ol aria-label={copy.listLabel} className="divide-y divide-k-line border border-k-line bg-k-surface">
      {items.map((item) => {
        const href = `/o/${orgSlug}/kaidukava/${item.id}`;
        const context = contextFor?.(item);
        // In lists, offer completion when it is due (overdue or due soon); upcoming work
        // can still be completed early from the activity page. Keeps lists calm.
        const state = dueState(item.nextDueOn, today);
        const completable = canComplete && !item.archivedAt && (state === "overdue" || state === "soon");
        return (
          <li key={item.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-5">
            <Link href={href} className="grid min-w-0 flex-1 gap-x-6 gap-y-1 sm:grid-cols-[150px_minmax(0,1fr)]">
              <span className="flex flex-wrap items-baseline gap-x-3 sm:block">
                <DueDate nextDueOn={item.nextDueOn} />
                <span className="sm:mt-1 sm:block">
                  <DueMark nextDueOn={item.nextDueOn} today={today} />
                </span>
              </span>
              <span className="min-w-0">
                {context && <span className="block truncate text-sm text-k-muted">{context}</span>}
                <span className="block break-words font-semibold">
                  {item.title}
                  {item.priority === "high" && (
                    <span className="ml-2 align-middle text-xs font-semibold uppercase tracking-wider text-k-danger">
                      {copy.priorities.high}
                    </span>
                  )}
                </span>
                <span className="block text-sm text-k-muted">
                  {frequencyLabel(item, t)}
                  {item.responsiblePersonName ? ` · ${item.responsiblePersonName}` : ""}
                  {item.lastCompletedAt ? ` · ${copy.fields.lastCompleted} ${t.fmt.date(item.lastCompletedAt)}` : ""}
                </span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              {completable && (
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href={`${href}/tehtud`}>{copy.complete}</Link>
                </Button>
              )}
              <ChevronRight className="hidden size-5 text-k-grey sm:block" aria-hidden="true" />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
