import "server-only";
import { AREA_BY_TABLE, describeHistory, type HistoryArea, type HistoryEvent, TABLE_BY_AREA } from "@/lib/history";
import { createClient } from "@/lib/supabase/server";

export const HISTORY_PAGE_SIZE = 50;

export type HistoryItem = {
  id: number;
  at: string;
  actorId: string | null;
  table: string;
  recordId: string;
  event: HistoryEvent;
};

export function parseHistoryArea(value: unknown): HistoryArea | undefined {
  return typeof value === "string" && Object.values(AREA_BY_TABLE).includes(value as HistoryArea)
    ? (value as HistoryArea)
    : undefined;
}

/**
 * The organisation's change history, newest first. RLS limits it to owners and admins of
 * this organisation. Upload bookkeeping (pending/failed document rows) is filtered out in
 * the query; rows that only touched internal fields are dropped after describing.
 * People's names come from one profile lookup (co-members; former members show as unknown).
 */
export async function listHistory(organisationId: string, area: HistoryArea | undefined, page = 1) {
  const supabase = await createClient();
  let query = supabase
    .from("activity_history")
    .select("id, actor_id, table_name, record_id, action, old_data, new_data, created_at")
    .eq("organisation_id", organisationId)
    .or("table_name.neq.documents,action.eq.update");
  if (area) query = query.eq("table_name", TABLE_BY_AREA[area]);
  const from = (page - 1) * HISTORY_PAGE_SIZE;
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + HISTORY_PAGE_SIZE);
  if (error) throw error;

  const items: HistoryItem[] = [];
  for (const row of data.slice(0, HISTORY_PAGE_SIZE)) {
    const event = describeHistory({
      table: row.table_name,
      action: row.action as "insert" | "update" | "delete",
      old: (row.old_data as Record<string, unknown> | null) ?? null,
      new: (row.new_data as Record<string, unknown> | null) ?? null,
    });
    if (event) {
      items.push({ id: row.id, at: row.created_at, actorId: row.actor_id, table: row.table_name, recordId: row.record_id, event });
    }
  }

  const people = new Set<string>();
  for (const item of items) {
    if (item.actorId) people.add(item.actorId);
    if ("userId" in item.event && item.event.userId) people.add(item.event.userId);
  }
  const names = new Map<string, string>();
  if (people.size) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", [...people]);
    for (const p of profiles ?? []) names.set(p.id, p.full_name?.trim() || p.email || "");
  }

  return { items, names, hasMore: data.length > HISTORY_PAGE_SIZE, page };
}
