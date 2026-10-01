import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

// Placeholder landing page. The full marketing page (photography, handwritten notes,
// textures) is Phase 9; this keeps the brand direction without inventing content.
export default function Home() {
  const [first, second] = t.brand.tagline.split(". ");

  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-k-green">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo tone="light" />
          <Link
            href="/auth/login"
            className="focus-on-dark rounded-sm px-2 py-2 text-[15px] font-semibold text-white underline-offset-4 hover:underline"
          >
            {t.common.signIn}
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="bg-k-green text-white">
          <div className="mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 sm:pb-28 sm:pt-20">
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
              {t.brand.descriptor}
            </p>
            <h1 className="max-w-3xl text-[44px] font-extrabold leading-[1.02] sm:text-7xl">
              {first}.
              <br />
              <span className="text-k-volt">{second}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85">
              {t.landing.lead}
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="focus-on-dark">
                <Link href="/auth/sign-up">{t.common.signUp}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="focus-on-dark border-white/70 text-white hover:bg-white/10"
              >
                <Link href="/auth/login">{t.common.signIn}</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <ul className="grid gap-px border border-k-line bg-k-line sm:grid-cols-3">
            {t.landing.points.map((point) => (
              <li key={point} className="bg-k-paper p-6">
                <span className="mb-4 block h-1 w-8 bg-k-volt" aria-hidden="true" />
                <p className="font-display text-lg font-bold leading-snug">{point}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-k-line">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-k-muted sm:px-6">
          © {t.brand.name}
        </div>
      </footer>
    </div>
  );
}
