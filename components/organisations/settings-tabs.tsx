import Link from "next/link";

import { cn } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export async function SettingsTabs({ orgSlug, active }: { orgSlug: string; active: "organisation" | "members" }) {
  const t = await getT();
  const tabs = [
    { key: "organisation", href: `/o/${orgSlug}/seaded`, label: t.app.settings.tabs.organisation },
    { key: "members", href: `/o/${orgSlug}/seaded/liikmed`, label: t.app.settings.tabs.members },
  ] as const;
  return (
    <nav aria-label={t.app.settings.title} className="mb-8 flex gap-1 overflow-x-auto border-b border-k-line">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={cn(
            "-mb-px flex h-11 items-center border-b-2 px-3 text-[15px] font-semibold",
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
