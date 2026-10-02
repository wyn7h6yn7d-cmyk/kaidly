import Link from "next/link";
import { Suspense } from "react";
import { AdminTitle, Pager, TableFrame, td, th } from "@/components/admin/ui";
import { LoadingBlock } from "@/components/app/states";
import { fmtDateTime } from "@/lib/admin/format";
import { ADMIN } from "@/lib/admin/strings";
import { adminAudit, type AdminAuditEntry } from "@/lib/data/admin";

type Search = Promise<{ lk?: string }>;

function target(entry: AdminAuditEntry) {
  const userId = entry.target_type === "user" ? entry.target_id : (entry.summary.user_id as string | undefined);
  const companyId = entry.target_type === "company" ? entry.target_id : (entry.summary.company_id as string | undefined);
  return (
    <span className="flex flex-col">
      {userId && (
        <Link href={`/admin/users/${userId}`} className="text-k-green underline underline-offset-4">
          {ADMIN.nav.users}: {userId.slice(0, 8)}
        </Link>
      )}
      {companyId && (
        <Link href={`/admin/companies/${companyId}`} className="text-k-green underline underline-offset-4">
          {ADMIN.nav.companies}: {companyId.slice(0, 8)}
        </Link>
      )}
      {"after" in entry.summary && (
        <span className="text-k-muted">
          {ADMIN.access.statuses[String((entry.summary.before as { status?: string } | null)?.status)] ?? "—"} →{" "}
          {ADMIN.access.statuses[String((entry.summary.after as { status?: string } | null)?.status)] ?? "—"}
        </span>
      )}
      {"from" in entry.summary && (
        <span className="text-k-muted">
          {ADMIN.roles[String(entry.summary.from)]} → {ADMIN.roles[String(entry.summary.to)]}
        </span>
      )}
    </span>
  );
}

async function Audit({ searchParams }: { searchParams: Search }) {
  const { lk } = await searchParams;
  const page = Math.max(0, Number.parseInt(lk ?? "0", 10) || 0);
  const rows = await adminAudit(page);
  const s = ADMIN.audit;
  if (rows.length === 0) return <p>{s.none}</p>;
  return (
    <>
      <TableFrame label={s.title}>
        <thead>
          <tr>
            <th className={th}>{s.when}</th>
            <th className={th}>{s.admin}</th>
            <th className={th}>{s.action}</th>
            <th className={th}>{s.target}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td className={`${td} whitespace-nowrap`}>{fmtDateTime(e.created_at)}</td>
              <td className={td}>{e.admin ?? s.system}</td>
              <td className={td}>{s.actions[e.action] ?? e.action}</td>
              <td className={td}>{target(e)}</td>
            </tr>
          ))}
        </tbody>
      </TableFrame>
      <Pager page={page} total={rows.length === 100 ? (page + 2) * 100 : page * 100 + rows.length} size={100} href={(p) => `/admin/audit?lk=${p}`} />
    </>
  );
}

export default function AdminAuditPage({ searchParams }: { searchParams: Search }) {
  return (
    <>
      <AdminTitle title={ADMIN.audit.title} intro={ADMIN.audit.intro} />
      <Suspense fallback={<LoadingBlock lines={5} />}>
        <Audit searchParams={searchParams} />
      </Suspense>
    </>
  );
}
