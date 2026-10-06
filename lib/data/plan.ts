import "server-only";
import { cache } from "react";
import { isPlan, type Plan } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

/** The company's plan, limits and usage as its members may see them (no price, no notes). */
export type OrgPlan = {
  status: "trial" | "active" | "expired" | "deactivated";
  plan: Plan | null;
  planLabel: string | null;
  userLimit: number | null;
  installationLimit: number | null;
  seatsUsed: number;
  installationsActive: number;
  trialEndsAt: string | null;
  paidUntil: string | null;
  indefinite: boolean;
};

export const getOrgPlan = cache(async (orgId: string): Promise<OrgPlan> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("organisation_plan", { p_org: orgId });
  if (error) throw error;
  const raw = data as Record<string, unknown>;
  return {
    status: raw.status as OrgPlan["status"],
    plan: isPlan(raw.plan) ? raw.plan : null,
    planLabel: (raw.plan_label as string | null) ?? null,
    userLimit: (raw.user_limit as number | null) ?? null,
    installationLimit: (raw.installation_limit as number | null) ?? null,
    seatsUsed: Number(raw.seats_used ?? 0),
    installationsActive: Number(raw.installations_active ?? 0),
    trialEndsAt: (raw.trial_ends_at as string | null) ?? null,
    paidUntil: (raw.paid_until as string | null) ?? null,
    indefinite: Boolean(raw.indefinite),
  };
});

export const seatsFull = (p: OrgPlan) => p.userLimit !== null && p.seatsUsed >= p.userLimit;
export const installationsFull = (p: OrgPlan) => p.installationLimit !== null && p.installationsActive >= p.installationLimit;
