import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RoleChange } from "@/components/admin/role-change";
import { AdminTitle, Badge, Rows, Section, TableFrame, td, th } from "@/components/admin/ui";
import { LoadingBlock } from "@/components/app/states";
import { fmtBytes, fmtDate, fmtDateTime, fmtNumber } from "@/lib/admin/format";
import { ADMIN } from "@/lib/admin/strings";
import { adminCompany, adminCompanyAccess } from "@/lib/data/admin";
import { uuid } from "@/lib/validation/common";

type Params = Promise<{ company: string }>;

async function CompanyDetail({ params }: { params: Params }) {
  const { company: id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const [{ company, members, counts, recent }, access] = await Promise.all([adminCompany(id), adminCompanyAccess(id)]);
  const s = ADMIN.company;
  const a = ADMIN.access;
  const tone = access.status === "expired" ? "warn" : access.status === "deactivated" ? "neutral" : "ok";
  return (
    <>
      <AdminTitle title={company.name} intro={s.contentNote}>
        <Link
          href={`/admin/deadlines?ettevote=${company.id}`}
          className="inline-flex min-h-11 items-center font-semibold text-k-green underline underline-offset-4"
        >
          {s.deadlinesLink}
        </Link>
      </AdminTitle>

      <Section id="details" title={s.details}>
        <Rows
          rows={[
            [s.status, company.deactivated_at ? <Badge key="d">{`${ADMIN.companies.deactivated} ${fmtDate(company.deactivated_at)}`}</Badge> : <Badge key="a" tone="ok">{s.active}</Badge>],
            [s.registryCode, company.registry_code || "—"],
            [s.contactEmail, company.contact_email || "—"],
            [s.contactPhone, company.contact_phone || "—"],
            [s.address, company.address || "—"],
            [s.slug, <code key="s" className="break-all text-xs">/o/{company.slug}</code>],
            [s.created, fmtDate(company.created_at)],
          ]}
        />
      </Section>

      <Section id="access" title={a.title}>
        {access.expired_90 && (
          <div className="mb-4 max-w-3xl border-l-4 border-k-warn bg-k-paper-2 p-4">
            <p className="font-bold">{a.expired90}</p>
            <p className="mt-1 text-sm">{a.expired90Body}</p>
          </div>
        )}
        <Rows
          rows={[
            [a.status, <Badge key="s" tone={tone}>{a.statuses[access.status]}</Badge>],
            [a.trialStart, fmtDateTime(access.trial_started_at)],
            [a.trialEnd, fmtDateTime(access.trial_ends_at)],
            [a.fullFrom, fmtDateTime(access.full_access_from)],
            [a.until, access.full_access_from && !access.full_access_until ? a.indefinite : fmtDateTime(access.full_access_until)],
            [a.activatedBy, access.activated_by ?? "—"],
            [a.invoice, access.invoice_reference ?? "—"],
            [a.notes, access.admin_notes ?? "—"],
          ]}
        />
        <p className="mt-4">
          <Link
            href={`/admin/tellimused/${company.id}`}
            className="inline-flex min-h-11 items-center font-semibold text-k-green underline underline-offset-4"
          >
            {ADMIN.subs.companyLink}
          </Link>
        </p>
      </Section>

      <Section id="counts" title={s.counts}>
        <Rows
          rows={[
            [ADMIN.companies.sites, fmtNumber(counts.sites)],
            [ADMIN.companies.installations, fmtNumber(counts.installations)],
            [s.logEntries, fmtNumber(counts.log_entries)],
            [s.activities, fmtNumber(counts.activities)],
            [ADMIN.companies.overdue, fmtNumber(counts.overdue)],
            [s.dueSoon, fmtNumber(counts.due_soon)],
            [ADMIN.companies.openDeficiencies, fmtNumber(counts.deficiencies_open)],
            [s.serious, fmtNumber(counts.deficiencies_serious)],
            [ADMIN.companies.documents, fmtNumber(counts.documents)],
            [s.storedFiles, fmtNumber(counts.stored_files)],
            [s.storage, fmtBytes(counts.storage_bytes)],
          ]}
        />
      </Section>

      <Section id="members" title={s.members}>
        <TableFrame label={s.members}>
          <thead>
            <tr>
              <th className={th}>{ADMIN.users.name}</th>
              <th className={th}>{ADMIN.user.changeRole}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.membership_id}>
                <td className={td}>
                  <Link href={`/admin/users/${m.user_id}`} className="font-semibold text-k-green underline underline-offset-4">
                    {m.name || ADMIN.users.noName}
                  </Link>
                  <span className="block break-all text-k-muted">{m.email}</span>
                </td>
                <td className={td}>
                  <RoleChange
                    membershipId={m.membership_id}
                    current={m.role}
                    who={m.name || m.email || ""}
                    company={company.name}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      </Section>

      <Section id="recent" title={s.recent}>
        <p className="mb-2 text-sm text-k-muted">{ADMIN.user.recentHint}</p>
        {recent.length === 0 ? (
          <p className="text-k-muted">{ADMIN.user.recentNone}</p>
        ) : (
          <ul className="max-w-3xl border-t border-k-line">
            {recent.map((r, i) => (
              <li key={i} className="border-b border-k-line py-2 text-sm">
                <span className="text-k-muted">{fmtDateTime(r.created_at)}</span> · {r.actor ?? "—"} ·{" "}
                {ADMIN.history.tables[r.table_name] ?? r.table_name} {ADMIN.history[r.action as "insert"] ?? r.action}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

export default function AdminCompanyPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<LoadingBlock lines={6} />}>
      <CompanyDetail params={params} />
    </Suspense>
  );
}
