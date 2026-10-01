import "server-only";
import { addDays, DUE_SOON_DAYS } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { todayInTallinn } from "@/lib/time";
import type { LogEntryType } from "@/lib/validation/log";
import type { Priority } from "@/lib/validation/schedule";
import type { DeficiencyStatus, Severity } from "@/lib/validation/deficiencies";

// "What needs my attention?" Each section is one bounded query that returns the first few
// rows plus the exact total; all queries go through RLS and are scoped to the
// organisation. No N+1: labels come from one installation lookup on the page.

export const DASHBOARD_ROWS = 5;

export type AttentionActivity = {
  id: string;
  installationId: string;
  title: string;
  nextDueOn: string;
  priority: Priority;
};

export type AttentionDeficiency = {
  id: string;
  installationId: string;
  title: string;
  severity: Severity;
  status: DeficiencyStatus;
  dueOn: string | null;
};

export type RecentEntry = {
  id: string;
  installationId: string;
  occurredAt: string;
  entryType: LogEntryType;
  description: string;
  recordedByName: string;
};

export type SiteAttention = {
  siteId: string;
  name: string;
  overdueActivities: number;
  dueSoonActivities: number;
  openDeficiencies: number;
  seriousDeficiencies: number;
};

export type Section<T> = { items: T[]; total: number };

export type Dashboard = {
  today: string;
  overdue: Section<AttentionActivity>;
  dueSoon: Section<AttentionActivity>;
  serious: Section<AttentionDeficiency>;
  recent: RecentEntry[];
  sites: SiteAttention[];
  hasAnyEntry: boolean;
};

const ACTIVITY_COLUMNS = "id, electrical_installation_id, title, next_due_on, priority";

export async function getDashboard(organisationId: string): Promise<Dashboard> {
  const supabase = await createClient();
  const today = todayInTallinn();

  const activities = () =>
    supabase
      .from("scheduled_activities")
      .select(ACTIVITY_COLUMNS, { count: "exact" })
      .eq("organisation_id", organisationId)
      .is("archived_at", null);

  const [overdue, dueSoon, serious, recent, sites] = await Promise.all([
    activities()
      .lt("next_due_on", today)
      .order("next_due_on", { ascending: true })
      .order("id")
      .limit(DASHBOARD_ROWS),
    activities()
      .gte("next_due_on", today)
      .lte("next_due_on", addDays(today, DUE_SOON_DAYS))
      .order("next_due_on", { ascending: true })
      .order("id")
      .limit(DASHBOARD_ROWS),
    supabase
      .from("deficiencies")
      .select("id, electrical_installation_id, title, severity, status, due_on", { count: "exact" })
      .eq("organisation_id", organisationId)
      .neq("status", "resolved")
      .in("severity", ["high", "critical"])
      .order("severity", { ascending: false })
      .order("due_on", { ascending: true, nullsFirst: false })
      .order("id")
      .limit(DASHBOARD_ROWS),
    supabase
      .from("log_entry_current")
      .select("id, electrical_installation_id, occurred_at, entry_type, description, recorded_by_name")
      .eq("organisation_id", organisationId)
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(DASHBOARD_ROWS),
    supabase
      .from("site_attention")
      .select("site_id, name, overdue_activities, due_soon_activities, open_deficiencies, serious_deficiencies")
      .eq("organisation_id", organisationId)
      .or("overdue_activities.gt.0,open_deficiencies.gt.0,due_soon_activities.gt.0")
      .order("serious_deficiencies", { ascending: false })
      .order("overdue_activities", { ascending: false })
      .order("open_deficiencies", { ascending: false })
      .order("name")
      .limit(20),
  ]);
  for (const result of [overdue, dueSoon, serious, recent, sites]) {
    if (result.error) throw result.error;
  }

  const activity = (row: {
    id: string;
    electrical_installation_id: string;
    title: string;
    next_due_on: string | null;
    priority: Priority;
  }): AttentionActivity => ({
    id: row.id,
    installationId: row.electrical_installation_id,
    title: row.title,
    nextDueOn: row.next_due_on ?? today,
    priority: row.priority,
  });

  return {
    today,
    overdue: { items: (overdue.data ?? []).map(activity), total: overdue.count ?? 0 },
    dueSoon: { items: (dueSoon.data ?? []).map(activity), total: dueSoon.count ?? 0 },
    serious: {
      items: (serious.data ?? []).map((row) => ({
        id: row.id,
        installationId: row.electrical_installation_id,
        title: row.title,
        severity: row.severity,
        status: row.status,
        dueOn: row.due_on,
      })),
      total: serious.count ?? 0,
    },
    recent: (recent.data ?? []).map((row) => ({
      id: row.id!,
      installationId: row.electrical_installation_id!,
      occurredAt: row.occurred_at!,
      entryType: row.entry_type!,
      description: row.description!,
      recordedByName: row.recorded_by_name ?? "",
    })),
    sites: (sites.data ?? []).map((row) => ({
      siteId: row.site_id!,
      name: row.name!,
      overdueActivities: row.overdue_activities ?? 0,
      dueSoonActivities: row.due_soon_activities ?? 0,
      openDeficiencies: row.open_deficiencies ?? 0,
      seriousDeficiencies: row.serious_deficiencies ?? 0,
    })),
    hasAnyEntry: (recent.data ?? []).length > 0,
  };
}

/** Installations the user recently wrote entries for, newest first (for quick entry). */
export async function listRecentInstallationIds(organisationId: string, userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("log_entries")
    .select("electrical_installation_id")
    .eq("organisation_id", organisationId)
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return [...new Set(data.map((row) => row.electrical_installation_id))].slice(0, 5);
}

/** Small per-installation summary for the installation overview. */
export async function getInstallationSummary(organisationId: string, installationId: string) {
  const supabase = await createClient();
  const today = todayInTallinn();
  const [overdue, open, last] = await Promise.all([
    supabase
      .from("scheduled_activities")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId)
      .eq("electrical_installation_id", installationId)
      .is("archived_at", null)
      .lt("next_due_on", today),
    supabase
      .from("deficiencies")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId)
      .eq("electrical_installation_id", installationId)
      .neq("status", "resolved"),
    supabase
      .from("log_entry_current")
      .select("id, occurred_at, entry_type, description")
      .eq("organisation_id", organisationId)
      .eq("electrical_installation_id", installationId)
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (overdue.error) throw overdue.error;
  if (open.error) throw open.error;
  if (last.error) throw last.error;
  return {
    overdueActivities: overdue.count ?? 0,
    openDeficiencies: open.count ?? 0,
    lastEntry: last.data
      ? {
          id: last.data.id!,
          occurredAt: last.data.occurred_at!,
          entryType: last.data.entry_type!,
          description: last.data.description!,
        }
      : null,
  };
}
