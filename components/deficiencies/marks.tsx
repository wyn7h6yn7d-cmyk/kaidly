import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { DeficiencyStatus, Severity } from "@/lib/validation/deficiencies";

const SEVERITY_TONE: Record<Severity, string> = {
  low: "bg-k-grey",
  medium: "bg-k-warn",
  high: "bg-k-danger",
  critical: "bg-k-danger",
};

/** Word + mark; critical is the only one shown in bold. Never colour alone. */
export function SeverityMark({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-k-ink",
        severity === "critical" ? "font-bold" : "font-medium",
      )}
    >
      <span aria-hidden="true" className={cn("size-2.5", SEVERITY_TONE[severity], severity === "critical" && "ring-2 ring-k-danger/30")} />
      {t.app.deficiencies.severities[severity]}
    </span>
  );
}

const STATUS_TONE: Record<DeficiencyStatus, string> = {
  open: "border-k-ink/70 text-k-ink",
  in_progress: "border-k-warn text-k-ink",
  resolved: "border-k-green bg-k-green text-white",
};

export function StatusBadge({ status }: { status: DeficiencyStatus }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-sm border px-2 text-xs font-semibold", STATUS_TONE[status])}>
      {t.app.deficiencies.statuses[status]}
    </span>
  );
}
