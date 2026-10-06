import Link from "next/link";
import { Suspense } from "react";
import { AdminTitle, Badge, Pager, SearchForm, TableFrame, td, th } from "@/components/admin/ui";
import { LoadingBlock } from "@/components/app/states";
import { fmtDate, fmtDayNumeric } from "@/lib/admin/format";
import { ADMIN } from "@/lib/admin/strings";
import { adminSubscriptions, PAGE_SIZE } from "@/lib/data/admin";
import { planName, statusTone } from "@/components/admin/subscription-labels";
import { cn } from "@/lib/utils";

type Search = Promise<{ q?: string; lk?: string; filter?: string }>;

const s = ADMIN.subs;
const FILTERS = Object.keys(s.filters).filter((f) => f !== "all");

async function Subscriptions({ searchParams }: { searchParams: Search }) {
  const { q, lk, filter: raw } = await searchParams;
  const search = q?.trim().slice(0, 100) || null;
  const filter = FILTERS.includes(raw ?? "") ? (raw as string) : null;
  const page = Math.max(0, Number.parseInt(lk ?? "0", 10) || 0);
  const { total, rows } = await adminSubscriptions(search, filter, PAGE_SIZE, page * PAGE_SIZE);
  const link = (f: string | null, p = 0) =>
    `/admin/tellimused?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(f ? { filter: f } : {}), ...(p ? { lk: String(p) } : {}) })}`;
  return (
    <>
      <SearchForm action="/admin/tellimused" label={s.search} value={search ?? undefined} />
      <nav aria-label={s.filter} className="mb-4 flex flex-wrap gap-2">
        {[null, ...FILTERS].map((f) => (
          <Link
            key={f ?? "all"}
            href={link(f)}
            aria-current={filter === f ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-sm border px-3 text-sm font-semibold",
              filter === f ? "border-k-green bg-k-green text-white" : "border-k-line hover:border-k-ink",
            )}
          >
            {s.filters[f ?? "all"]}
          </Link>
        ))}
      </nav>
      <p className="mb-3 text-sm text-k-muted">{s.count(total)}</p>
      {rows.length === 0 ? (
        <p>{s.empty}</p>
      ) : (
        <TableFrame label={s.title}>
          <thead>
            <tr>
              <th className={th}>{s.company}</th>
              <th className={th}>{s.plan}</th>
              <th className={th}>{s.status}</th>
              <th className={th}>{s.trialEnd}</th>
              <th className={th}>{s.paidUntil}</th>
              <th className={`${th} text-right`}>{s.users}</th>
              <th className={`${th} text-right`}>{s.installations}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className={td}>
                  <Link href={`/admin/tellimused/${row.id}`} className="font-semibold text-k-green underline underline-offset-4">
                    {row.name}
                  </Link>
                </td>
                <td className={td}>{planName(row)}</td>
                <td className={td}>
                  <Badge tone={statusTone(row.status)}>{ADMIN.access.statuses[row.status]}</Badge>
                </td>
                <td className={td}>{fmtDate(row.trial_ends_at)}</td>
                <td className={td}>{row.indefinite ? s.indefinite : fmtDayNumeric(row.paid_until)}</td>
                <td className={`${td} text-right tabular-nums`}>{s.usage(row.seats_used, row.user_limit)}</td>
                <td className={`${td} text-right tabular-nums`}>{s.usage(row.installations_active, row.installation_limit)}</td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      )}
      <Pager page={page} total={total} size={PAGE_SIZE} href={(p) => link(filter, p)} />
    </>
  );
}

export default function AdminSubscriptionsPage({ searchParams }: { searchParams: Search }) {
  return (
    <>
      <AdminTitle title={s.title} intro={s.intro} />
      <Suspense fallback={<LoadingBlock lines={6} />}>
        <Subscriptions searchParams={searchParams} />
      </Suspense>
    </>
  );
}
