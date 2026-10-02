import "server-only";
import { cookies } from "next/headers";
import { guideHiddenCookie, onboardingComplete, onboardingSteps } from "@/lib/onboarding";
import type { OrgContext } from "@/lib/data/organisations";
import { createClient } from "@/lib/supabase/server";

/** Real progress for the getting-started checklist: a handful of head counts, no stored state. */
export async function getOnboarding(ctx: OrgContext) {
  const supabase = await createClient();
  const org = ctx.org.id;
  const head = (table: "sites" | "electrical_installations" | "log_entries" | "scheduled_activities") =>
    supabase.from(table).select("id", { count: "exact", head: true }).eq("organisation_id", org);
  const [sites, installations, entries, activities, documents, firstSite, firstInstallation, store] = await Promise.all([
    head("sites"),
    head("electrical_installations"),
    head("log_entries"),
    head("scheduled_activities"),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("organisation_id", org).eq("status", "ready"),
    supabase.from("sites").select("id").eq("organisation_id", org).is("archived_at", null).order("created_at").limit(1).maybeSingle(),
    supabase
      .from("electrical_installations")
      .select("id")
      .eq("organisation_id", org)
      .is("archived_at", null)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
    cookies(),
  ]);
  for (const r of [sites, installations, entries, activities, documents]) if (r.error) throw r.error;
  const counts = {
    sites: sites.count ?? 0,
    installations: installations.count ?? 0,
    entries: entries.count ?? 0,
    activities: activities.count ?? 0,
    documents: documents.count ?? 0,
  };
  const steps = onboardingSteps(counts, {
    orgSlug: ctx.org.slug,
    role: ctx.memberRole,
    readOnly: ctx.access.writable ? null : ctx.access.hadFullAccess ? "access" : "trial",
    firstSiteId: firstSite.data?.id ?? null,
    firstInstallationId: firstInstallation.data?.id ?? null,
  });
  return {
    counts,
    steps,
    complete: onboardingComplete(steps),
    hidden: store.get(guideHiddenCookie(org))?.value === "1",
  };
}
