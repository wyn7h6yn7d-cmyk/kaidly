import Link from "next/link";
import { Suspense } from "react";
import { AdminTitle, Badge, Pager, SearchForm, TableFrame, td, th } from "@/components/admin/ui";
import { LoadingBlock } from "@/components/app/states";
import { fmtDate, fmtDateTime } from "@/lib/admin/format";
import { ADMIN } from "@/lib/admin/strings";
import { adminUsers, PAGE_SIZE } from "@/lib/data/admin";

type Search = Promise<{ q?: string; lk?: string }>;

async function Users({ searchParams }: { searchParams: Search }) {
  const { q, lk } = await searchParams;
  const search = q?.trim().slice(0, 100) || undefined;
  const page = Math.max(0, Number.parseInt(lk ?? "0", 10) || 0);
  const { total, rows } = await adminUsers(search, page);
  const s = ADMIN.users;
  return (
    <>
      <SearchForm action="/admin/users" label={s.search} value={search} />
      <p className="mb-3 text-sm text-k-muted">{s.total(total)}</p>
      {rows.length === 0 ? (
        <p>{s.none}</p>
      ) : (
        <TableFrame label={s.title}>
          <thead>
            <tr>
              <th className={th}>{s.name}</th>
              <th className={th}>{s.companies}</th>
              <th className={th}>{s.created}</th>
              <th className={th}>{s.lastSignIn}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td className={td}>
                  <Link href={`/admin/users/${u.id}`} className="font-semibold text-k-green underline underline-offset-4">
                    {u.full_name || s.noName}
                  </Link>
                  <span className="block break-all text-k-muted">{u.email}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {u.disabled && <Badge tone="danger">{s.disabled}</Badge>}
                    {!u.email_confirmed && <Badge tone="warn">{s.unconfirmed}</Badge>}
                    {u.platform_admin && <Badge tone="ok">{s.platformAdmin}</Badge>}
                  </span>
                </td>
                <td className={td}>
                  {u.memberships.length === 0
                    ? "—"
                    : u.memberships.map((m) => (
                        <span key={m.company_id} className="block">
                          {m.company} · {ADMIN.roles[m.role]}
                          {m.deactivated && ` (${ADMIN.companies.deactivated.toLowerCase()})`}
                        </span>
                      ))}
                </td>
                <td className={td}>{fmtDate(u.created_at)}</td>
                <td className={td}>{u.last_sign_in_at ? fmtDateTime(u.last_sign_in_at) : s.never}</td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      )}
      <Pager
        page={page}
        total={total}
        size={PAGE_SIZE}
        href={(p) => `/admin/users?${new URLSearchParams({ ...(search ? { q: search } : {}), lk: String(p) })}`}
      />
    </>
  );
}

export default function AdminUsersPage({ searchParams }: { searchParams: Search }) {
  return (
    <>
      <AdminTitle title={ADMIN.users.title} />
      <Suspense fallback={<LoadingBlock lines={5} />}>
        <Users searchParams={searchParams} />
      </Suspense>
    </>
  );
}
