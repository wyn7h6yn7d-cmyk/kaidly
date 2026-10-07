import Link from "next/link";
import { LanguageSelector } from "@/components/app/language-selector";
import { getT } from "@/lib/i18n/server";
import { PUBLIC_LINKS } from "./public-nav";
import { SectionLink } from "./section-link";

export async function SiteFooter() {
  const t = await getT();
  return (
    <footer data-testid="site-footer" className="bg-k-ink text-white/75">
      <div className="k-container grid grid-cols-1 gap-8 py-12 sm:grid-cols-[1fr_auto] sm:items-end lg:py-16">
        <div>
          <p className="font-display text-2xl font-extrabold tracking-wide text-white lg:text-[32px]">{t.brand.name}</p>
          <p className="mt-2 text-base lg:text-xl">{t.landing.footer}</p>
          <nav aria-label={t.landing.legal.label} className="mt-3 flex flex-wrap gap-x-6 text-base lg:text-lg">
            <Link href="/privaatsus" className="focus-on-dark inline-flex h-11 items-center underline-offset-4 hover:text-white hover:underline">
              {t.landing.legal.privacy}
            </Link>
            <Link href="/kasutustingimused" className="focus-on-dark inline-flex h-11 items-center underline-offset-4 hover:text-white hover:underline">
              {t.landing.legal.terms}
            </Link>
          </nav>
        </div>
        <div className="flex flex-col gap-4 sm:items-end">
          <nav aria-label={t.landing.footerNav} className="flex flex-wrap gap-x-6 gap-y-1 text-base lg:gap-x-8 lg:text-lg">
            {PUBLIC_LINKS.map((link) => (
              <SectionLink key={link.key} section={link.section} className="focus-on-dark inline-flex h-11 items-center hover:text-white">
                {t.landing.nav[link.key]}
              </SectionLink>
            ))}
            <Link href="/auth/login" className="focus-on-dark inline-flex h-11 items-center hover:text-white">
              {t.common.signIn}
            </Link>
            <Link href="/auth/sign-up" className="focus-on-dark inline-flex h-11 items-center hover:text-white">
              {t.landing.nav.signUp}
            </Link>
          </nav>
          <LanguageSelector tone="light" large className="flex-wrap lg:-mr-2" />
        </div>
      </div>
    </footer>
  );
}
