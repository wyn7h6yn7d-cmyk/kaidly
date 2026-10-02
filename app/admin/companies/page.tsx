import Link from "next/link";
import { Suspense } from "react";
import { AdminTitle, Badge, Pager, SearchForm, TableFrame, td, th } from "@/components/admin/ui";
import { LoadingBlock } from "@/components/app/states";
import { fmtDate, fmtNumber } from "@/lib/admin/format";
import { ADMIN } from "@/lib/admin/strings";
import { adminCompanies, PAGE_SIZE } from "@/lib/data/admin";

type Search = Promise<{ q?: string; lk?: string }>;

async function Companies({ searchParams }: { searchParams: Search }) {
  const { q, lk } = await searchParams;
  const search = q?.trim().slice(0, 100) || undefined;
  const page = Math.max(0, Number.parseInt(lk ?? "0", 10) || 0);
  const { total, rows } = await adminCompanies(search, page);
  const s = ADMIN.companies;
  return (
    <>
      <SearchForm action="/admin/companies" label={s.search} value={search} />
      <p className="mb-3 text-sm text-k-muted">{s.total(total)}</p>
      {rows.length === 0 ? (
        <p>{s.none}</p>
      ) : (
        <TableFrame label={s.title}>
          <thead>
            <tr>
              <th className={th}>{s.name}</th>
              <th className={th}>{s.owners}</th>
              <th className={`${th} text-right`}>{s.members}</th>
              <th className={`${th} text-right`}>{s.sites}</th>
              <th className={`${th} text-right`}>{s.installations}</th>
              <th className={`${th} text-right`}>{s.overdue}</th>
              <th className={`${th} text-right`}>{s.openDeficiencies}</th>
              <th className={`${th} text-right`}>{s.documents}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td className={td}>
                  <Link href={`/admin/companies/${c.id}`} className="font-semibold text-k-green underline underline-offset-4">
                    {c.name}
                  </Link>
                  <span className="block text-k-muted">
                    {c.registry_code ? `${c.registry_code} · ` : ""}
                    {fmtDate(c.created_at)}
                  </span>
                  {c.deactivated_at && <Badge>{s.deactivated}</Badge>}
                </td>
                <td className={td}>{c.owners.join(", ") || "—"}</td>
                <td className={`${td} text-right tabular-nums`}>{fmtNumber(c.members)}</td>
                <td className={`${td} text-right tabular-nums`}>{fmtNumber(c.sites)}</td>
                <td className={`${td} text-right tabular-nums`}>{fmtNumber(c.installations)}</td>
                <td className={`${td} text-right tabular-nums ${c.overdue && !c.deactivated_at ? "font-bold text-k-danger" : ""}`}>
                  {fmtNumber(c.overdue)}
                </td>
                <td className={`${td} text-right tabular-nums`}>{fmtNumber(c.open_deficiencies)}</td>
                <td className={`${td} text-right tabular-nums`}>{fmtNumber(c.documents)}</td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      )}
      <Pager
        page={page}
        total={total}
        size={PAGE_SIZE}
        href={(p) => `/admin/companies?${new URLSearchParams({ ...(search ? { q: search } : {}), lk: String(p) })}`}
      />
    </>
  );
}

export default function AdminCompaniesPage({ searchParams }: { searchParams: Search }) {
  return (
    <>
      <AdminTitle title={ADMIN.companies.title} />
      <Suspense fallback={<LoadingBlock lines={5} />}>
        <Companies searchParams={searchParams} />
      </Suspense>
    </>
  );
}
