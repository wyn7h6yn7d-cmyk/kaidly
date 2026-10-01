import type { Metadata } from "next";
import { Caveat } from "next/font/google";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { HandNote } from "@/components/marketing/hand-note";
import { HeroFigure } from "@/components/marketing/hero-figure";
import { LogPreview } from "@/components/marketing/log-preview";
import { PhonePreview } from "@/components/marketing/phone-preview";
import { SystemDiagram } from "@/components/marketing/system-diagram";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: { absolute: t.landing.metaTitle } };

// Handwritten notes are a marketing-only accent; the font loads on this page only.
const hand = Caveat({ variable: "--font-hand", subsets: ["latin", "latin-ext"], weight: ["600"] });

export default function Home() {
  const l = t.landing;

  return (
    <div className={`${hand.variable} flex min-h-svh flex-col bg-k-paper text-k-ink`}>
      {/* 1 · Header */}
      <header className="k-grain border-b border-k-line">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
          <Link href="/" className="inline-flex h-11 items-center rounded-sm" aria-label={t.brand.name}>
            <Logo />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Button asChild variant="ghost" size="sm" className="px-3">
              <Link href="/auth/login">{t.common.signIn}</Link>
            </Button>
            <Button asChild size="sm" className="hidden px-4 sm:inline-flex">
              <Link href="/auth/sign-up">{t.common.signUp}</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* 2 · Hero — oversized headline across the page, then lead left / drawing right */}
        <section className="k-grain overflow-hidden">
          <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-16 lg:px-10 lg:pt-20">
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-k-muted">
              <span aria-hidden="true" className="h-px w-8 bg-k-ink" />
              {l.hero.eyebrow}
            </p>
            {/* Phones break after the long word, so the type can stay large. */}
            <h1 className="mt-6 font-display text-[11vw] font-extrabold leading-[0.95] tracking-[-0.035em] sm:text-[clamp(2rem,8.4vw,7.2rem)]">
              {l.hero.lineOne.split(" ").map((word, i, words) => (
                <span key={word}>
                  {word}
                  {i < words.length - 1 && (
                    <>
                      <br className="sm:hidden" />
                      <span className="hidden sm:inline"> </span>
                    </>
                  )}
                </span>
              ))}
              <br />
              <span className="relative inline-block text-k-green">
                {l.hero.lineTwo}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 300 18"
                  preserveAspectRatio="none"
                  className="absolute -bottom-2 left-0 h-3 w-full text-k-volt sm:h-4"
                >
                  <path d="M2 12 C 70 4, 150 3, 298 9" fill="none" stroke="currentColor" strokeWidth={6} strokeLinecap="round" />
                </svg>
              </span>
            </h1>
          </div>
          <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:px-10 lg:pb-0 lg:pt-12">
            <div className="min-w-0 lg:col-span-5 lg:pb-16">
              <p className="max-w-xl text-lg leading-relaxed text-k-muted sm:text-xl">{l.hero.lead}</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="sm:px-8">
                  <Link href="/auth/sign-up">
                    {t.common.signUp}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/auth/login">{t.common.signIn}</Link>
                </Button>
              </div>
              <p className="mt-12 flex items-end gap-3 font-hand text-[27px] leading-tight text-k-green lg:mt-16 lg:justify-end">
                <span className="-rotate-2 inline-block">{l.hero.note}</span>
                <svg aria-hidden="true" viewBox="0 0 70 40" className="hidden h-9 w-16 lg:block">
                  <path d="M2 30 C 22 34, 46 30, 64 10" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
                  <path d="M50 10 L 65 9 L 63 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <svg aria-hidden="true" viewBox="0 0 40 60" className="h-12 w-7 lg:hidden">
                  <path d="M10 2 C 4 22, 8 40, 24 54" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
                  <path d="M12 52 L 25 55 L 28 42" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </p>
            </div>

            <div className="-mx-4 min-w-0 sm:mx-0 lg:col-span-7 lg:-mr-10">
              <div className="k-grain relative bg-k-green px-6 pb-6 pt-10 sm:px-10 lg:px-14 lg:pt-14">
                <div aria-hidden="true" className="k-grid pointer-events-none absolute inset-0 text-white/[0.05]" />
                <div className="relative mx-auto max-w-[460px]">
                  <HeroFigure
                    label={l.hero.figureLabel}
                    title={l.hero.figureTitle}
                    meta={l.hero.figureMeta}
                    callouts={l.hero.callouts}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3 · "Excel ei ole käiduraamat." — dark, editorial, product view bleeding off the edge */}
        <section className="k-grain overflow-hidden bg-k-green text-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-10 lg:py-28">
            <div className="min-w-0 lg:col-span-5">
              <h2 className="font-display text-[clamp(2.3rem,5.6vw,4.2rem)] font-extrabold leading-[1.02] tracking-[-0.03em]">
                {l.excel.title}
              </h2>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-white/85">{l.excel.body}</p>
              <ul className="mt-10 space-y-4 border-t border-white/20 pt-6">
                {l.excel.points.map((point) => (
                  <li key={point} className="flex gap-4 text-[15px] text-white/90">
                    <span aria-hidden="true" className="mt-2 h-px w-6 shrink-0 bg-k-volt" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div className="min-w-0 lg:col-span-7 lg:-mr-[max(2.5rem,calc((100vw-80rem)/2+2.5rem))]">
              <div className="border-l-4 border-k-volt lg:mt-6">
                <LogPreview />
              </div>
            </div>
          </div>
        </section>

        {/* 4 · Real questions */}
        <section className="k-grain">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:px-10 lg:py-28">
            <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:col-span-4 lg:sticky lg:top-10 lg:self-start">
              {l.questions.title}
            </h2>
            <ol className="border-t-2 border-k-ink lg:col-span-8">
              {l.questions.items.map((item, i) => (
                <li key={item.q} className="grid gap-3 border-b border-k-line py-8 sm:grid-cols-[3rem_1fr] sm:gap-6">
                  <span aria-hidden="true" className="font-mono text-sm text-k-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="grid gap-4 md:grid-cols-[1fr_1fr] md:gap-10">
                    <p className="font-display text-2xl font-bold leading-snug tracking-tight sm:text-[28px]">
                      „{item.q}“
                    </p>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-k-green">{item.where}</p>
                      <p className="mt-2 leading-relaxed text-k-muted">{item.a}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 5 · System structure, drawn like a single-line diagram */}
        <section className="relative overflow-hidden border-y border-k-line bg-k-paper-2">
          <div aria-hidden="true" className="k-grid pointer-events-none absolute inset-0 text-k-ink/[0.045]" />
          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-k-muted">{l.system.eyebrow}</p>
                <h2 className="mt-3 max-w-2xl font-display text-[clamp(2rem,4.6vw,3.4rem)] font-extrabold leading-[1.05] tracking-[-0.025em]">
                  {l.system.title}
                </h2>
              </div>
              <HandNote arrow="none" className="text-k-green lg:mb-2 lg:mr-6">
                {l.system.note}
              </HandNote>
            </div>
            <div className="mt-14 border border-k-ink/70 bg-k-paper p-6 sm:p-10">
              <SystemDiagram />
            </div>
          </div>
        </section>

        {/* 6 · Phone workflow — reversed asymmetry on near-black */}
        <section className="k-grain overflow-hidden bg-k-ink text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:px-10 lg:py-28">
            <div className="order-2 flex justify-center lg:order-1 lg:col-span-5 lg:justify-start">
              <PhonePreview className="-rotate-2" />
            </div>
            <div className="order-1 lg:order-2 lg:col-span-7">
              <h2 className="font-display text-[clamp(2.2rem,5vw,3.8rem)] font-extrabold leading-[1.04] tracking-[-0.03em]">
                {l.phone.title}
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80">{l.phone.body}</p>
              <ol className="mt-10 grid gap-px bg-white/15 sm:grid-cols-3">
                {l.phone.steps.map((step, i) => (
                  <li key={step} className="bg-k-ink py-4 sm:px-5 sm:first:pl-0">
                    <span className="font-mono text-xs text-k-volt">0{i + 1}</span>
                    <span className="mt-1 block font-semibold">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* 7 · Final call to action */}
        <section className="bg-k-volt text-k-ink">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-16 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-10 lg:py-20">
            <div>
              <h2 className="max-w-3xl font-display text-[clamp(2.2rem,5.4vw,4.4rem)] font-extrabold leading-[1.02] tracking-[-0.03em]">
                {l.cta.title}
              </h2>
              <p className="mt-4 max-w-xl text-lg">{l.cta.body}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
              <Button asChild size="lg" variant="dark" className="sm:px-8">
                <Link href="/auth/sign-up">
                  {t.common.signUp}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/auth/login">{t.common.signIn}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* 8 · Footer */}
      <footer className="bg-k-ink text-white/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <span className="font-display font-extrabold tracking-wide text-white">KAIDLY</span>
          <span>{l.footer}</span>
        </div>
      </footer>
    </div>
  );
}
