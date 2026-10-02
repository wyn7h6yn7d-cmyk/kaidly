import { Suspense } from "react";
import { hasRole, type Role } from "@/lib/auth/roles";
import { requireOrg, type OrgContext } from "@/lib/data/organisations";
import { DeactivatedState, ForbiddenState, LoadingBlock } from "./states";

type Params = Promise<{ org: string }>;

async function Resolve({
  params,
  minRole,
  render,
}: {
  params: Params;
  minRole?: Role;
  render: (ctx: OrgContext) => React.ReactNode | Promise<React.ReactNode>;
}) {
  const { org } = await params;
  const ctx = await requireOrg(org); // not a member / unknown → not-found page
  // A deactivated organisation is out of normal use: one notice instead of every page
  // (the database refuses its writes anyway).
  if (ctx.org.deactivatedAt) return <DeactivatedState ctx={ctx} />;
  if (minRole && !hasRole(ctx.role, minRole)) return <ForbiddenState orgSlug={ctx.org.slug} />;
  return render(ctx);
}

/**
 * Page inside an organisation: resolves the membership on every request (pages don't
 * rely on the layout's check) and streams behind a loading state.
 */
export function OrgPage(props: {
  params: Params;
  minRole?: Role;
  render: (ctx: OrgContext) => React.ReactNode | Promise<React.ReactNode>;
}) {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Resolve {...props} />
    </Suspense>
  );
}
