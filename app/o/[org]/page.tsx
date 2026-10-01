import Link from "next/link";
import { UserPlus } from "lucide-react";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { ComingSoon } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { hasRole } from "@/lib/auth/roles";
import { t } from "@/lib/i18n";

export default function OverviewPage({ params }: { params: Promise<{ org: string }> }) {
  return (
    <OrgPage
      params={params}
      render={({ org, role }) => (
        <>
          <PageHeader
            eyebrow={t.app.nav.overview}
            title={org.name}
            description={`${t.app.organisations.yourRole}: ${t.roles[role]}`}
            actions={
              hasRole(role, "admin") ? (
                <Button asChild variant="outline">
                  <Link href={`/o/${org.slug}/seaded/liikmed`}>
                    <UserPlus aria-hidden="true" />
                    {t.app.invitations.title}
                  </Link>
                </Button>
              ) : undefined
            }
          />
          <ComingSoon title={t.app.nav.overview} />
        </>
      )}
    />
  );
}
