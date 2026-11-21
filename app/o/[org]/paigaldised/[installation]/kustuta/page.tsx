import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OrgPage } from "@/components/app/org-page";
import { PurgeInstallationForm } from "@/components/sites/purge-installation-form";
import { getInstallation, getInstallationRecordCounts } from "@/lib/data/sites";
import { getT } from "@/lib/i18n/server";

// Reads request data (session, language cookie, params): allowed to block on navigation
// instead of claiming an instant static shell (Next 16.4 instant validation).
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.installations.purge.title };
}

/** "Ekspordi ja kustuta" — archived installations with history; owners/admins (docs/ARCHIVE.md). */
export default async function PurgeInstallationPage({ params }: { params: Promise<{ org: string; installation: string }> }) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      minRole="admin"
      render={async ({ org }) => {
        const { installation: id } = await params;
        const installation = await getInstallation(org.id, id);
        if (!installation) notFound();
        const base = `/o/${org.slug}/paigaldised/${installation.id}`;
        if (!installation.archivedAt) redirect(`${base}/muuda`);
        const counts = await getInstallationRecordCounts(org.id, installation.id);
        const p = t.app.installations.purge;
        const site = installation.site.id;
        return (
          <section aria-labelledby="purge" data-testid="purge">
            <h2 id="purge" className="text-xl font-bold">{p.title}</h2>
            <p className="mt-2 max-w-2xl text-k-muted">{p.intro}</p>
            <p className="mb-8 mt-2 font-semibold">{p.counts(counts.entries, counts.deficiencies, counts.documents)}</p>
            <PurgeInstallationForm
              orgSlug={org.slug}
              installationId={installation.id}
              name={installation.name}
              pdfHref={`/o/${org.slug}/objektid/${site}/auditipakett/pdf?paigaldis=${installation.id}&alates=1990-01-01`}
              csvHref={`/o/${org.slug}/aruanded/log/eksport?format=csv&objekt=${site}&paigaldis=${installation.id}`}
            />
          </section>
        );
      }}
    />
  );
}
