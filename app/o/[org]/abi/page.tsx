import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
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
              <div className="grid content-start gap-10">
              <section aria-labelledby="meeldetuletused-title" id="meeldetuletused" className="scroll-mt-6">
                <h2 id="meeldetuletused-title" className="mb-2 text-xl font-bold">
                  {h.reminders.title}
                </h2>
                <p className="text-k-ink/75">{h.reminders.intro}</p>
                <dl className="mt-3 divide-y divide-k-line border-y border-k-line">
                  {h.reminders.items.map((item) => (
                    <div key={item.term} className="py-3">
                      <dt className="font-bold">{item.term}</dt>
                      <dd className="mt-1 text-k-muted">{item.text}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-sm text-k-muted">{h.reminders.note}</p>
                <Link href="/teavitused" className="mt-2 inline-flex min-h-11 items-center gap-2 font-semibold text-k-green underline underline-offset-4">
                  <Bell className="size-4" aria-hidden="true" />
                  {h.reminders.open}
                </Link>
              </section>
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
            </div>
          </>
        );
      }}
    />
  );
}
