import { isUuid } from "../validation/sites.ts"; // explicit extensions: also loaded by node --test
import { LOG_ENTRY_TYPES } from "../validation/log.ts";

export const DEFICIENCY_STATUSES = ["open", "in_progress", "resolved"] as const;
export const DEFICIENCY_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const DUE_FILTERS = ["overdue", "soon", "upcoming"] as const;

/** One shared filter model for every report (unused fields are ignored). */
export type ReportFilters = {
  site?: string;
  installation?: string;
  from?: string;
  to?: string;
  type?: (typeof LOG_ENTRY_TYPES)[number];
  status?: (typeof DEFICIENCY_STATUSES)[number];
  severity?: (typeof DEFICIENCY_SEVERITIES)[number];
  due?: (typeof DUE_FILTERS)[number];
  category?: string;
  archived?: boolean;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const pick = <T extends string>(value: string | undefined, allowed: readonly T[]) =>
  allowed.includes(value as T) ? (value as T) : undefined;

/** Untrusted query parameters → validated filters (Estonian parameter names, like the rest of the app). */
export function parseFilters(sp: Record<string, string | string[] | undefined>): ReportFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : (sp[k] as string | undefined));
  const day = (k: string) => {
    const v = one(k);
    return v && DAY.test(v) ? v : undefined;
  };
  const id = (k: string) => {
    const v = one(k);
    return v && isUuid(v) ? v : undefined;
  };
  const category = one("liik");
  return {
    site: id("objekt"),
    installation: id("paigaldis"),
    from: day("alates"),
    to: day("kuni"),
    type: pick(one("tyyp"), LOG_ENTRY_TYPES),
    status: pick(one("seis"), DEFICIENCY_STATUSES),
    severity: pick(one("raskus"), DEFICIENCY_SEVERITIES),
    due: pick(one("tahtaeg"), DUE_FILTERS),
    category: category && /^[a-z_]{1,40}$/.test(category) ? category : undefined,
    archived: one("arhiiv") === "1",
  };
}

/** Filters → query string (for the export links). */
export function filtersQuery(f: ReportFilters): string {
  const p = new URLSearchParams();
  if (f.site) p.set("objekt", f.site);
  if (f.installation) p.set("paigaldis", f.installation);
  if (f.from) p.set("alates", f.from);
  if (f.to) p.set("kuni", f.to);
  if (f.type) p.set("tyyp", f.type);
  if (f.status) p.set("seis", f.status);
  if (f.severity) p.set("raskus", f.severity);
  if (f.due) p.set("tahtaeg", f.due);
  if (f.category) p.set("liik", f.category);
  if (f.archived) p.set("arhiiv", "1");
  return p.toString();
}
