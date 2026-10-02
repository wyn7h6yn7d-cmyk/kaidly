import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { ADMIN } from "@/lib/admin/strings";
import { Logo, LogoMark } from "@/components/brand/logo";
import { BottomNav, SidebarNav } from "./nav-links";
import { getT } from "@/lib/i18n/server";

/**
 * Signed-in frame for one organisation (docs/DESIGN.md §6):
 * desktop — deep green sidebar with organisation switcher, navigation, account;
 * mobile — top bar (switcher + account) and a bottom tab bar in thumb reach.
 */
export async function AppShell({
  orgSlug,
  sidebarSwitcher,
  topBarSwitcher,
  sidebarFooter,
  topBarEnd,
  platformAdmin = false,
  children,
}: {
  orgSlug: string;
  sidebarSwitcher: React.ReactNode;
  topBarSwitcher: React.ReactNode;
  sidebarFooter: React.ReactNode;
  topBarEnd: React.ReactNode;
  /** From the database (am_platform_admin); shows the KAIDLY Admin entry. */
  platformAdmin?: boolean;
  children: React.ReactNode;
}) {
  const t = await getT();
  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="hidden bg-k-green lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col">
        <div className="flex h-16 items-center px-5">
          <Link href={`/o/${orgSlug}`} className="focus-on-dark rounded-sm">
            <Logo tone="light" />
          </Link>
        </div>
        <div className="border-y border-white/10 px-3 py-2">{sidebarSwitcher}</div>
        <nav aria-label={t.common.menu} className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav orgSlug={orgSlug} />
        </nav>
        {platformAdmin && (
          <div className="border-t border-white/10 px-3 py-2">
            <Link
              href="/admin"
              lang="et"
              className="focus-on-dark flex h-11 items-center gap-3 rounded-sm px-3 text-[15px] font-semibold text-k-volt hover:bg-white/5"
            >
              <ShieldCheck className="size-[18px] shrink-0" aria-hidden="true" />
              {ADMIN.menuEntry}
            </Link>
          </div>
        )}
        <div className="border-t border-white/10 p-3">{sidebarFooter}</div>
      </aside>

      <div className="flex min-h-svh min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-k-line bg-k-paper px-3 lg:hidden">
          <div className="flex min-w-0 items-center gap-1">
            <Link
              href={`/o/${orgSlug}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm"
              aria-label={t.brand.name}
            >
              <LogoMark color="green" className="h-6 w-6" />
            </Link>
            {topBarSwitcher}
          </div>
          {topBarEnd}
        </header>

        <main className="k-app-container flex-1 pb-28 pt-6 lg:pb-14 lg:pt-10">
          {children}
        </main>

        <nav
          aria-label={t.common.menu}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-k-line bg-k-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <BottomNav orgSlug={orgSlug} />
        </nav>
      </div>
    </div>
  );
}

/** Frame for pages outside an organisation: organisation picker, create, invite, account. */
export function PlainShell({
  userMenu,
  children,
}: {
  userMenu: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-k-line bg-k-paper">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-[var(--k-gutter-app)]">
          <Link href="/o?vali=1" className="inline-flex h-11 items-center rounded-sm">
            <Logo />
          </Link>
          {userMenu}
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-[var(--k-gutter-app)] pb-16 pt-8 sm:pt-12">{children}</main>
    </div>
  );
}
