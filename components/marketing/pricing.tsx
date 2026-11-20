import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { contactMailto } from "@/lib/access";
import { COMPANY } from "@/lib/company";
import { INTL_LOCALE } from "@/lib/i18n/locales";
import { getT } from "@/lib/i18n/server";
import { ENTERPRISE_PLAN, FIXED_PLANS, FOUNDER_OFFER_ENABLED, PLAN_DETAILS, RECOMMENDED_PLAN } from "@/lib/plans";
import { PricingTable, type PricingRow } from "./pricing-table";

/**
 * Public pricing (landing page, #hinnad). One ruled sheet, like the system drawing above
 * it — not a row of floating cards. Plans differ only by limits; the feature list applies
 * to all of them. The free trial is stated next to the prices, not as a plan. Prices and
 * limits come from lib/plans.ts (the same configuration the app and database use).
 */
export async function Pricing() {
  const t = await getT();
  const p = t.landing.pricing;
  const enterpriseHref = contactMailto(COMPANY.email, p.enterpriseSubject);
  const founderHref = contactMailto(COMPANY.email, p.founderSubject);
  // Prices always grouped ("1 990", "1,990"), also for four digits.
  const price = new Intl.NumberFormat(INTL_LOCALE[t.locale], { useGrouping: "always" });
  const rows: PricingRow[] = FIXED_PLANS.map((plan) => {
    const d = PLAN_DETAILS[plan];
    return {
      plan,
      name: d.name,
      audience: p.audience[plan],
      monthlyPrice: price.format(d.monthlyPrice),
      annualPrice: price.format(d.annualPrice),
      users: p.users(d.users),
      installations: p.installations(d.installations),
      recommended: plan === RECOMMENDED_PLAN,
      annualHref: contactMailto(COMPANY.email, p.annualSubject(d.name)),
    };
  });

  return (
    <section id="hinnad" tabIndex={-1} aria-labelledby="hinnad-title" className="scroll-mt-4 outline-none border-b border-k-line bg-k-paper">
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

        {FOUNDER_OFFER_ENABLED && (
          <p className="mt-12 border-l-4 border-k-volt bg-k-paper-2 px-5 py-4 text-[17px] font-semibold sm:mt-16" data-testid="founder-offer">
            {p.founderOffer.before}
            {founderHref ? (
              <a href={founderHref} className="underline underline-offset-4">
                {COMPANY.email}
              </a>
            ) : (
              COMPANY.email
            )}
            {p.founderOffer.after}
          </p>
        )}

        <PricingTable
          rows={rows}
          labels={{
            billingLabel: p.billingLabel,
            billingMonthly: p.billingMonthly,
            billingAnnual: p.billingAnnual,
            perMonth: p.perMonth,
            perYear: p.perYear,
            annualFree: p.annualFree,
            annualInvoice: p.annualInvoice,
            recommended: p.recommended,
            contactCta: p.contactCta,
          }}
        />

        <div
          className="flex flex-col gap-4 border-x border-b border-k-ink/70 bg-k-paper p-6 sm:flex-row sm:items-center sm:justify-between lg:px-8"
          data-plan="enterprise"
          aria-labelledby="plan-enterprise"
        >
          <div className="min-w-0">
            <h3 id="plan-enterprise" className="font-display text-2xl font-extrabold uppercase tracking-wide">
              {p.enterpriseName}
            </h3>
            <p className="mt-1 text-k-muted">{p.audience.enterprise}</p>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[17px]">
              <span className="font-semibold">{p.enterprisePrice}</span>
              <span>{p.installationsFrom(ENTERPRISE_PLAN.installationsFrom)}</span>
            </p>
          </div>
          {enterpriseHref && (
            <Button asChild size="lg" variant="outline" className="shrink-0">
              <a href={enterpriseHref}>{p.contactCta}</a>
            </Button>
          )}
        </div>
        <p className="mt-4 text-sm font-semibold" data-testid="vat-note">
          {p.vatNote}
        </p>

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
