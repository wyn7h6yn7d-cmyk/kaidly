import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { T } from "@/lib/i18n";
import { LOG_ENTRY_TYPES } from "@/lib/validation/log";

/** Results per group (the RPC clamps at 25). */
export const SEARCH_PER_GROUP = 6;

// Global search: one call to search_kaidly(), a SECURITY INVOKER function, so the caller's
// own RLS decides every row (DATABASE.md §5e). The app only adds the localised entry-type
// matching ("kontroll" → inspection) and builds links from database ids.

type Base = { id: string; company: string; slug: string };
export type SearchResults = {
  companies: (Base & { name: string })[];
  sites: (Base & { name: string; address: string | null; archived: boolean })[];
  installations: (Base & { name: string; identifier: string | null; site: string; archived: boolean })[];
  log: (Base & {
    correction: boolean;
    entry_type: (typeof LOG_ENTRY_TYPES)[number];
    occurred_at: string;
    description: string;
    installation_id: string;
    installation: string;
    identifier: string | null;
    site: string;
  })[];
  activities: (Base & { title: string; next_due_on: string | null; archived: boolean; installation: string; identifier: string | null; site: string })[];
  deficiencies: (Base & {
    title: string;
    severity: "low" | "medium" | "high" | "critical";
    status: "open" | "in_progress" | "resolved";
    detected_at: string;
    installation: string;
    identifier: string | null;
    site: string;
  })[];
  documents: (Base & {
    title: string;
    original_filename: string;
    category: string;
    archived: boolean;
    site: string | null;
    installation: string | null;
    identifier: string | null;
  })[];
};

export const SEARCH_GROUPS = ["companies", "sites", "installations", "log", "activities", "deficiencies", "documents"] as const;

export async function searchKaidly(query: string, t: T): Promise<SearchResults> {
  const q = query.trim().toLocaleLowerCase(t.locale);
  // Entry types whose label (in the user's language) contains the query.
  const types = q.length >= 2 ? LOG_ENTRY_TYPES.filter((type) => t.app.log.types[type].toLocaleLowerCase(t.locale).includes(q)) : [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_kaidly", { p_query: query, p_entry_types: types, p_per_group: SEARCH_PER_GROUP });
  if (error) throw error;
  return data as unknown as SearchResults;
}
