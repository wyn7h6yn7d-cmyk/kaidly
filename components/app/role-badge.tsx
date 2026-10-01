import type { Role } from "@/lib/auth/roles";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-sm border px-2 text-xs font-semibold",
        role === "owner" ? "border-k-green bg-k-green text-white" : "border-k-line bg-k-surface text-k-ink",
        className,
      )}
    >
      {t.roles[role]}
    </span>
  );
}
