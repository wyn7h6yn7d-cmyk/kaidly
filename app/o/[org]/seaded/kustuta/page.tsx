import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { LifecycleForm } from "@/components/organisations/lifecycle-form";
import { getLifecycleFacts } from "@/lib/data/organisations";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.lifecycle.pageTitle };
}

/**
 * Owner-only. An organisation without operational history can be deleted permanently;
 * one with history can only be deactivated until retention rules exist. The database
 * enforces both (delete_organisation / deactivate_organisation).
 */
export default async function DeleteOrganisationPage({ params }: { params: Promise<{ org: string }> }) {
  return (
    <OrgPage
      params={params}
      minRole="owner"
      readable
      render={async ({ org }) => {
        const [t, facts] = await Promise.all([getT(), getLifecycleFacts(org.id)]);
        const l = t.app.lifecycle;
        const mode = facts.hasHistory ? "deactivate" : "delete";
        return (
          <>
            <PageHeader
              eyebrow={org.name}
              title={l.pageTitle}
              back={{ href: `/o/${org.slug}/seaded`, label: t.app.settings.title }}
            />
            <section aria-labelledby="lifecycle" className="k-measure grid gap-6">
              <div className="border-l-4 border-k-danger bg-k-surface px-4 py-4 sm:px-5">
                <h2 id="lifecycle" className="flex items-center gap-2 text-xl font-bold">
                  <TriangleAlert className="size-5 shrink-0 text-k-danger" aria-hidden="true" />
                  {mode === "delete" ? l.deleteTitle : l.deactivateTitle}
                </h2>
                <p className="mt-2">{mode === "delete" ? l.deleteBody : l.deactivateBody}</p>
                {mode === "deactivate" && <p className="mt-2 text-k-muted">{l.deactivateEffects}</p>}
                <p className="mt-3 text-sm text-k-muted">
                  {l.facts}: {l.entries(facts.entries)} · {l.deficiencies(facts.deficiencies)} ·{" "}
                  {l.documents(facts.documents)} · {l.members(facts.members)}
                </p>
                <p className="mt-2 text-sm font-semibold">{l.allMembers}</p>
              </div>
              <LifecycleForm mode={mode} organisationId={org.id} orgSlug={org.slug} name={org.name} />
            </section>
          </>
        );
      }}
    />
  );
}
