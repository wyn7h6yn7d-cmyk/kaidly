import type { Metadata } from "next";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { OnboardingChecklist } from "@/components/dashboard/sections";
import { ConfirmForm } from "@/components/forms/confirm-form";
import { showGuide } from "@/lib/actions/onboarding";
import { getOnboarding } from "@/lib/data/onboarding";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.help.title };
}

const TERMS = ["site", "installation", "log", "schedule", "deficiency", "document"] as const;

/** Abi: the getting-started guide with real progress, and the six core terms. No knowledge base. */
export default async function HelpPage({ params }: { params: Promise<{ org: string }> }) {
  return (
    <OrgPage
      params={params}
      render={async (ctx) => {
        const [t, onboarding] = await Promise.all([getT(), getOnboarding(ctx)]);
        const h = t.app.help;
        return (
          <>
            <PageHeader eyebrow={ctx.org.name} title={h.title} description={h.intro} />
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
              <div className="grid content-start gap-4">
                <OnboardingChecklist orgSlug={ctx.org.slug} steps={onboarding.steps} />
                {onboarding.hidden && !onboarding.complete && (
                  <ConfirmForm
                    action={showGuide}
                    fields={{ orgSlug: ctx.org.slug }}
                    label={t.app.onboarding.showOnOverview}
                    variant="outline"
                  />
                )}
              </div>
              <section aria-labelledby="terms">
                <h2 id="terms" className="mb-3 text-xl font-bold">
                  {h.termsTitle}
                </h2>
                <dl className="divide-y divide-k-line border-y border-k-line">
                  {TERMS.map((key) => (
                    <div key={key} className="py-4">
                      <dt className="font-bold">{h.terms[key].term}</dt>
                      <dd className="mt-1 text-k-muted">{h.terms[key].text}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          </>
        );
      }}
    />
  );
}
