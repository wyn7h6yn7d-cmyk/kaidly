import type { Metadata } from "next";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { ImportWizard } from "@/components/import/import-wizard";
import { SettingsTabs } from "@/components/organisations/settings-tabs";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.dataImport.title };
}

/**
 * CSV import of sites and installations — owners and admins. A read-only (expired)
 * company may check a file; the import itself is refused by the action and the database.
 */
export default async function ImportPage({ params }: { params: Promise<{ org: string }> }) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      minRole="admin"
      readable
      render={({ org, access }) => (
        <>
          <PageHeader eyebrow={org.name} title={t.app.settings.title} />
          <SettingsTabs orgSlug={org.slug} active="import" showHistory />
          <h2 className="text-xl font-bold">{t.app.dataImport.title}</h2>
          <p className="mt-1 max-w-2xl text-k-muted">{t.app.dataImport.intro}</p>
          <p className="mb-8 mt-2 max-w-2xl text-sm text-k-muted">{t.app.dataImport.scope}</p>
          <ImportWizard orgSlug={org.slug} writable={access.writable} />
        </>
      )}
    />
  );
}
