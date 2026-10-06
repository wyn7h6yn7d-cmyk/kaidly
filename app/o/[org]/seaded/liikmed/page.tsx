import type { Metadata } from "next";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { RoleBadge } from "@/components/app/role-badge";
import { ConfirmForm } from "@/components/forms/confirm-form";
import { InviteForm } from "@/components/organisations/invite-form";
import { PlanLimitNotice } from "@/components/organisations/plan-summary";
import { MemberRoleForm } from "@/components/organisations/member-role-form";
import { SettingsTabs } from "@/components/organisations/settings-tabs";
import { removeMember, revokeInvitation } from "@/lib/actions/organisations";
import { assignableRoles, canManageMember, hasRole } from "@/lib/auth/roles";
import { listMembers, listPendingInvitations } from "@/lib/data/organisations";
import { getOrgPlan, seatsFull } from "@/lib/data/plan";
import { getT } from "@/lib/i18n/server";


export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.members.title };
}

export default async function MembersPage({ params }: { params: Promise<{ org: string }> }) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      render={async ({ org, role, memberRole, user }) => {
        const isAdmin = hasRole(role, "admin");
        const [members, invitations, plan] = await Promise.all([
          listMembers(org.id),
          isAdmin ? listPendingInvitations(org.id) : Promise.resolve([]),
          getOrgPlan(org.id),
        ]);
        const copy = t.app.members;

        return (
          <>
            <PageHeader eyebrow={org.name} title={t.app.settings.title} />
            <SettingsTabs orgSlug={org.slug} active="members" showHistory={hasRole(memberRole, "admin")} />

            <section aria-labelledby="members">
              <div className="mb-4 flex items-baseline justify-between gap-4">
                <h2 id="members" className="text-xl font-bold">
                  {copy.title}
                </h2>
                <span className="text-sm text-k-muted">{copy.count(members.length)}</span>
              </div>
              <p className="mb-4 max-w-3xl text-sm text-k-muted">{t.app.emptyStates.settings.members}</p>
              {!isAdmin && <p className="mb-4 text-sm text-k-muted">{copy.readOnly}</p>}

              <ul className="divide-y divide-k-line border border-k-line bg-k-surface">
                {members.map((member) => {
                  const isSelf = member.userId === user.id;
                  const manageable = !isSelf && canManageMember(role, member.role);
                  const name = member.fullName ?? copy.noName;
                  return (
                    <li
                      key={member.id}
                      className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 font-semibold">
                          <span className="truncate">{name}</span>
                          {isSelf && (
                            <span className="text-xs font-semibold uppercase tracking-wider text-k-muted">
                              {t.app.you}
                            </span>
                          )}
                        </p>
                        <p className="truncate text-sm text-k-muted">{member.email}</p>
                      </div>
                      {manageable ? (
                        <div className="flex flex-wrap items-start gap-3">
                          <MemberRoleForm
                            memberId={member.id}
                            current={member.role}
                            options={assignableRoles(role)}
                            label={`${copy.changeRole}: ${name}`}
                          />
                          <ConfirmForm
                            action={removeMember}
                            fields={{ memberId: member.id }}
                            confirm={copy.removeConfirm(name)}
                            label={copy.remove}
                            variant="ghost"
                          />
                        </div>
                      ) : (
                        <RoleBadge role={member.role} className="self-start sm:self-center" />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {isAdmin && (
              <>
                <section aria-labelledby="invite" className="mt-12 border-t border-k-line pt-8">
                  <h2 id="invite" className="text-xl font-bold">
                    {t.app.invitations.title}
                  </h2>
                  <p className="mb-6 mt-1 max-w-2xl text-k-muted">{t.app.invitations.description}</p>
                  {plan.userLimit !== null && (
                    <p className="mb-4 text-sm font-semibold tabular-nums">{t.app.plan.seatsUsage(plan.seatsUsed, plan.userLimit)}</p>
                  )}
                  {seatsFull(plan) ? (
                    <PlanLimitNotice kind="seats" orgName={org.name} trial={plan.status === "trial" && !plan.plan} />
                  ) : (
                    <InviteForm organisationId={org.id} roles={assignableRoles(role)} />
                  )}
                </section>

                <section aria-labelledby="pending" className="mt-12">
                  <h2 id="pending" className="mb-4 text-xl font-bold">
                    {t.app.invitations.pendingTitle}
                  </h2>
                  {invitations.length === 0 ? (
                    <p className="text-k-muted">{t.app.invitations.pendingEmpty}</p>
                  ) : (
                    <ul className="divide-y divide-k-line border border-k-line bg-k-surface">
                      {invitations.map((invitation) => (
                        <li
                          key={invitation.id}
                          className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{invitation.email}</p>
                            <p className="text-sm text-k-muted">
                              {t.roles[invitation.role]} · {t.app.invitations.expires(t.fmt.date(invitation.expiresAt))}
                            </p>
                          </div>
                          {canManageMember(role, invitation.role) && (
                            <ConfirmForm
                              action={revokeInvitation}
                              fields={{ invitationId: invitation.id }}
                              confirm={t.app.invitations.revokeConfirm(invitation.email)}
                              label={t.app.invitations.revoke}
                              variant="ghost"
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </>
        );
      }}
    />
  );
}
