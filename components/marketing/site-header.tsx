import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LanguageSelector } from "@/components/app/language-selector";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";
import { PUBLIC_LINKS } from "./public-nav";
import { MobileNav } from "./mobile-nav";
import { SectionLink } from "./section-link";

/**
 * Public header on the same container as the page below it. Two groups: the logo with the
 * informational links on the left, account actions and language on the right (from 1024 px).
 * Narrower screens show the logo, "Logi sisse", language and a menu button; the menu
 * (MobileNav) holds the section links and sign-up.
 */
export async function SiteHeader() {
  const t = await getT();
  return (
    <header className="relative border-b border-k-line">
      <div className="k-container flex min-h-16 flex-wrap items-center justify-between gap-x-2 gap-y-1 py-2 min-[360px]:gap-x-3 sm:min-h-[72px] lg:min-h-20">
        <div data-testid="site-header-left" className="flex min-w-0 flex-wrap items-center gap-x-2 lg:gap-x-6">
          <Link href="/" className="inline-flex h-11 shrink-0 items-center rounded-sm" aria-label={t.brand.name}>
            {/* Narrowest phones: a slightly smaller wordmark keeps the bar on one row. */}
            <Logo large className="max-[359px]:gap-1.5 max-[359px]:[&_span]:text-[19px] max-[359px]:[&_svg]:size-6" />
          </Link>
          <nav aria-label={t.landing.nav.label} className="hidden min-w-0 flex-wrap items-center gap-2 lg:flex">
            {PUBLIC_LINKS.map((link) => (
              <SectionLink
                key={link.key}
                section={link.section}
                className="inline-flex h-11 items-center whitespace-nowrap rounded-sm px-4 text-[17px] font-semibold text-k-ink hover:text-k-green"
              >
                {t.landing.nav[link.key]}
              </SectionLink>
            ))}
          </nav>
        </div>
        <div data-testid="site-header-right" className="flex min-w-0 flex-wrap items-center justify-end min-[360px]:gap-1 lg:gap-2">
          <Link
            href="/auth/login"
            className="inline-flex h-11 items-center whitespace-nowrap rounded-sm px-1.5 text-[15px] font-semibold text-k-ink hover:text-k-green min-[360px]:px-2 sm:px-3 lg:px-4 lg:text-[17px]"
          >
            {t.common.signIn}
          </Link>
          <Button asChild className="hidden lg:inline-flex lg:min-h-12 lg:px-6 lg:text-[17px]">
            <Link href="/auth/sign-up">{t.landing.nav.signUp}</Link>
          </Button>
          <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-k-line lg:block" />
          <LanguageSelector compact large />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
