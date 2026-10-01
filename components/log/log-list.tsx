import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LogListItem } from "@/lib/data/log";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/lib/time";

/**
 * Operating log rows: time and type on the left, what happened on the right. One list,
 * no cards. On phones the two columns stack. Corrected entries show their current state
 * with a "Parandatud" mark.
 */
export function LogList({
  items,
  hrefFor,
  contextFor,
}: {
  items: LogListItem[];
  hrefFor: (item: LogListItem) => string;
  /** Optional line above the description, e.g. site · installation in the organisation log. */
  contextFor?: (item: LogListItem) => string | null;
}) {
  const copy = t.app.log;
  return (
    <ol aria-label={copy.listLabel} className="divide-y divide-k-line border border-k-line bg-k-surface">
      {items.map((item) => {
        const context = contextFor?.(item);
        const [date, time] = formatDateTime(item.occurredAt).split(" ");
        return (
          <li key={item.id}>
            <Link
              href={hrefFor(item)}
              className="grid gap-x-6 gap-y-2 px-4 py-4 hover:bg-k-paper-2 sm:grid-cols-[150px_1fr_auto] sm:px-5"
            >
              <div className="flex items-baseline gap-3 sm:block">
                <time dateTime={item.occurredAt} className="font-semibold tabular-nums">
                  {date} <span className="font-normal text-k-muted sm:block">{time}</span>
                </time>
                <span className="text-sm font-semibold text-k-green sm:mt-1 sm:block">
                  {copy.types[item.entryType]}
                </span>
                {(item.scheduledActivityId || item.deficiencyId) && (
                  <span className="text-xs font-semibold uppercase tracking-wider text-k-muted sm:mt-1 sm:block">
                    {item.scheduledActivityId ? copy.fromActivity : copy.fromDeficiency}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                {context && <p className="mb-1 truncate text-sm text-k-muted">{context}</p>}
                <p className="line-clamp-3 whitespace-pre-line break-words">{item.description}</p>
                {item.result && (
                  <p className="mt-1 line-clamp-2 break-words text-sm">
                    <span className="font-semibold">{copy.fields.result}:</span> {item.result}
                  </p>
                )}
                <p className="mt-2 text-sm text-k-muted">
                  {item.performedByName && (
                    <>
                      {copy.performedBy}: {item.performedByName} ·{" "}
                    </>
                  )}
                  {copy.recordedBy}: {item.recordedByName}
                </p>
                {item.isCorrected && item.correctedAt && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-k-ink">
                    <span aria-hidden="true" className="size-2.5 bg-k-warn" />
                    {copy.correctedOn(formatDateTime(item.correctedAt), item.correctedByName ?? "")}
                  </p>
                )}
              </div>
              <ChevronRight className="hidden size-5 self-center text-k-grey sm:block" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function Pager({
  page,
  hasMore,
  hrefFor,
}: {
  page: number;
  hasMore: boolean;
  hrefFor: (page: number) => string;
}) {
  if (page <= 1 && !hasMore) return null;
  return (
    <nav aria-label={t.app.log.pagination} className="mt-6 flex justify-between gap-4">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="font-semibold text-k-green underline underline-offset-4">
          {t.app.log.newer}
        </Link>
      ) : (
        <span />
      )}
      {hasMore && (
        <Link href={hrefFor(page + 1)} className="font-semibold text-k-green underline underline-offset-4">
          {t.app.log.older}
        </Link>
      )}
    </nav>
  );
}

export function parsePage(value: string | string[] | undefined): number {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : 1;
  return Number.isFinite(n) && n > 0 && n < 10000 ? n : 1;
}
