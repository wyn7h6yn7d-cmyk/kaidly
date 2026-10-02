import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Upload } from "lucide-react";
import { OrgPage } from "@/components/app/org-page";
import { EmptyState } from "@/components/app/states";
import { DocumentList } from "@/components/documents/document-list";
import { FormMessage } from "@/components/forms/form-message";
import { Pager, parsePage } from "@/components/log/log-list";
import { Button } from "@/components/ui/button";
import { hasRole } from "@/lib/auth/roles";
import { listDocuments } from "@/lib/data/documents";
import { getInstallation } from "@/lib/data/sites";
import { getT } from "@/lib/i18n/server";


export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.installations.tabs.documents };
}

export default async function InstallationDocumentsPage({
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
        const documents = await listDocuments(org.id, { installationId: installation.id }, page);
        const copy = t.app.documents;
        const base = `/o/${org.slug}/paigaldised/${installation.id}/dokumendid`;
        const canUpload = hasRole(role, "operator") && !installation.archivedAt;
        const uploadButton = canUpload ? (
          <Button asChild>
            <Link href={`/o/${org.slug}/dokumendid/uus?paigaldis=${installation.id}`}>
              <Upload aria-hidden="true" />
              {copy.upload}
            </Link>
          </Button>
        ) : undefined;

        return (
          <>
            {query.salvestatud && (
              <div className="mb-4">
                <FormMessage success={copy.saved} />
              </div>
            )}
            {documents.items.length === 0 && page === 1 ? (
              <EmptyState title={copy.empty} body={copy.emptyHint} action={uploadButton} />
            ) : (
              <>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-k-muted">{copy.installationIntro}</p>
                  {uploadButton}
                </div>
                <DocumentList
                  orgSlug={org.slug}
                  items={documents.items}
                  contextFor={(doc) =>
                    doc.logEntryId ? copy.linkedLogEntry : doc.deficiencyId ? copy.linkedDeficiency : null
                  }
                />
                <Pager generic page={documents.page} hasMore={documents.hasMore} hrefFor={(p) => `${base}?lk=${p}`} />
              </>
            )}
          </>
        );
      }}
    />
  );
}
