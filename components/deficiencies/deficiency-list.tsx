import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { isOverdue, type Deficiency } from "@/lib/data/deficiencies";
import { formatDate, t } from "@/lib/i18n";
import { SeverityMark, StatusBadge } from "./marks";

export function DeficiencyList({
  items,
  orgSlug,
  today,
  contextFor,
  label,
}: {
  items: Deficiency[];
  orgSlug: string;
  today: string;
  contextFor?: (item: Deficiency) => string | null;
  label?: string;
}) {
  const copy = t.app.deficiencies;
  return (
    <ol aria-label={label ?? copy.listLabel} className="divide-y divide-k-line border border-k-line bg-k-surface">
      {items.map((item) => {
        const context = contextFor?.(item);
        const overdue = isOverdue(item, today);
        return (
          <li key={item.id}>
            <Link
              href={`/o/${orgSlug}/puudused/${item.id}`}
              className="grid gap-x-6 gap-y-2 px-4 py-4 hover:bg-k-paper-2 sm:grid-cols-[150px_1fr_auto] sm:px-5"
            >
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:block">
                <SeverityMark severity={item.severity} />
                <span className="sm:mt-1.5 sm:block">
                  <StatusBadge status={item.status} />
                </span>
              </span>
              <span className="min-w-0">
                {context && <span className="mb-0.5 block truncate text-sm text-k-muted">{context}</span>}
                <span className="block break-words font-semibold">{item.title}</span>
                <span className="mt-0.5 line-clamp-2 block break-words text-sm text-k-muted">{item.description}</span>
                <span className="mt-1 block text-sm text-k-muted">
                  {item.status === "resolved" && item.resolvedAt
                    ? `${copy.statuses.resolved} ${formatDate(item.resolvedAt)} · ${item.resolvedByName}`
                    : [
                        item.dueOn ? `${copy.fields.dueOn}: ${formatDate(item.dueOn)}` : null,
                        item.responsiblePersonName,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                  {overdue && <span className="ml-2 font-semibold text-k-danger">{copy.overdue}</span>}
                </span>
              </span>
              <ChevronRight className="hidden size-5 self-center text-k-grey sm:block" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
