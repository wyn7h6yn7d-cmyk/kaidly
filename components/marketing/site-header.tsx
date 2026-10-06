import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LanguageSelector } from "@/components/app/language-selector";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { PUBLIC_LINKS } from "./public-nav";

/** Public header on the same container as the page below it. */
export async function SiteHeader() {
  const t = await getT();
  return (
    <header className="border-b border-k-line">
      <div className="k-container flex min-h-16 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 sm:min-h-[72px] lg:min-h-20">
        <Link href="/" className="inline-flex h-11 shrink-0 items-center rounded-sm" aria-label={t.brand.name}>
          <Logo large />
        </Link>
        <nav aria-label={t.landing.nav.label} className="flex min-w-0 flex-wrap items-center justify-end gap-1 lg:gap-2">
          {PUBLIC_LINKS.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className={cn(
                "hidden h-11 items-center rounded-sm px-3 text-[15px] font-semibold text-k-ink hover:text-k-green lg:px-4 lg:text-[17px]",
                link.from === "sm" ? "sm:inline-flex" : "lg:inline-flex",
              )}
            >
              {t.landing.nav[link.key]}
            </Link>
          ))}
          <Link
            href="/auth/login"
            className="inline-flex h-11 items-center whitespace-nowrap rounded-sm px-3 text-[15px] font-semibold text-k-ink hover:text-k-green lg:px-4 lg:text-[17px]"
          >
            {t.common.signIn}
          </Link>
          <Button asChild className="hidden md:inline-flex lg:min-h-12 lg:px-6 lg:text-[17px]">
            <Link href="/auth/sign-up">{t.common.signUp}</Link>
          </Button>
          <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-k-line lg:block" />
          <LanguageSelector compact large />
        </nav>
      </div>
    </header>
  );
}
