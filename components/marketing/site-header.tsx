import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LanguageSelector } from "@/components/app/language-selector";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";
import { PUBLIC_LINKS } from "./public-nav";

/** Public header on the same container as the page below it. */
export async function SiteHeader() {
  const t = await getT();
  return (
    <header className="border-b border-k-line">
      <div className="k-container flex h-16 items-center justify-between gap-3 sm:h-[72px]">
        <Link href="/" className="inline-flex h-11 shrink-0 items-center rounded-sm" aria-label={t.brand.name}>
          <Logo />
        </Link>
        <nav aria-label={t.landing.nav.label} className="flex min-w-0 items-center gap-1 sm:gap-2">
          {PUBLIC_LINKS.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className="hidden h-11 items-center rounded-sm px-3 text-[15px] font-semibold text-k-ink hover:text-k-green lg:inline-flex"
            >
              {t.landing.nav[link.key]}
            </Link>
          ))}
          <Link
            href="/auth/login"
            className="inline-flex h-11 items-center whitespace-nowrap rounded-sm px-3 text-[15px] font-semibold text-k-ink hover:text-k-green"
          >
            {t.common.signIn}
          </Link>
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/auth/sign-up">{t.common.signUp}</Link>
          </Button>
          <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-k-line sm:block" />
          <LanguageSelector />
        </nav>
      </div>
    </header>
  );
}
