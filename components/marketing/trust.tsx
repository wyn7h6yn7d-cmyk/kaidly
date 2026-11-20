import { Button } from "@/components/ui/button";
import { contactMailto } from "@/lib/access";
import { aboutVisible, COMPANY } from "@/lib/company";
import { getT } from "@/lib/i18n/server";

/**
 * "Meist" (#meist, in the public navigation). Dark sheet with the engineering grid. Only the
 * owner's own statements: the about text, the facts taken from it, the product principles
 * already stated on the page ("Excel ei ole käiduraamat") and the contact address.
 * Switched by COMPANY.showAbout; names no person (owner decision).
 */
export async function About() {
  if (!aboutVisible(COMPANY)) return null;
  const t = await getT();
  const a = t.landing.about;
  const contact = contactMailto(COMPANY.email, a.contactSubject);
  return (
    <section
      id="meist"
      tabIndex={-1}
      aria-labelledby="meist-title"
      data-section="about"
      className="k-grain relative isolate overflow-hidden bg-k-ink text-white scroll-mt-16 outline-none sm:scroll-mt-[72px] lg:scroll-mt-20"
    >
      <div aria-hidden="true" className="k-grid pointer-events-none absolute inset-0 -z-10 text-white/[0.05]" />
      <div className="k-container k-section">
        <p className="font-mono text-[13px] uppercase tracking-[0.12em] text-white/60 lg:text-sm">KAIDLY</p>
        <h2 id="meist-title" className="mt-4 font-display text-display-2 font-extrabold">
          {a.title}
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-12 lg:mt-14 lg:grid-cols-12 lg:gap-16">
          <div className="min-w-0 lg:col-span-7">
            <p className="text-xl leading-relaxed text-white/90 lg:text-2xl lg:leading-relaxed">{a.body}</p>
            <p className="mt-10 font-hand text-[30px] leading-tight text-k-volt lg:text-[36px]">
              <span className="inline-block -rotate-2">„{t.landing.hero.note}“</span>
            </p>
          </div>
          <dl className="min-w-0 border-y border-white/25 lg:col-span-5" data-testid="about-facts">
            {a.facts.map((fact) => (
              <div key={fact.value} className="border-b border-white/15 py-5 last:border-b-0 lg:py-6">
                <dt className="font-display text-3xl font-extrabold text-white lg:text-4xl">{fact.value}</dt>
                <dd className="mt-1 text-base text-white/70 lg:text-lg">{fact.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-14 border-t border-white/25 pt-8 lg:mt-20">
          <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-k-volt">{a.principlesTitle}</h3>
          <ul className="mt-5 grid grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-3">
            {t.landing.excel.points.map((point) => (
              <li key={point} className="flex gap-4 text-[17px] text-white/90 lg:text-lg">
                <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 bg-k-volt" />
                <span className="min-w-0">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-14 flex flex-col gap-4 border border-white/25 p-6 sm:flex-row sm:items-center sm:justify-between lg:mt-20 lg:px-8">
          <p className="font-display text-xl font-extrabold lg:text-2xl">{a.contactTitle}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <a href={`mailto:${COMPANY.email}`} className="focus-on-dark inline-flex min-h-11 items-center text-white/85 underline-offset-4 hover:text-white hover:underline">
              {COMPANY.email}
            </a>
            {contact && (
              <Button asChild size="lg">
                <a href={contact}>{t.landing.pricing.contactCta}</a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Customer quotes — rendered only when there are real, approved quotes (none yet). */
export async function Testimonials() {
  if (COMPANY.testimonials.length === 0) return null;
  const t = await getT();
  return (
    <section aria-labelledby="arvamused-title" data-section="testimonials" className="border-b border-k-line bg-k-paper-2">
      <div className="k-container k-section">
        <h2 id="arvamused-title" className="font-display text-display-2 font-extrabold">
          {t.landing.testimonials.title}
        </h2>
        <ul className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {COMPANY.testimonials.map((item) => (
            <li key={`${item.name}-${item.quote}`} className="min-w-0 border-l-4 border-k-volt pl-5">
              <blockquote className="text-lead">„{item.quote}“</blockquote>
              <p className="mt-3 text-sm font-semibold">
                {item.name}
                <span className="font-normal text-k-muted"> · {item.source}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
