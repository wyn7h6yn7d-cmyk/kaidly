import { Suspense } from "react";
import { AppShell } from "@/components/app/app-shell";
import { OrgSwitcher } from "@/components/app/org-switcher";
import { ShellSkeleton } from "@/components/app/states";
import { UserMenu } from "@/components/app/user-menu";
import { listMyOrganisations, requireOrg } from "@/lib/data/organisations";

/**
 * Everything under /o/[org] runs inside this frame. Membership is checked here *and*
 * again by every page and action (the layout is not a security boundary on its own);
 * the database enforces it a third time through RLS.
 */
async function OrganisationFrame({
  params,
  children,
}: {
  params: Promise<{ org: string }>;
  children: React.ReactNode;
}) {
  const { org: slug } = await params;
  const [{ org, user }, organisations] = await Promise.all([requireOrg(slug), listMyOrganisations()]);
  const current = { slug: org.slug, name: org.name };

  return (
    <AppShell
      orgSlug={org.slug}
      sidebarSwitcher={<OrgSwitcher current={current} organisations={organisations} tone="light" />}
      topBarSwitcher={<OrgSwitcher current={current} organisations={organisations} tone="dark" />}
      sidebarFooter={<UserMenu name={user.fullName} email={user.email} tone="light" />}
      topBarEnd={<UserMenu name={user.fullName} email={user.email} tone="dark" />}
    >
      {children}
    </AppShell>
  );
}

export default function OrganisationLayout({
  params,
  children,
}: {
  params: Promise<{ org: string }>;
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <OrganisationFrame params={params}>{children}</OrganisationFrame>
    </Suspense>
  );
}
