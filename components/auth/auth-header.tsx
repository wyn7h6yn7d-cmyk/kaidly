import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LanguageSelector } from "@/components/app/language-selector";
import { getT } from "@/lib/i18n/server";

/**
 * Header inside the auth flow: logo, back to the home page, languages. Sign-in / sign-up
 * links are not repeated here — the switch between them sits under each form.
 */
export async function AuthHeader() {
  const t = await getT();
  return (
    <header className="border-b border-k-line bg-background/80">
      <div className="k-container flex min-h-16 items-center justify-between gap-x-3 gap-y-1 py-2 sm:min-h-[72px]">
        <Link href="/" className="inline-flex h-11 shrink-0 items-center rounded-sm" aria-label={t.brand.name}>
          <Logo large />
        </Link>
        <nav aria-label={t.auth.navLabel} className="flex min-w-0 flex-wrap items-center justify-end gap-1 lg:gap-2">
          <Link
            href="/"
            className="inline-flex h-11 min-w-11 items-center justify-center gap-2 whitespace-nowrap rounded-sm px-2 text-[15px] font-semibold text-k-ink hover:text-k-green sm:px-3"
          >
            <ArrowLeft className="size-5 sm:size-4" aria-hidden="true" />
            {/* Phones: the arrow alone keeps the header on one line; the name stays for screen readers. */}
            <span className="sr-only sm:not-sr-only">{t.common.backToHome}</span>
          </Link>
          <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-k-line lg:block" />
          <LanguageSelector compact large />
        </nav>
      </div>
    </header>
  );
}
