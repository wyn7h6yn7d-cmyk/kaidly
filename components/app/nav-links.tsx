"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { cn } from "@/lib/utils";
import { NAV_ITEMS, type NavItem } from "./nav";
import { useT } from "@/lib/i18n/client";

function hrefFor(orgSlug: string, item: NavItem) {
  return item.segment ? `/o/${orgSlug}/${item.segment}` : `/o/${orgSlug}`;
}

function isActive(pathname: string, href: string, item: NavItem) {
  return item.segment ? pathname.startsWith(href) : pathname === href;
}

export function SidebarNav({ orgSlug }: { orgSlug: string }) {
  const t = useT();
  const pathname = usePathname();

  return (
    <ul className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const content = (
          <>
            <Icon className="size-[18px] shrink-0" aria-hidden="true" />
            {t.app.nav[item.key]}
          </>
        );
        const base =
          "focus-on-dark flex h-11 items-center gap-3 rounded-sm px-3 text-[15px] font-medium";

        const href = hrefFor(orgSlug, item);
        const active = isActive(pathname, href, item);
        return (
          <li key={item.key}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                base,
                active
                  ? "bg-white/10 text-white shadow-[inset_3px_0_0_hsl(var(--k-volt))]"
                  : "text-white/85 hover:bg-white/5 hover:text-white",
              )}
            >
              {content}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function BottomNav({ orgSlug }: { orgSlug: string }) {
  const t = useT();
  const pathname = usePathname();
  const primary = NAV_ITEMS.filter((item) => item.mobile);
  const more = NAV_ITEMS.filter((item) => !item.mobile);
  const cell =
    "flex h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold leading-none";

  return (
    <ul className="grid grid-cols-5 [&>li]:min-w-0">
      {primary.map((item) => {
        const Icon = item.icon;
        const content = (
          <>
            <Icon className="size-5" aria-hidden="true" />
            <span className="w-full truncate text-center">{t.app.navShort[item.key]}</span>
          </>
        );
        const href = hrefFor(orgSlug, item);
        const active = isActive(pathname, href, item);
        return (
          <li key={item.key}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={t.app.nav[item.key]}
              className={cn(
                cell,
                active
                  ? "text-k-green shadow-[inset_0_3px_0_hsl(var(--k-volt))]"
                  : "text-k-muted",
              )}
            >
              {content}
            </Link>
          </li>
        );
      })}
      <li>
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(cell, "w-full text-k-muted")}>
            <Ellipsis className="size-5" aria-hidden="true" />
            <span>{t.common.more}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="min-w-52">
            {more.map((item) => {
              const Icon = item.icon;
              return (
                <DropdownMenuItem key={item.key} asChild>
                  <Link href={hrefFor(orgSlug, item)}>
                    <Icon aria-hidden="true" />
                    {t.app.nav[item.key]}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    </ul>
  );
}
