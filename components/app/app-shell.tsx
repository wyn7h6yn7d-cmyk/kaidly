import Link from "next/link";
import { Logo, LogoMark } from "@/components/brand/logo";
import { t } from "@/lib/i18n";
import { BottomNav, SidebarNav } from "./nav-links";

/**
 * Signed-in frame for one organisation (docs/DESIGN.md §6):
 * desktop — deep green sidebar with organisation switcher, navigation, account;
 * mobile — top bar (switcher + account) and a bottom tab bar in thumb reach.
 */
export function AppShell({
  orgSlug,
  sidebarSwitcher,
  topBarSwitcher,
  sidebarFooter,
  topBarEnd,
  children,
}: {
  orgSlug: string;
  sidebarSwitcher: React.ReactNode;
  topBarSwitcher: React.ReactNode;
  sidebarFooter: React.ReactNode;
  topBarEnd: React.ReactNode;
  children: React.ReactNode;
}) {
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
        <div className="border-t border-white/10 p-3">{sidebarFooter}</div>
      </aside>

      <div className="flex min-h-svh min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-k-line bg-k-paper/95 px-3 backdrop-blur-sm lg:hidden">
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

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
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
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/o?vali=1" className="inline-flex h-11 items-center rounded-sm">
            <Logo />
          </Link>
          {userMenu}
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pt-12">{children}</main>
    </div>
  );
}
