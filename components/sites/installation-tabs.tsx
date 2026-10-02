"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

const TABS = [
  { segment: "", key: "overview" },
  { segment: "paevik", key: "log" },
  { segment: "kaidukava", key: "schedule" },
  { segment: "puudused", key: "deficiencies" },
  { segment: "dokumendid", key: "documents" },
] as const;

/** Scrolls sideways inside itself on narrow screens; the page never scrolls sideways. */
export function InstallationTabs({ base }: { base: string }) {
  const t = useT();
  const pathname = usePathname();
  return (
    <nav aria-label={t.app.installations.sectionsLabel} className="mb-8 overflow-x-auto border-b border-k-line [scrollbar-width:thin]">
      <ul className="flex min-w-max gap-1">
        {TABS.map((tab) => {
          const href = tab.segment ? `${base}/${tab.segment}` : base;
          const active = tab.segment ? pathname.startsWith(href) : pathname === base;
          return (
            <li key={tab.segment}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex h-11 items-center border-b-2 px-3 text-[15px] font-semibold",
                  active ? "border-k-green text-k-ink" : "border-transparent text-k-muted hover:text-k-ink",
                )}
              >
                {t.app.installations.tabs[tab.key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
