import "server-only";
import { createClient } from "@/lib/supabase/server";
import { dueStateRange, type DueState } from "@/lib/schedule";
import { todayInTallinn } from "@/lib/time";
import { isUuid } from "@/lib/validation/sites";
import { PRIORITIES, type Frequency, type IntervalUnit, type Priority } from "@/lib/validation/schedule";

export type Activity = {
  id: string;
  siteId: string;
  installationId: string;
  title: string;
  description: string | null;
  frequencyType: Frequency;
  intervalValue: number | null;
  intervalUnit: IntervalUnit | null;
  anchorOn: string;
  nextDueOn: string | null;
  responsiblePersonName: string | null;
  priority: Priority;
  archivedAt: string | null;
  lastCompletedAt: string | null;
};

const COLUMNS =
  "id, site_id, electrical_installation_id, title, description, frequency_type, interval_value, interval_unit, anchor_on, next_due_on, responsible_person_name, priority, archived_at";

type Row = {
  id: string;
  site_id: string;
  electrical_installation_id: string;
  title: string;
  description: string | null;
  frequency_type: Frequency;
  interval_value: number | null;
  interval_unit: IntervalUnit | null;
  anchor_on: string;
  next_due_on: string | null;
  responsible_person_name: string | null;
  priority: Priority;
  archived_at: string | null;
};

function toActivity(row: Row, lastCompletedAt: string | null): Activity {
  return {
    id: row.id,
    siteId: row.site_id,
    installationId: row.electrical_installation_id,
    title: row.title,
    description: row.description,
    frequencyType: row.frequency_type,
    intervalValue: row.interval_value,
    intervalUnit: row.interval_unit,
    anchorOn: row.anchor_on,
    nextDueOn: row.next_due_on,
    responsiblePersonName: row.responsible_person_name,
    priority: row.priority,
    archivedAt: row.archived_at,
    lastCompletedAt,
  };
}

/** Latest completion time per activity, in one query. */
async function lastCompletions(organisationId: string, activityIds: string[]) {
  const latest = new Map<string, string>();
  if (activityIds.length === 0) return latest;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("log_entry_current")
    .select("scheduled_activity_id, occurred_at")
    .eq("organisation_id", organisationId)
    .in("scheduled_activity_id", activityIds)
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  for (const row of data) {
    if (row.scheduled_activity_id && row.occurred_at && !latest.has(row.scheduled_activity_id)) {
      latest.set(row.scheduled_activity_id, row.occurred_at);
    }
  }
  return latest;
}

export type ActivityFilters = {
  siteId?: string;
  installationId?: string;
  state?: DueState;
  priority?: Priority;
  archived?: boolean;
};

const STATES: readonly DueState[] = ["overdue", "soon", "upcoming", "done"];

/** Reads ?objekt, ?paigaldis, ?seis, ?prioriteet, ?arhiiv; ignores anything malformed. */
export function parseActivityFilters(
  params: Record<string, string | string[] | undefined>,
): ActivityFilters {
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const state = one("seis");
  const priority = one("prioriteet");
  return {
    siteId: isUuid(one("objekt") ?? "") ? one("objekt") : undefined,
    installationId: isUuid(one("paigaldis") ?? "") ? one("paigaldis") : undefined,
    state: STATES.find((s) => s === state),
    priority: PRIORITIES.find((p) => p === priority),
    archived: params.arhiiv !== undefined,
  };
}

export const ACTIVITIES_PAGE_SIZE = 50;

/** Activities ordered by next due date (done last); paginated (done one-time ones accumulate). */
export async function listActivities(
  organisationId: string,
  filters: ActivityFilters = {},
  page = 1,
): Promise<{ items: Activity[]; hasMore: boolean; page: number }> {
  const supabase = await createClient();
  let query = supabase.from("scheduled_activities").select(COLUMNS).eq("organisation_id", organisationId);
  query = filters.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (filters.siteId) query = query.eq("site_id", filters.siteId);
  if (filters.installationId) query = query.eq("electrical_installation_id", filters.installationId);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.state) {
    const range = dueStateRange(filters.state, todayInTallinn());
    if ("done" in range) query = query.is("next_due_on", null);
    if ("before" in range) query = query.lt("next_due_on", range.before);
    if ("from" in range) query = query.gte("next_due_on", range.from).lte("next_due_on", range.to);
    if ("after" in range) query = query.gt("next_due_on", range.after);
  }
  const { data, error } = await query
    .order("next_due_on", { ascending: true, nullsFirst: false })
    .order("title")
    .order("id")
    .range((page - 1) * ACTIVITIES_PAGE_SIZE, page * ACTIVITIES_PAGE_SIZE); // one extra row → hasMore
  if (error) throw error;
  const rows = data.slice(0, ACTIVITIES_PAGE_SIZE);
  const latest = await lastCompletions(
    organisationId,
    rows.map((row) => row.id),
  );
  return {
    items: rows.map((row) => toActivity(row, latest.get(row.id) ?? null)),
    hasMore: data.length > ACTIVITIES_PAGE_SIZE,
    page,
  };
}

export async function getActivity(organisationId: string, activityId: string): Promise<Activity | null> {
  if (!isUuid(activityId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scheduled_activities")
    .select(COLUMNS)
    .eq("organisation_id", organisationId)
    .eq("id", activityId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const latest = await lastCompletions(organisationId, [data.id]);
  return toActivity(data, latest.get(data.id) ?? null);
}

export type Completion = {
  entryId: string;
  dueOn: string;
  occurredAt: string;
  description: string;
  result: string | null;
  recordedByName: string;
  isCorrected: boolean;
};

/** Completed occurrences of an activity (its operating-log entries), newest first. */
export async function listCompletions(organisationId: string, activityId: string): Promise<Completion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("log_entry_current")
    .select("id, scheduled_due_on, occurred_at, description, result, recorded_by_name, is_corrected")
    .eq("organisation_id", organisationId)
    .eq("scheduled_activity_id", activityId)
    .order("scheduled_due_on", { ascending: false });
  if (error) throw error;
  return data.map((row) => ({
    entryId: row.id!,
    dueOn: row.scheduled_due_on!,
    occurredAt: row.occurred_at!,
    description: row.description!,
    result: row.result,
    recordedByName: row.recorded_by_name ?? "",
    isCorrected: row.is_corrected ?? false,
  }));
}
