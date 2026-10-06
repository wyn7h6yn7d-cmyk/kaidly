import { ADMIN } from "@/lib/admin/strings";

const PLAN_NAMES: Record<string, string> = { start: "Start", team: "Team", pro: "Pro", business: "Business" };

/** "Pro", "Raamleping 2027 (Custom)" or "Paketita". */
export const planName = (row: { plan: string | null; plan_label: string | null }) =>
  row.plan === "custom" ? `${row.plan_label} (Custom)` : row.plan ? PLAN_NAMES[row.plan] : ADMIN.subs.noPlan;

export const statusTone = (status: string | null) =>
  status === "expired" ? "warn" : status === "active" ? "ok" : "neutral";
