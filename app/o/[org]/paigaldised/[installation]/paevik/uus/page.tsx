import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrgPage } from "@/components/app/org-page";
import { LogEntryForm } from "@/components/log/log-entry-form";
import { hasRole } from "@/lib/auth/roles";
import { getInstallation } from "@/lib/data/sites";
import { t } from "@/lib/i18n";
import { toLocalInput } from "@/lib/time";
import { ForbiddenState } from "@/components/app/states";

export const metadata: Metadata = { title: t.app.log.newTitle };

export default function NewLogEntryPage({
  params,
}: {
  params: Promise<{ org: string; installation: string }>;
}) {
  return (
    <OrgPage
      params={params}
      minRole="operator"
      render={async ({ org, role, user }) => {
        const { installation: id } = await params;
        const installation = await getInstallation(org.id, id);
        if (!installation) notFound();
        if (!hasRole(role, "operator") || installation.archivedAt) return <ForbiddenState orgSlug={org.slug} />;
        const logHref = `/o/${org.slug}/paigaldised/${installation.id}/paevik`;

        return (
          <>
            <h2 className="mb-6 text-xl font-bold">{t.app.log.newTitle}</h2>
            <LogEntryForm
              orgSlug={org.slug}
              installationId={installation.id}
              defaults={{ occurredAt: toLocalInput(), performedByName: user.fullName }}
              cancelHref={logHref}
            />
          </>
        );
      }}
    />
  );
}
