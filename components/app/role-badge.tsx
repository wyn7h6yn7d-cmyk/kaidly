import type { Role } from "@/lib/auth/roles";

import { cn } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export async function RoleBadge({ role, className }: { role: Role; className?: string }) {
  const t = await getT();
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
