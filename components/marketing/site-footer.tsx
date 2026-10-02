import Link from "next/link";
import { LanguageSelector } from "@/components/app/language-selector";
import { getT } from "@/lib/i18n/server";
import { PUBLIC_LINKS } from "./public-nav";

export async function SiteFooter() {
  const t = await getT();
  return (
    <footer className="bg-k-ink text-white/75">
      <div className="k-container grid grid-cols-1 gap-8 py-12 sm:grid-cols-[1fr_auto] sm:items-end lg:py-16">
        <div>
          <p className="font-display text-2xl font-extrabold tracking-wide text-white lg:text-[32px]">{t.brand.name}</p>
          <p className="mt-2 text-base lg:text-xl">{t.landing.footer}</p>
        </div>
        <div className="flex flex-col gap-4 sm:items-end">
          <nav aria-label={t.landing.footerNav} className="flex flex-wrap gap-x-6 gap-y-1 text-base lg:gap-x-8 lg:text-lg">
            {PUBLIC_LINKS.map((link) => (
              <Link key={link.key} href={link.href} className="focus-on-dark inline-flex h-11 items-center hover:text-white">
                {t.landing.nav[link.key]}
              </Link>
            ))}
            <Link href="/auth/login" className="focus-on-dark inline-flex h-11 items-center hover:text-white">
              {t.common.signIn}
            </Link>
            <Link href="/auth/sign-up" className="focus-on-dark inline-flex h-11 items-center hover:text-white">
              {t.common.signUp}
            </Link>
          </nav>
          <LanguageSelector tone="light" large className="-mr-2" />
        </div>
      </div>
    </footer>
  );
}
