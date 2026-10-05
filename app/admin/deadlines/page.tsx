import Link from "next/link";
import { Suspense } from "react";
import { AdminTitle, Badge, TableFrame, td, th } from "@/components/admin/ui";
import { LoadingBlock } from "@/components/app/states";
import { fmtDay, fmtDays } from "@/lib/admin/format";
import { ADMIN } from "@/lib/admin/strings";
import { adminCompanyOptions, adminDeadlines, type AdminDeadlineFilters } from "@/lib/data/admin";
import { uuid } from "@/lib/validation/common";

type Search = Promise<Record<string, string | undefined>>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const pick = <T extends string>(value: string | undefined, allowed: readonly T[]) =>
  allowed.includes(value as T) ? (value as T) : undefined;

function parseFilters(sp: Record<string, string | undefined>): AdminDeadlineFilters {
  return {
    company: uuid.safeParse(sp.ettevote).success ? sp.ettevote : undefined,
    site: uuid.safeParse(sp.objekt).success ? sp.objekt : undefined,
    kind: pick(sp.liik, ["activity", "deficiency"] as const),
    severity: pick(sp.raskus, ["high", "critical"] as const),
    state: pick(sp.seis, ["overdue", "soon"] as const),
    from: sp.alates && DAY.test(sp.alates) ? sp.alates : undefined,
    to: sp.kuni && DAY.test(sp.kuni) ? sp.kuni : undefined,
    includeDeactivated: sp.deaktiveeritud === "1",
  };
}

const select = "min-h-11 w-full rounded-sm border border-k-line bg-k-surface px-2 text-base";

async function Deadlines({ searchParams }: { searchParams: Search }) {
  const f = parseFilters(await searchParams);
  // At most the 500 most urgent rows come back (with the true total). Filters, the site
  // filter included, are applied in the database; the site list (shown once a company is
  // chosen) comes from that company's own deadlines.
  const [result, companyRows, companies] = await Promise.all([
    adminDeadlines(f),
    f.company && f.site ? adminDeadlines({ ...f, site: undefined }) : null,
    adminCompanyOptions(),
  ]);
  const rows = result.rows;
  const siteSource = companyRows?.rows ?? rows;
  const sites = f.company ? [...new Map(siteSource.map((r) => [r.site_id, r.site])).entries()] : [];
  const s = ADMIN.deadlines;
  return (
    <>
      <form method="get" action="/admin/deadlines" className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(min(100%,12rem),1fr))] items-end gap-3">
        <label className="grid gap-1 text-sm font-semibold">
          {s.company}
          <select name="ettevote" defaultValue={f.company ?? ""} className={select}>
            <option value="">{s.allCompanies}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.deactivated ? ` (${ADMIN.companies.deactivated.toLowerCase()})` : ""}
              </option>
            ))}
          </select>
        </label>
        {f.company && (
          <label className="grid gap-1 text-sm font-semibold">
            {s.site}
            <select name="objekt" defaultValue={f.site ?? ""} className={select}>
              <option value="">{s.allSites}</option>
              {sites.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="grid gap-1 text-sm font-semibold">
          {s.kind}
          <select name="liik" defaultValue={f.kind ?? ""} className={select}>
            <option value="">{s.allKinds}</option>
            <option value="activity">{s.activity}</option>
            <option value="deficiency">{s.deficiency}</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          {s.severity}
          <select name="raskus" defaultValue={f.severity ?? ""} className={select}>
            <option value="">{s.allSeverities}</option>
            <option value="high">{s.high}</option>
            <option value="critical">{s.critical}</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          {s.state}
          <select name="seis" defaultValue={f.state ?? ""} className={select}>
            <option value="">{s.allStates}</option>
            <option value="overdue">{s.overdue}</option>
            <option value="soon">{s.soon}</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          {s.from}
          <input type="date" name="alates" defaultValue={f.from} className={select} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          {s.to}
          <input type="date" name="kuni" defaultValue={f.to} className={select} />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="deaktiveeritud" value="1" defaultChecked={f.includeDeactivated} className="size-5" />
          {s.includeDeactivated}
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="min-h-11 rounded-sm bg-k-green px-4 font-semibold text-white hover:bg-k-green-hover">
            {s.apply}
          </button>
          <Link href="/admin/deadlines" className="inline-flex min-h-11 items-center text-sm font-semibold text-k-green underline">
            {s.reset}
          </Link>
        </div>
      </form>

      <p className="mb-3 text-sm text-k-muted">
        {result.total > rows.length ? s.capped(rows.length, result.total) : s.count(rows.length)}
      </p>
      {rows.length === 0 ? (
        <p>{s.none}</p>
      ) : (
        <TableFrame label={s.title}>
          <thead>
            <tr>
              <th className={th}>{s.due}</th>
              <th className={th}>{s.item}</th>
              <th className={th}>{s.company}</th>
              <th className={th}>{s.where}</th>
              <th className={th}>{s.responsible}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.kind}-${r.id}`}>
                <td className={td}>
                  <span className="block whitespace-nowrap font-semibold">{r.due_on ? fmtDay(r.due_on) : s.noDue}</span>
                  {r.days !== null && (
                    <span className={r.days < 0 ? "font-semibold text-k-danger" : r.days === 0 ? "font-semibold text-k-warn" : "text-k-warn"}>
                      {fmtDays(r.days)}
                    </span>
                  )}
                </td>
                <td className={td}>
                  <span className="block">{r.item}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    <Badge>{r.kind === "activity" ? s.activity : s.deficiency}</Badge>
                    {r.severity && <Badge tone={r.severity === "critical" ? "danger" : "warn"}>{s[r.severity]}</Badge>}
                  </span>
                </td>
                <td className={td}>
                  <Link href={`/admin/companies/${r.company_id}`} className="font-semibold text-k-green underline underline-offset-4">
                    {r.company}
                  </Link>
                  {r.company_deactivated && <Badge>{ADMIN.companies.deactivated}</Badge>}
                </td>
                <td className={td}>
                  {r.site} · {r.installation}
                  {r.identifier ? ` (${r.identifier})` : ""}
                </td>
                <td className={td}>{r.responsible || "—"}</td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      )}
    </>
  );
}

export default function AdminDeadlinesPage({ searchParams }: { searchParams: Search }) {
  return (
    <>
      <AdminTitle title={ADMIN.deadlines.title} intro={ADMIN.deadlines.intro} />
      <Suspense fallback={<LoadingBlock lines={5} />}>
        <Deadlines searchParams={searchParams} />
      </Suspense>
    </>
  );
}
