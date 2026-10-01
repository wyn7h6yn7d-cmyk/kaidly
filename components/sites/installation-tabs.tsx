"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TABS = [
  { segment: "", label: t.app.installations.tabs.overview },
  { segment: "paevik", label: t.app.installations.tabs.log },
  { segment: "kaidukava", label: t.app.installations.tabs.schedule },
  { segment: "puudused", label: t.app.installations.tabs.deficiencies },
  { segment: "dokumendid", label: t.app.installations.tabs.documents },
] as const;

/** Scrolls sideways inside itself on narrow screens; the page never scrolls sideways. */
export function InstallationTabs({ base }: { base: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={t.app.installations.sectionsLabel} className="-mx-4 mb-8 overflow-x-auto border-b border-k-line px-4 sm:mx-0 sm:px-0">
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
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
