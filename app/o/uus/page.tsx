import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { PlainPage } from "@/components/app/plain-page";
import { CreateOrganisationForm } from "@/components/organisations/create-organisation-form";
import { requireUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.createOrganisation.title };
}

/** What the new company gets: the personal trial is shared by every company the user creates. */
async function TrialNote() {
  await requireUser();
  const [t, supabase] = await Promise.all([getT(), createClient()]);
  const { data } = await supabase.rpc("my_trial");
  const trial = data as { ends_at: string; active: boolean } | null;
  const copy = t.app.createOrganisation;
  const text = !trial ? copy.trialNew : trial.active ? copy.trialShared(t.fmt.date(trial.ends_at)) : copy.trialUsed;
  return (
    <p data-testid="trial-note" className="mb-6 max-w-2xl border-l-4 border-k-volt bg-k-surface px-4 py-3 text-sm">
      {text}
    </p>
  );
}

export default async function NewOrganisationPage() {
  const t = await getT();
  return (
    <PlainPage>
      <PageHeader
        title={t.app.createOrganisation.title}
        description={t.app.createOrganisation.description}
        back={{ href: "/o?vali=1", label: t.app.organisations.title }}
      />
      <Suspense fallback={null}>
        <TrialNote />
      </Suspense>
      <CreateOrganisationForm />
    </PlainPage>
  );
}
