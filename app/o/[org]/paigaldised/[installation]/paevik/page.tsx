import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GuidedEmptyState } from "@/components/app/guided-empty";
import { OrgPage } from "@/components/app/org-page";

import { FormMessage } from "@/components/forms/form-message";
import { LogList, Pager, parsePage } from "@/components/log/log-list";

import { hasRole } from "@/lib/auth/roles";
import { listInstallationLog } from "@/lib/data/log";
import { getInstallation } from "@/lib/data/sites";
import { getT } from "@/lib/i18n/server";


export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.log.title };
}

export default async function InstallationLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; installation: string }>;
  searchParams: Promise<{ lk?: string; salvestatud?: string }>;
}) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      render={async ({ org, role }) => {
        const [{ installation: id }, query] = await Promise.all([params, searchParams]);
        const installation = await getInstallation(org.id, id);
        if (!installation) notFound();
        const page = parsePage(query.lk);
        const log = await listInstallationLog(org.id, installation.id, page);
        const base = `/o/${org.slug}/paigaldised/${installation.id}/paevik`;
        const canWrite = hasRole(role, "operator") && !installation.archivedAt;
        const copy = t.app.log;

        return (
          <>
            {query.salvestatud && (
              <div className="mb-4">
                <FormMessage success={copy.saved} />
              </div>
            )}
            {log.items.length === 0 && page === 1 ? (
              <GuidedEmptyState
                title={t.app.emptyStates.log.title}
                body={t.app.emptyStates.log.body}
                examples={{ label: t.app.emptyStates.examples, items: t.app.emptyStates.log.examples }}
                action={canWrite ? { href: `${base}/uus`, label: t.app.emptyStates.log.cta } : undefined}
                note={t.app.emptyStates.log.member}
              />
            ) : (
              <>
                <LogList items={log.items} hrefFor={(item) => `${base}/${item.id}`} />
                <Pager page={log.page} hasMore={log.hasMore} hrefFor={(p) => `${base}?lk=${p}`} />
              </>
            )}
          </>
        );
      }}
    />
  );
}
