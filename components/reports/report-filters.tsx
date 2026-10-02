import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { InstallationOption } from "@/lib/data/log";
import type { SiteListItem } from "@/lib/data/sites";
import type { T } from "@/lib/i18n";
import { installationLabel } from "@/lib/labels";
import { DEFICIENCY_SEVERITIES, DEFICIENCY_STATUSES, DUE_FILTERS, type ReportFilters } from "@/lib/reports/filters";
import type { ReportKind } from "@/lib/reports/types";
import { LOG_ENTRY_TYPES } from "@/lib/validation/log";

const field = "grid gap-1 text-sm font-semibold";
const control = "min-h-11 w-full min-w-0 rounded-sm border border-k-grey/70 bg-k-surface px-2 text-base font-normal";

/** One filter form for every report; each report shows the fields it uses (GET, so links are shareable within the team). */
export function ReportFilterForm({
  kind,
  filters,
  action,
  sites,
  installations,
  t,
}: {
  kind: ReportKind;
  filters: ReportFilters;
  action: string;
  sites: SiteListItem[];
  installations: InstallationOption[];
  t: T;
}) {
  const r = t.reports.filters;
  const has = (k: ReportKind[]) => k.includes(kind);
  const dated = has(["log", "plan", "deficiencies", "documents"]);
  return (
    <form method="get" action={action} aria-label={r.title} className="mb-8 border border-k-line bg-k-surface p-4 sm:p-5">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] items-end gap-4">
        {kind !== "installation" && (
          <label className={field}>
            {r.site}
            <select name="objekt" defaultValue={filters.site ?? ""} className={control} required={kind === "site"}>
              {kind !== "site" ? <option value="">{r.allSites}</option> : <option value="" disabled>—</option>}
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {kind !== "site" && (
          <label className={field}>
            {r.installation}
            <select name="paigaldis" defaultValue={filters.installation ?? ""} className={control} required={kind === "installation"}>
              {kind !== "installation" ? <option value="">{r.allInstallations}</option> : <option value="" disabled>—</option>}
              {installations.map((i) => (
                <option key={i.id} value={i.id}>
                  {installationLabel(i)}
                </option>
              ))}
            </select>
          </label>
        )}
        {kind === "log" && (
          <label className={field}>
            {r.type}
            <select name="tyyp" defaultValue={filters.type ?? ""} className={control}>
              <option value="">{r.all}</option>
              {LOG_ENTRY_TYPES.map((v) => (
                <option key={v} value={v}>
                  {t.app.log.types[v]}
                </option>
              ))}
            </select>
          </label>
        )}
        {kind === "plan" && (
          <label className={field}>
            {r.due}
            <select name="tahtaeg" defaultValue={filters.due ?? ""} className={control}>
              <option value="">{r.all}</option>
              {DUE_FILTERS.map((v) => (
                <option key={v} value={v}>
                  {t.reports.dueStates[v]}
                </option>
              ))}
            </select>
          </label>
        )}
        {kind === "deficiencies" && (
          <>
            <label className={field}>
              {r.status}
              <select name="seis" defaultValue={filters.status ?? ""} className={control}>
                <option value="">{r.all}</option>
                {DEFICIENCY_STATUSES.map((v) => (
                  <option key={v} value={v}>
                    {t.app.deficiencies.statuses[v]}
                  </option>
                ))}
              </select>
            </label>
            <label className={field}>
              {r.severity}
              <select name="raskus" defaultValue={filters.severity ?? ""} className={control}>
                <option value="">{r.all}</option>
                {DEFICIENCY_SEVERITIES.map((v) => (
                  <option key={v} value={v}>
                    {t.app.deficiencies.severities[v]}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {kind === "documents" && (
          <label className={field}>
            {r.category}
            <select name="liik" defaultValue={filters.category ?? ""} className={control}>
              <option value="">{r.all}</option>
              {Object.entries(t.app.documents.categories).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}
        {dated && (
          <>
            <label className={field}>
              {r.from}
              <input type="date" name="alates" defaultValue={filters.from} className={control} />
            </label>
            <label className={field}>
              {r.to}
              <input type="date" name="kuni" defaultValue={filters.to} className={control} />
            </label>
          </>
        )}
        {has(["plan", "documents"]) && (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="arhiiv" value="1" defaultChecked={filters.archived} className="size-5" />
            {r.archived}
          </label>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Button type="submit">{r.apply}</Button>
        <Link href={action} className="inline-flex min-h-11 items-center text-sm font-semibold text-k-green underline underline-offset-4">
          {r.reset}
        </Link>
      </div>
    </form>
  );
}
