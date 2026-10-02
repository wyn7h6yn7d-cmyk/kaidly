import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { RoleChange } from "@/components/admin/role-change";
import { AdminTitle, Badge, Rows, Section, TableFrame, td, th } from "@/components/admin/ui";
import { LoadingBlock } from "@/components/app/states";
import {
  adminRemoveMember,
  adminRevokeSessions,
  adminSendPasswordReset,
  adminSetUserDisabled,
} from "@/lib/actions/admin";
import { fmtDate, fmtDateTime, fmtNumber } from "@/lib/admin/format";
import { ADMIN } from "@/lib/admin/strings";
import { adminUser, requirePlatformAdmin } from "@/lib/data/admin";
import { uuid } from "@/lib/validation/common";

type Params = Promise<{ user: string }>;

async function UserDetail({ params }: { params: Params }) {
  const { user: id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const me = await requirePlatformAdmin();
  const { account, memberships, usage, recent } = await adminUser(id);
  const s = ADMIN.user;
  const who = account.full_name || account.email || account.id;
  const isSelf = account.id === me.id;
  return (
    <>
      <AdminTitle title={who}>
        <Link href="/admin/users" className="inline-flex min-h-11 items-center font-semibold text-k-green underline underline-offset-4">
          {ADMIN.nav.users}
        </Link>
      </AdminTitle>

      <Section id="account" title={s.account}>
        <Rows
          rows={[
            [ADMIN.users.name, account.full_name || ADMIN.users.noName],
            [ADMIN.users.email, <span key="e" className="break-all">{account.email}</span>],
            [s.phone, account.phone || "—"],
            [s.language, account.preferred_locale?.toUpperCase() || "—"],
            [ADMIN.users.created, fmtDate(account.created_at)],
            [ADMIN.users.lastSignIn, account.last_sign_in_at ? fmtDateTime(account.last_sign_in_at) : ADMIN.users.never],
            [
              s.status,
              <span key="s" className="flex flex-wrap gap-1">
                {account.disabled ? <Badge tone="danger">{ADMIN.users.disabled}</Badge> : <Badge tone="ok">{s.active}</Badge>}
                {!account.email_confirmed && <Badge tone="warn">{ADMIN.users.unconfirmed}</Badge>}
                {account.platform_admin && <Badge tone="ok">{ADMIN.users.platformAdmin}</Badge>}
              </span>,
            ],
            [s.id, <code key="i" className="break-all text-xs">{account.id}</code>],
          ]}
        />
      </Section>

      <Section id="memberships" title={s.memberships}>
        {memberships.length === 0 ? (
          <p className="text-k-muted">{s.noMemberships}</p>
        ) : (
          <TableFrame label={s.memberships}>
            <thead>
              <tr>
                <th className={th}>{ADMIN.companies.name}</th>
                <th className={th}>{s.changeRole}</th>
                <th className={th}>{ADMIN.table.actions}</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((m) => (
                <tr key={m.membership_id}>
                  <td className={td}>
                    <Link href={`/admin/companies/${m.company_id}`} className="font-semibold text-k-green underline underline-offset-4">
                      {m.company}
                    </Link>
                    <span className="block text-k-muted">{fmtDate(m.joined_at)}</span>
                    {m.deactivated && <Badge>{ADMIN.companies.deactivated}</Badge>}
                  </td>
                  <td className={td}>
                    <RoleChange membershipId={m.membership_id} current={m.role} who={who} company={m.company} />
                  </td>
                  <td className={td}>
                    <ConfirmAction
                      action={adminRemoveMember}
                      fields={{ membershipId: m.membership_id, userId: account.id }}
                      label={s.removeMember}
                      title={`${s.removeMember}: ${m.company}`}
                      body={`${who} kaotab ligipääsu ettevõttele ${m.company}. Tema varasemad sissekanded jäävad alles.`}
                      confirmWord={account.email ?? undefined}
                      variant="destructive"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </Section>

      <Section id="usage" title={s.usage}>
        <Rows
          rows={[
            [s.usageEntries, fmtNumber(usage.log_entries)],
            [s.usageCompleted, fmtNumber(usage.activities_completed)],
            [s.usageDeficiencies, fmtNumber(usage.deficiencies_created)],
            [s.usageResolved, fmtNumber(usage.deficiencies_resolved)],
            [s.usageDocuments, fmtNumber(usage.documents_uploaded)],
          ]}
        />
      </Section>

      <Section id="recent" title={s.recent}>
        <p className="mb-2 text-sm text-k-muted">{s.recentHint}</p>
        {recent.length === 0 ? (
          <p className="text-k-muted">{s.recentNone}</p>
        ) : (
          <ul className="max-w-3xl border-t border-k-line">
            {recent.map((r, i) => (
              <li key={i} className="border-b border-k-line py-2 text-sm">
                <span className="text-k-muted">{fmtDateTime(r.created_at)}</span> · {r.company} ·{" "}
                {ADMIN.history.tables[r.table_name] ?? r.table_name} {ADMIN.history[r.action as "insert"] ?? r.action}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="actions" title={s.actions}>
        <p className="mb-4 max-w-3xl text-sm text-k-muted">{s.noImpersonation}</p>
        <div className="flex flex-wrap items-start gap-4">
          {account.email_confirmed && account.email && (
            <ConfirmAction
              action={adminSendPasswordReset}
              fields={{ userId: account.id }}
              label={s.resetPassword}
              title={s.resetPassword}
              body={s.resetPasswordBody(account.email)}
              success={s.resetSent}
            />
          )}
          <ConfirmAction
            action={adminRevokeSessions}
            fields={{ userId: account.id }}
            label={s.revokeSessions}
            title={s.revokeSessions}
            body={s.revokeBody}
          />
          {isSelf ? (
            <p className="text-sm text-k-muted">{s.self}</p>
          ) : account.disabled ? (
            <ConfirmAction
              action={adminSetUserDisabled}
              fields={{ userId: account.id, disabled: "false" }}
              label={s.enable}
              title={s.enable}
              body={s.enableBody}
            />
          ) : (
            <ConfirmAction
              action={adminSetUserDisabled}
              fields={{ userId: account.id, disabled: "true" }}
              label={s.disable}
              title={`${s.disable}: ${who}`}
              body={s.disableBody}
              confirmWord={account.email ?? undefined}
              variant="destructive"
            />
          )}
        </div>
      </Section>
    </>
  );
}

export default function AdminUserPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<LoadingBlock lines={6} />}>
      <UserDetail params={params} />
    </Suspense>
  );
}
