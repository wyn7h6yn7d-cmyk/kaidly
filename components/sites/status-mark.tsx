import type { InstallationStatus } from "@/lib/validation/sites";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Square + word: status is never colour-only (docs/DESIGN.md §5). */
export function StatusMark({
  status,
  archived,
}: {
  status?: InstallationStatus;
  archived?: boolean;
}) {
  const label = archived
    ? t.app.installations.archived
    : status
      ? t.app.installations.statuses[status]
      : null;
  if (!label) return null;
  const tone = archived ? "bg-k-grey" : status === "in_service" ? "bg-k-green" : "bg-k-warn";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-k-ink">
      <span aria-hidden="true" className={cn("size-2.5", tone)} />
      {label}
    </span>
  );
}

export function ArchivedBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex h-6 items-center rounded-sm border border-k-grey/60 px-2 text-xs font-semibold text-k-muted">
      {label}
    </span>
  );
}
