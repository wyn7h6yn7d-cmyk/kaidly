import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { t } from "@/lib/i18n";
import { BottomNav, SidebarNav } from "./nav-links";

/**
 * Signed-in application frame (docs/DESIGN.md §6):
 * desktop — deep green sidebar; mobile — top bar + bottom tab bar in thumb reach.
 * The frame itself is static so it prerenders; anything that reads the session is
 * passed in through slots that the caller wraps in <Suspense>.
 */
export function AppShell({
  orgSlug,
  sidebarFooter,
  topBarEnd,
  children,
}: {
  orgSlug?: string;
  sidebarFooter: React.ReactNode;
  topBarEnd: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="hidden bg-k-green lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col">
        <div className="flex h-16 items-center px-5">
          <Link href="/o" className="focus-on-dark rounded-sm">
            <Logo tone="light" />
          </Link>
        </div>
        <nav aria-label={t.common.menu} className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav orgSlug={orgSlug} />
        </nav>
        <div className="border-t border-white/10 p-3">{sidebarFooter}</div>
      </aside>

      <div className="flex min-h-svh flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-k-line bg-k-paper/95 px-4 backdrop-blur-sm lg:hidden">
          <Link href="/o" className="rounded-sm">
            <Logo />
          </Link>
          {topBarEnd}
        </header>

        <main className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
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
