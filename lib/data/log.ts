import "server-only";
import { createClient } from "@/lib/supabase/server";
import { localInputToIso } from "@/lib/time";
import { isUuid } from "@/lib/validation/sites";
import { LOG_ENTRY_TYPES, type LogEntryType } from "@/lib/validation/log";

export const LOG_PAGE_SIZE = 50;

/** Current state of an entry (newest correction applied), as listed in the log. */
export type LogListItem = {
  id: string;
  siteId: string;
  installationId: string;
  occurredAt: string;
  entryType: LogEntryType;
  description: string;
  result: string | null;
  performedByName: string | null;
  recordedByName: string;
  isCorrected: boolean;
  correctedAt: string | null;
  correctedByName: string | null;
  scheduledActivityId: string | null;
  deficiencyId: string | null;
};

const LIST_COLUMNS =
  "id, site_id, electrical_installation_id, occurred_at, entry_type, description, result, performed_by_name, recorded_by_name, is_corrected, corrected_at, corrected_by_name, scheduled_activity_id, deficiency_id";

type ViewRow = {
  id: string | null;
  site_id: string | null;
  electrical_installation_id: string | null;
  occurred_at: string | null;
  entry_type: LogEntryType | null;
  description: string | null;
  result: string | null;
  performed_by_name: string | null;
  recorded_by_name: string | null;
  is_corrected: boolean | null;
  corrected_at: string | null;
  corrected_by_name: string | null;
  scheduled_activity_id: string | null;
  deficiency_id: string | null;
};

function toItem(row: ViewRow): LogListItem {
  return {
    id: row.id!,
    siteId: row.site_id!,
    installationId: row.electrical_installation_id!,
    occurredAt: row.occurred_at!,
    entryType: row.entry_type!,
    description: row.description!,
    result: row.result,
    performedByName: row.performed_by_name,
    recordedByName: row.recorded_by_name ?? "",
    isCorrected: row.is_corrected ?? false,
    correctedAt: row.corrected_at,
    correctedByName: row.corrected_by_name,
    scheduledActivityId: row.scheduled_activity_id,
    deficiencyId: row.deficiency_id,
  };
}

export type LogPage = { items: LogListItem[]; hasMore: boolean; page: number };

export async function listInstallationLog(
  organisationId: string,
  installationId: string,
  page = 1,
): Promise<LogPage> {
  const supabase = await createClient();
  const from = (page - 1) * LOG_PAGE_SIZE;
  const { data, error } = await supabase
    .from("log_entry_current")
    .select(LIST_COLUMNS)
    .eq("organisation_id", organisationId)
    .eq("electrical_installation_id", installationId)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + LOG_PAGE_SIZE); // one extra row tells whether there is more
  if (error) throw error;
  return {
    items: data.slice(0, LOG_PAGE_SIZE).map(toItem),
    hasMore: data.length > LOG_PAGE_SIZE,
    page,
  };
}

export type LogFilters = {
  siteId?: string;
  installationId?: string;
  type?: LogEntryType;
  from?: string; // YYYY-MM-DD, Tallinn
  to?: string; // YYYY-MM-DD, Tallinn, inclusive
};

/** Reads ?objekt, ?paigaldis, ?liik, ?alates, ?kuni; ignores anything malformed. */
export function parseLogFilters(params: Record<string, string | string[] | undefined>): LogFilters {
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const date = (value?: string) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);
  const type = one("liik");
  return {
    siteId: isUuid(one("objekt") ?? "") ? one("objekt") : undefined,
    installationId: isUuid(one("paigaldis") ?? "") ? one("paigaldis") : undefined,
    type: (LOG_ENTRY_TYPES as readonly string[]).includes(type ?? "") ? (type as LogEntryType) : undefined,
    from: date(one("alates")),
    to: date(one("kuni")),
  };
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function listOrganisationLog(
  organisationId: string,
  filters: LogFilters,
  page = 1,
): Promise<LogPage> {
  const supabase = await createClient();
  let query = supabase
    .from("log_entry_current")
    .select(LIST_COLUMNS)
    .eq("organisation_id", organisationId);
  if (filters.siteId) query = query.eq("site_id", filters.siteId);
  if (filters.installationId) query = query.eq("electrical_installation_id", filters.installationId);
  if (filters.type) query = query.eq("entry_type", filters.type);
  const fromIso = filters.from ? localInputToIso(`${filters.from}T00:00`) : null;
  const toIso = filters.to ? localInputToIso(`${nextDay(filters.to)}T00:00`) : null;
  if (fromIso) query = query.gte("occurred_at", fromIso);
  if (toIso) query = query.lt("occurred_at", toIso);

  const from = (page - 1) * LOG_PAGE_SIZE;
  const { data, error } = await query
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + LOG_PAGE_SIZE);
  if (error) throw error;
  return {
    items: data.slice(0, LOG_PAGE_SIZE).map(toItem),
    hasMore: data.length > LOG_PAGE_SIZE,
    page,
  };
}

/** One entry version as stored (original or correction). */
export type LogEntryVersion = {
  id: string;
  occurredAt: string;
  entryType: LogEntryType;
  description: string;
  result: string | null;
  performedByName: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  correctionReason: string | null;
};

export type LogEntryWithHistory = {
  id: string;
  siteId: string;
  installationId: string;
  scheduledActivityId: string | null;
  scheduledDueOn: string | null;
  deficiencyId: string | null;
  original: LogEntryVersion;
  /** Oldest first. The last one is the current state. */
  corrections: LogEntryVersion[];
  current: LogEntryVersion;
};

/** An original entry and all its corrections, scoped to organisation and installation. */
export async function getLogEntry(
  organisationId: string,
  installationId: string,
  entryId: string,
): Promise<LogEntryWithHistory | null> {
  if (!isUuid(entryId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("log_entries")
    .select(
      "id, site_id, electrical_installation_id, occurred_at, entry_type, description, result, performed_by_name, created_by, created_by_name, created_at, correction_of_id, correction_reason, scheduled_activity_id, scheduled_due_on, deficiency_id",
    )
    .eq("organisation_id", organisationId)
    .eq("electrical_installation_id", installationId)
    .or(`id.eq.${entryId},correction_of_id.eq.${entryId}`)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;

  const originalRow = data.find((row) => row.id === entryId && row.correction_of_id === null);
  if (!originalRow) return null;
  const version = (row: (typeof data)[number]): LogEntryVersion => ({
    id: row.id,
    occurredAt: row.occurred_at,
    entryType: row.entry_type,
    description: row.description,
    result: row.result,
    performedByName: row.performed_by_name,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    correctionReason: row.correction_reason,
  });
  const original = version(originalRow);
  const corrections = data.filter((row) => row.correction_of_id === entryId).map(version);
  return {
    id: originalRow.id,
    siteId: originalRow.site_id,
    installationId: originalRow.electrical_installation_id,
    scheduledActivityId: originalRow.scheduled_activity_id,
    scheduledDueOn: originalRow.scheduled_due_on,
    deficiencyId: originalRow.deficiency_id,
    original,
    corrections,
    current: corrections.at(-1) ?? original,
  };
}

export type InstallationOption = {
  id: string;
  name: string;
  identifier: string | null;
  siteId: string;
  siteName: string;
  archived: boolean;
};

/** All installations of the organisation with their site names — for filters and labels. */
export async function listInstallationOptions(organisationId: string): Promise<InstallationOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("electrical_installations")
    .select("id, name, identifier, site_id, archived_at, site:sites!inner(name)")
    .eq("organisation_id", organisationId)
    .order("name");
  if (error) throw error;
  return data
    .map((row) => ({
      id: row.id,
      name: row.name,
      identifier: row.identifier,
      siteId: row.site_id,
      siteName: row.site.name,
      archived: row.archived_at !== null,
    }))
    .sort((a, b) => a.siteName.localeCompare(b.siteName, "et") || a.name.localeCompare(b.name, "et"));
}
