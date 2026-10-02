import Link from "next/link";
import { Suspense } from "react";
import { AdminTitle, Badge, Pager, SearchForm, TableFrame, td, th } from "@/components/admin/ui";
import { LoadingBlock } from "@/components/app/states";
import { daysFromToday, fmtDate, fmtNumber } from "@/lib/admin/format";
import { ADMIN } from "@/lib/admin/strings";
import { ACCESS_FILTERS, type AccessFilter, adminCompanies, adminCompanyAccessList, PAGE_SIZE } from "@/lib/data/admin";
import { cn } from "@/lib/utils";

type Search = Promise<{ q?: string; lk?: string; ligipaas?: string }>;

async function Companies({ searchParams }: { searchParams: Search }) {
  const { q, lk, ligipaas } = await searchParams;
  const search = q?.trim().slice(0, 100) || undefined;
  const filter = ACCESS_FILTERS.find((f) => f === ligipaas) as AccessFilter | undefined;
  const page = filter ? 0 : Math.max(0, Number.parseInt(lk ?? "0", 10) || 0);
  // With an access filter, the first 200 matching companies are shown on one page.
  const [{ total, rows: all }, access] = await Promise.all([
    adminCompanies(search, page, filter ? 200 : PAGE_SIZE),
    adminCompanyAccessList(filter),
  ]);
  const rows = filter ? all.filter((c) => c.id in access) : all;
  const s = ADMIN.companies;
  const a = ADMIN.access;
  const link = (f?: string) => `/admin/companies?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(f ? { ligipaas: f } : {}) })}`;
  return (
    <>
      <SearchForm action="/admin/companies" label={s.search} value={search} />
      <nav aria-label={a.title} className="mb-4 flex flex-wrap gap-2">
        {[undefined, ...ACCESS_FILTERS].map((f) => (
          <Link
            key={f ?? "all"}
            href={link(f)}
            aria-current={filter === f ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-sm border px-3 text-sm font-semibold",
              filter === f ? "border-k-green bg-k-green text-white" : "border-k-line hover:border-k-ink",
            )}
          >
            {a.filters[f ?? "all"]}
          </Link>
        ))}
      </nav>
      <p className="mb-3 text-sm text-k-muted">{s.total(filter ? rows.length : total)}</p>
      {rows.length === 0 ? (
        <p>{s.none}</p>
      ) : (
        <TableFrame label={s.title}>
          <thead>
            <tr>
              <th className={th}>{s.name}</th>
              <th className={th}>{a.status}</th>
              <th className={th}>{a.endsColumn}</th>
              <th className={th}>{s.owners}</th>
              <th className={th}>{a.created}</th>
              <th className={`${th} text-right`}>{s.members}</th>
              <th className={`${th} text-right`}>{s.overdue}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const state = access[c.id];
              const days = state?.status === "expired" && state.expired_since ? daysFromToday(state.expired_since) : state?.ends_at ? daysFromToday(state.ends_at) : null;
              return (
                <tr key={c.id}>
                  <td className={td}>
                    <Link href={`/admin/companies/${c.id}`} className="font-semibold text-k-green underline underline-offset-4">
                      {c.name}
                    </Link>
                    {c.registry_code && <span className="block text-k-muted">{c.registry_code}</span>}
                  </td>
                  <td className={td}>
                    {state && (
                      <Badge tone={state.status === "expired" ? "warn" : state.status === "deactivated" ? "neutral" : "ok"}>
                        {a.statuses[state.status]}
                      </Badge>
                    )}
                  </td>
                  <td className={td}>
                    {state?.status === "active" && !state.ends_at ? (
                      a.indefinite
                    ) : (
                      <>
                        <span className="block whitespace-nowrap">{fmtDate(state?.status === "expired" ? state.expired_since : (state?.ends_at ?? null))}</span>
                        {days !== null && state?.status !== "deactivated" && (
                          <span className={cn("text-sm", state?.status === "expired" ? "text-k-warn" : "text-k-muted")}>
                            {days < 0 || state?.status === "expired" ? a.ago(Math.abs(days)) : a.remaining(days)}
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td className={td}>{c.owners.join(", ") || "—"}</td>
                  <td className={`${td} whitespace-nowrap`}>{fmtDate(c.created_at)}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtNumber(c.members)}</td>
                  <td className={`${td} text-right tabular-nums ${c.overdue && !c.deactivated_at ? "font-bold text-k-danger" : ""}`}>
                    {fmtNumber(c.overdue)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableFrame>
      )}
      {!filter && (
        <Pager
          page={page}
          total={total}
          size={PAGE_SIZE}
          href={(p) => `/admin/companies?${new URLSearchParams({ ...(search ? { q: search } : {}), lk: String(p) })}`}
        />
      )}
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
