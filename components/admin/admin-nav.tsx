"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN } from "@/lib/admin/strings";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: ADMIN.nav.overview, exact: true },
  { href: "/admin/users", label: ADMIN.nav.users },
  { href: "/admin/companies", label: ADMIN.nav.companies },
  { href: "/admin/deadlines", label: ADMIN.nav.deadlines },
  { href: "/admin/system", label: ADMIN.nav.system },
  { href: "/admin/audit", label: ADMIN.nav.audit },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label={ADMIN.brand} className="border-b border-white/15">
      <ul className="mx-auto flex max-w-6xl flex-wrap gap-x-1 px-[var(--k-gutter-app)]">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-on-dark inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold",
                  active ? "border-k-volt text-white" : "border-transparent text-white/75 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
