"use client";

import Link from "next/link";
import { Check, ChevronsUpDown, LayoutList, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Org = { slug: string; name: string };

export function OrgSwitcher({
  current,
  organisations,
  tone,
}: {
  current: Org;
  organisations: Org[];
  /** light = on the deep green sidebar */
  tone: "light" | "dark";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-11 min-w-0 items-center gap-2 rounded-sm px-2 text-left",
          tone === "light"
            ? "focus-on-dark w-full text-white hover:bg-white/5"
            : "max-w-[60vw] text-k-ink hover:bg-k-ink/5",
        )}
        aria-label={`${t.app.organisations.choose}: ${current.name}`}
      >
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{current.name}</span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-70" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-[0.12em] text-k-muted">
          {t.app.organisations.title}
        </DropdownMenuLabel>
        {organisations.map((org) => (
          <DropdownMenuItem key={org.slug} asChild>
            <Link href={`/o/${org.slug}`} aria-current={org.slug === current.slug ? "true" : undefined}>
              <span className="min-w-0 flex-1 truncate">{org.name}</span>
              {org.slug === current.slug && <Check className="text-k-green" aria-hidden="true" />}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/o?vali=1">
            <LayoutList aria-hidden="true" />
            {t.app.organisations.all}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/o/uus">
            <Plus aria-hidden="true" />
            {t.app.organisations.create}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
