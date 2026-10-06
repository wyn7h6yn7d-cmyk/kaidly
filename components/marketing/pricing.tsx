import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { contactMailto } from "@/lib/access";
import { getT } from "@/lib/i18n/server";
import { FIXED_PLANS, PLAN_DETAILS, POPULAR_PLAN } from "@/lib/plans";
import { cn } from "@/lib/utils";

/**
 * Public pricing (landing page, #hinnad). One ruled sheet, like the system drawing above
 * it — not a row of floating cards. Plans differ only by limits; the feature list applies
 * to all of them. The free trial is stated next to the prices, not as a plan.
 */
export async function Pricing() {
  const t = await getT();
  const p = t.landing.pricing;
  const contact = contactMailto(process.env.KAIDLY_CONTACT_EMAIL, p.customSubject);

  return (
    <section id="hinnad" aria-labelledby="hinnad-title" className="scroll-mt-4 border-b border-k-line bg-k-paper">
      <div className="k-container k-section">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="min-w-0 lg:col-span-7">
            <p className="font-mono text-[13px] uppercase tracking-[0.12em] text-k-muted lg:text-sm">{p.eyebrow}</p>
            <h2 id="hinnad-title" className="mt-4 font-display text-display-2 font-extrabold [overflow-wrap:break-word]">
              {p.title}
            </h2>
            <p className="mt-6 max-w-2xl text-lead text-k-muted">{p.body}</p>
          </div>
          <div className="min-w-0 border-l-4 border-k-volt pl-5 lg:col-span-5 lg:self-end">
            <p className="font-display text-display-3 font-extrabold text-k-green">{p.trial}</p>
            <p className="mt-3 max-w-md text-k-muted">{p.trialBody}</p>
            <Button asChild size="lg" className="mt-5">
              <Link href="/auth/sign-up">
                {p.startCta}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-12 border border-k-ink/70 bg-k-paper sm:mt-16">
          <ul className="grid grid-cols-1 divide-y divide-k-ink/20 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
            {FIXED_PLANS.map((plan, i) => {
              const d = PLAN_DETAILS[plan];
              const popular = plan === POPULAR_PLAN;
              return (
                <li
                  key={plan}
                  aria-labelledby={`plan-${plan}`}
                  className={cn(
                    "relative flex min-w-0 flex-col gap-5 p-6 lg:p-8",
                    // Rules between the columns of the sheet.
                    i % 2 === 1 && "sm:border-l sm:border-k-ink/20",
                    i >= 2 && "sm:border-t sm:border-k-ink/20 lg:border-t-0",
                    i === 2 && "lg:border-l lg:border-k-ink/20",
                    popular && "bg-k-paper-2",
                  )}
                >
                  {popular && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-k-volt" />}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 id={`plan-${plan}`} className="font-display text-2xl font-extrabold uppercase tracking-wide">
                      {d.name}
                    </h3>
                    {popular && (
                      <span className="bg-k-volt px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-k-ink">{p.popular}</span>
                    )}
                  </div>
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-display text-5xl font-extrabold tabular-nums">{d.monthlyPrice}</span>
                    <span className="text-base font-semibold text-k-muted">{p.perMonth}</span>
                  </p>
                  <ul className="divide-y divide-k-line border-y border-k-line text-[17px]">
                    <li className="py-2.5">{p.users(d.users)}</li>
                    <li className="py-2.5">{p.installations(d.installations)}</li>
                  </ul>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-col gap-4 border-t border-k-ink/70 p-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <div className="min-w-0">
              <h3 className="font-display text-2xl font-extrabold">{p.customTitle}</h3>
              <p className="mt-1 max-w-2xl text-k-muted">{p.customBody}</p>
            </div>
            {contact ? (
              <Button asChild size="lg" variant="outline" className="shrink-0">
                <a href={contact}>{p.customCta}</a>
              </Button>
            ) : (
              <Button asChild size="lg" variant="outline" className="shrink-0">
                <Link href="/auth/sign-up">{p.startCta}</Link>
              </Button>
            )}
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-k-green">{p.featuresTitle}</h3>
            <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
              {p.features.map((feature) => (
                <li key={feature} className="flex gap-3 text-[17px]">
                  <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 bg-k-volt" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-k-muted lg:col-span-5 lg:self-end">{p.note}</p>
        </div>
      </div>
    </section>
  );
}
