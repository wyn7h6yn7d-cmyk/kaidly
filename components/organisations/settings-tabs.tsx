import Link from "next/link";

import { cn } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

/** Settings sections; change history and data import are shown to owners and admins only (the database enforces the same). */
export async function SettingsTabs({
  orgSlug,
  active,
  showHistory,
}: {
  orgSlug: string;
  active: "organisation" | "members" | "history" | "import";
  showHistory: boolean;
}) {
  const t = await getT();
  const tabs = [
    { key: "organisation", href: `/o/${orgSlug}/seaded`, label: t.app.settings.tabs.organisation },
    { key: "members", href: `/o/${orgSlug}/seaded/liikmed`, label: t.app.settings.tabs.members },
    ...(showHistory
      ? ([
          { key: "history", href: `/o/${orgSlug}/seaded/ajalugu`, label: t.app.settings.tabs.history },
          { key: "import", href: `/o/${orgSlug}/seaded/import`, label: t.app.dataImport.menu },
        ] as const)
      : []),
  ];
  return (
    <nav aria-label={t.app.settings.title} className="mb-8 flex min-w-0 max-w-full gap-1 overflow-x-auto border-b border-k-line">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={cn(
            "-mb-px flex h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-[15px] font-semibold",
            active === tab.key
              ? "border-k-green text-k-ink"
              : "border-transparent text-k-muted hover:text-k-ink",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
