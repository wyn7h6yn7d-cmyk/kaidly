import type { Metadata } from "next";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { ComingSoon } from "@/components/app/states";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.app.nav.sites };

// Placeholder: this module is built in a later phase (docs/IMPLEMENTATION_PLAN.md).
export default function Page({ params }: { params: Promise<{ org: string }> }) {
  return (
    <OrgPage
      params={params}
      render={({ org }) => (
        <>
          <PageHeader eyebrow={org.name} title={t.app.nav.sites} />
          <ComingSoon title={t.app.nav.sites} />
        </>
      )}
    />
  );
}
