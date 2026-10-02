import { Suspense } from "react";
import { hasRole, type Role } from "@/lib/auth/roles";
import { requireOrg, type OrgContext } from "@/lib/data/organisations";
import { DeactivatedState, ForbiddenState, LoadingBlock, ReadOnlyState } from "./states";

type Params = Promise<{ org: string }>;

async function Resolve({
  params,
  minRole,
  readable = false,
  render,
}: {
  params: Params;
  minRole?: Role;
  readable?: boolean;
  render: (ctx: OrgContext) => React.ReactNode | Promise<React.ReactNode>;
}) {
  const { org } = await params;
  const ctx = await requireOrg(org); // not a member / unknown → not-found page
  // A deactivated organisation is out of normal use: one notice instead of every page
  // (the database refuses its writes anyway).
  if (ctx.org.deactivatedAt) return <DeactivatedState ctx={ctx} />;
  if (minRole && !hasRole(readable ? ctx.memberRole : ctx.role, minRole)) {
    // The role would allow it, but the company is read-only: say so instead of "no access".
    return hasRole(ctx.memberRole, minRole) ? <ReadOnlyState ctx={ctx} /> : <ForbiddenState orgSlug={ctx.org.slug} />;
  }
  return render(ctx);
}

/**
 * Page inside an organisation: resolves the membership on every request (pages don't
 * rely on the layout's check) and streams behind a loading state.
 */
export function OrgPage(props: {
  params: Params;
  minRole?: Role;
  /** A read-only page for that role (history) or an owner lifecycle page: allowed while expired. */
  readable?: boolean;
  render: (ctx: OrgContext) => React.ReactNode | Promise<React.ReactNode>;
}) {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Resolve {...props} />
    </Suspense>
  );
}
