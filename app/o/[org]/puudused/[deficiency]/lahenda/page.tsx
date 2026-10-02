import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { NoticeState } from "@/components/app/states";
import { ResolveDeficiencyForm } from "@/components/deficiencies/resolve-form";
import { getDeficiency } from "@/lib/data/deficiencies";
import { toLocalInput } from "@/lib/time";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.deficiencies.resolveTitle };
}

export default async function ResolveDeficiencyPage({
  params,
}: {
  params: Promise<{ org: string; deficiency: string }>;
}) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      minRole="operator"
      render={async ({ org, user }) => {
        const { deficiency: id } = await params;
        const deficiency = await getDeficiency(org.id, id);
        if (!deficiency) notFound();
        const href = `/o/${org.slug}/puudused/${deficiency.id}`;
        if (deficiency.status === "resolved") {
          return <NoticeState message={t.errors.deficiency_already_resolved} href={href} linkLabel={deficiency.title} />;
        }
        return (
          <>
            <PageHeader
              eyebrow={deficiency.title}
              title={t.app.deficiencies.resolveTitle}
              description={t.app.deficiencies.resolveIntro}
              back={{ href, label: deficiency.title }}
            />
            <ResolveDeficiencyForm
              orgSlug={org.slug}
              deficiencyId={deficiency.id}
              occurredAt={toLocalInput()}
              performedByName={user.fullName}
              cancelHref={href}
            />
          </>
        );
      }}
    />
  );
}
