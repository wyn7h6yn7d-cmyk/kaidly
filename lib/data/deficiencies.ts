import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayInTallinn } from "@/lib/time";
import {
  DEFICIENCY_STATUSES,
  SEVERITIES,
  type DeficiencyStatus,
  type Severity,
} from "@/lib/validation/deficiencies";
import { isUuid } from "@/lib/validation/sites";

export type Deficiency = {
  id: string;
  siteId: string;
  installationId: string;
  title: string;
  description: string;
  severity: Severity;
  detectedAt: string;
  responsiblePersonName: string | null;
  dueOn: string | null;
  status: DeficiencyStatus;
  resolution: string | null;
  resolvedAt: string | null;
  resolvedByName: string | null;
  createdByName: string;
};

const COLUMNS =
  "id, site_id, electrical_installation_id, title, description, severity, detected_at, responsible_person_name, due_on, status, resolution, resolved_at, resolved_by_name, created_by_name";

type Row = {
  id: string;
  site_id: string;
  electrical_installation_id: string;
  title: string;
  description: string;
  severity: Severity;
  detected_at: string;
  responsible_person_name: string | null;
  due_on: string | null;
  status: DeficiencyStatus;
  resolution: string | null;
  resolved_at: string | null;
  resolved_by_name: string | null;
  created_by_name: string;
};

function toDeficiency(row: Row): Deficiency {
  return {
    id: row.id,
    siteId: row.site_id,
    installationId: row.electrical_installation_id,
    title: row.title,
    description: row.description,
    severity: row.severity,
    detectedAt: row.detected_at,
    responsiblePersonName: row.responsible_person_name,
    dueOn: row.due_on,
    status: row.status,
    resolution: row.resolution,
    resolvedAt: row.resolved_at,
    resolvedByName: row.resolved_by_name,
    createdByName: row.created_by_name,
  };
}

export function isOverdue(d: Pick<Deficiency, "dueOn" | "status">, today: string): boolean {
  return d.status !== "resolved" && d.dueOn !== null && d.dueOn < today;
}

export type DeficiencyFilters = {
  siteId?: string;
  installationId?: string;
  /** undefined = active (open + in progress) */
  status?: DeficiencyStatus;
  severity?: Severity;
  overdue?: boolean;
};

/** Reads ?objekt, ?paigaldis, ?seis, ?raskus, ?tahtaeg; ignores anything malformed. */
export function parseDeficiencyFilters(
  params: Record<string, string | string[] | undefined>,
): DeficiencyFilters {
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  return {
    siteId: isUuid(one("objekt") ?? "") ? one("objekt") : undefined,
    installationId: isUuid(one("paigaldis") ?? "") ? one("paigaldis") : undefined,
    status: DEFICIENCY_STATUSES.find((s) => s === one("seis")),
    severity: SEVERITIES.find((s) => s === one("raskus")),
    overdue: one("tahtaeg") === "uletatud",
  };
}

export const DEFICIENCIES_PAGE_SIZE = 50;

/** Most severe first, then earliest due date; paginated (resolved ones accumulate). */
export async function listDeficiencies(
  organisationId: string,
  filters: DeficiencyFilters = {},
  page = 1,
): Promise<{ items: Deficiency[]; hasMore: boolean; page: number }> {
  const supabase = await createClient();
  let query = supabase.from("deficiencies").select(COLUMNS).eq("organisation_id", organisationId);
  if (filters.siteId) query = query.eq("site_id", filters.siteId);
  if (filters.installationId) query = query.eq("electrical_installation_id", filters.installationId);
  if (filters.severity) query = query.eq("severity", filters.severity);
  query = filters.status ? query.eq("status", filters.status) : query.neq("status", "resolved");
  if (filters.overdue) query = query.lt("due_on", todayInTallinn()).neq("status", "resolved");
  const { data, error } = await query
    .order("severity", { ascending: false })
    .order("due_on", { ascending: true, nullsFirst: false })
    .order("detected_at", { ascending: false })
    .order("id")
    .range((page - 1) * DEFICIENCIES_PAGE_SIZE, page * DEFICIENCIES_PAGE_SIZE); // one extra row → hasMore
  if (error) throw error;
  return {
    items: data.slice(0, DEFICIENCIES_PAGE_SIZE).map(toDeficiency),
    hasMore: data.length > DEFICIENCIES_PAGE_SIZE,
    page,
  };
}

export const INSTALLATION_RESOLVED_SHOWN = 50;

/**
 * Deficiencies of one installation: all active ones (most severe first) and the latest
 * resolved ones with their total — resolved ones accumulate, the full list is paginated
 * on the organisation page.
 */
export async function listInstallationDeficiencies(organisationId: string, installationId: string) {
  const supabase = await createClient();
  const [active, resolved] = await Promise.all([
    supabase
      .from("deficiencies")
      .select(COLUMNS)
      .eq("organisation_id", organisationId)
      .eq("electrical_installation_id", installationId)
      .neq("status", "resolved")
      .order("severity", { ascending: false })
      .order("detected_at", { ascending: false })
      .order("id"),
    supabase
      .from("deficiencies")
      .select(COLUMNS, { count: "exact" })
      .eq("organisation_id", organisationId)
      .eq("electrical_installation_id", installationId)
      .eq("status", "resolved")
      .order("resolved_at", { ascending: false })
      .order("id")
      .limit(INSTALLATION_RESOLVED_SHOWN),
  ]);
  if (active.error) throw active.error;
  if (resolved.error) throw resolved.error;
  return {
    active: active.data.map(toDeficiency),
    resolved: resolved.data.map(toDeficiency),
    resolvedTotal: resolved.count ?? resolved.data.length,
  };
}

export async function getDeficiency(organisationId: string, deficiencyId: string): Promise<Deficiency | null> {
  if (!isUuid(deficiencyId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deficiencies")
    .select(COLUMNS)
    .eq("organisation_id", organisationId)
    .eq("id", deficiencyId)
    .maybeSingle();
  if (error) throw error;
  return data ? toDeficiency(data) : null;
}

/** The operating-log entry written when the deficiency was resolved. */
export async function getResolutionEntryId(organisationId: string, deficiencyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("log_entries")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("deficiency_id", deficiencyId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}
