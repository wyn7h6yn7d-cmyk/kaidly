import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrgPage } from "@/components/app/org-page";
import { ComingSoon } from "@/components/app/states";
import { getInstallation } from "@/lib/data/sites";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.app.installations.tabs.log };

// Placeholder: this section is built in a later phase. Access is still checked.
export default function Page({ params }: { params: Promise<{ org: string; installation: string }> }) {
  return (
    <OrgPage
      params={params}
      render={async ({ org }) => {
        const { installation } = await params;
        if (!(await getInstallation(org.id, installation))) notFound();
        return <ComingSoon title={t.app.installations.tabs.log} />;
      }}
    />
  );
}
