import type { Metadata } from "next";
import { Caveat } from "next/font/google";
import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { HeroVisual } from "@/components/marketing/hero-visual";
import { LogPreview } from "@/components/marketing/log-preview";
import { PhonePreview } from "@/components/marketing/phone-preview";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { SystemDiagram } from "@/components/marketing/system-diagram";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: { absolute: t.landing.metaTitle } };
}

// The one handwritten note on the page; the font loads on this page only.
const hand = Caveat({ variable: "--font-hand", subsets: ["latin", "latin-ext", "cyrillic"], weight: ["600"] });

/**
 * Public landing page. Every section sits on the same container (.k-container) and the
 * same vertical rhythm (.k-section); the public site may be editorial, the app stays quiet
 * (docs/DESIGN.md §5a, §9).
 */
export default async function Home() {
  const t = await getT();
  const l = t.landing;

  return (
    <div className={`${hand.variable} flex min-h-svh flex-col bg-k-paper text-k-ink`}>
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="k-grain">
          <div className="k-container grid items-center gap-12 py-12 sm:py-16 lg:grid-cols-12 lg:gap-12 lg:py-24">
            <div className="min-w-0 lg:col-span-7">
              <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-k-muted">
                <span aria-hidden="true" className="h-px w-8 shrink-0 bg-k-ink" />
                {l.hero.eyebrow}
              </p>
              <h1 className="mt-6 font-display text-display-1 font-extrabold [hyphens:auto] [overflow-wrap:break-word]">
                {l.hero.lineOne}
                <br />
                <span className="text-k-green">{l.hero.lineTwo}</span>
              </h1>
              <p className="mt-7 max-w-xl text-lead text-k-muted">{l.hero.lead}</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild size="xl">
                  <Link href="/auth/sign-up">
                    {l.hero.primary}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="xl" variant="outline">
                  <Link href="#kuidas-toimib">
                    {l.hero.secondary}
                    <ArrowDown aria-hidden="true" />
                  </Link>
                </Button>
              </div>
              <p className="mt-10 font-hand text-[28px] leading-tight text-k-green">
                <span className="inline-block -rotate-2">{l.hero.note}</span>
              </p>
            </div>
            <div className="min-w-0 lg:col-span-5">
              <HeroVisual />
            </div>
          </div>
        </section>

        {/* "Excel ei ole käiduraamat." — the product interface is the proof */}
        <section id="kuidas-toimib" className="k-grain scroll-mt-4 bg-k-green text-white">
          <div className="k-container k-section grid gap-12 lg:grid-cols-12 lg:gap-12">
            <div className="min-w-0 lg:col-span-4">
              <h2 className="font-display text-display-2 font-extrabold">{l.excel.title}</h2>
              <p className="mt-6 max-w-md text-lead text-white/85">{l.excel.body}</p>
              <ul className="mt-10 space-y-4 border-t border-white/20 pt-6">
                {l.excel.points.map((point) => (
                  <li key={point} className="flex gap-4 text-base text-white/90">
                    <span aria-hidden="true" className="mt-3 h-px w-6 shrink-0 bg-k-volt" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div className="min-w-0 border-l-4 border-k-volt lg:col-span-8">
              <LogPreview />
            </div>
          </div>
        </section>

        {/* Real questions, each answered by one part of KAIDLY */}
        <section className="k-grain">
          <div className="k-container k-section grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-10">
                <h2 className="font-display text-display-2 font-extrabold">{l.questions.title}</h2>
                <p className="mt-5 max-w-sm text-lead text-k-muted">{l.questions.intro}</p>
              </div>
            </div>
            <ol className="border-t-2 border-k-ink lg:col-span-7">
              {l.questions.items.map((item, i) => (
                <li key={item.q} className="grid gap-4 border-b border-k-line py-9 sm:grid-cols-[3.5rem_1fr] sm:gap-6">
                  <span aria-hidden="true" className="font-mono text-sm text-k-muted sm:pt-2">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="grid min-w-0 gap-4 md:grid-cols-2 md:gap-10">
                    <p className="font-display text-display-3 font-bold">„{item.q}“</p>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-k-green">{item.where}</p>
                      <p className="mt-2 text-[17px] leading-relaxed text-k-ink/80">{item.a}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* System structure, drawn like an engineering sheet */}
        <section className="relative border-y border-k-line bg-k-paper-2">
          <div aria-hidden="true" className="k-grid pointer-events-none absolute inset-0 text-k-ink/[0.045]" />
          <div className="k-container k-section relative">
            <div className="grid gap-6 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-7">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-k-muted">{l.system.eyebrow}</p>
                <h2 className="mt-3 font-display text-display-2 font-extrabold">{l.system.title}</h2>
              </div>
              <p className="max-w-xl text-lead text-k-muted lg:col-span-5 lg:self-end">{l.system.body}</p>
            </div>
            <div className="mt-12 border border-k-ink/70 bg-k-paper sm:mt-16">
              <div className="p-5 sm:p-10 lg:p-14">
                <SystemDiagram />
              </div>
              <p className="border-t border-k-ink/70 px-5 py-3 font-mono text-xs uppercase tracking-[0.18em] text-k-muted sm:px-10 lg:px-14">
                KAIDLY · {l.system.sheet}
              </p>
            </div>
          </div>
        </section>

        {/* Mobile entry: written where the work was done */}
        <section className="k-grain bg-k-ink text-white">
          <div className="k-container k-section grid items-center gap-14 lg:grid-cols-12 lg:gap-12">
            <div className="min-w-0 lg:col-span-6">
              <h2 className="font-display text-display-2 font-extrabold">{l.phone.title}</h2>
              <p className="mt-6 max-w-xl text-lead text-white/80">{l.phone.body}</p>
              <ol className="mt-10 border-t border-white/20">
                {l.phone.steps.map((step, i) => (
                  <li key={step.title} className="grid grid-cols-[3rem_1fr] gap-4 border-b border-white/20 py-5">
                    <span className="font-display text-3xl font-extrabold text-k-volt">{i + 1}</span>
                    <div>
                      <p className="text-xl font-bold">{step.title}</p>
                      <p className="mt-1 text-base text-white/75">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex min-w-0 justify-center lg:col-span-6">
              <PhonePreview />
            </div>
          </div>
        </section>

        {/* Final call to action */}
        <section className="bg-k-volt text-k-ink">
          <div className="k-container grid gap-10 py-16 sm:py-20 lg:grid-cols-12 lg:items-end lg:py-24">
            <div className="lg:col-span-8">
              <h2 className="font-display text-display-1 font-extrabold">{l.cta.title}</h2>
              <p className="mt-5 max-w-xl text-lead">{l.cta.body}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:col-span-4 lg:flex-col lg:items-stretch">
              <Button asChild size="xl" variant="dark">
                <Link href="/auth/sign-up">
                  {t.common.signUp}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline">
                <Link href="/auth/login">{t.common.signIn}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
