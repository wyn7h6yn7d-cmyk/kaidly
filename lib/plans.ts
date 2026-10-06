// KAIDLY launch plans (docs/SUBSCRIPTIONS.md). Display copy of the database catalogue
// (private.subscription_plans, migration subscription_plans) — the database is what
// enforces; tests/unit/plans.test.ts keeps the two identical. Prices: EUR per month, VAT excluded.

export const FIXED_PLANS = ["start", "team", "pro", "business"] as const;
export type FixedPlan = (typeof FIXED_PLANS)[number];
export type Plan = FixedPlan | "custom";

export const PLAN_DETAILS: Record<FixedPlan, { name: string; monthlyPrice: number; users: number; installations: number }> = {
  start: { name: "Start", monthlyPrice: 19, users: 1, installations: 5 },
  team: { name: "Team", monthlyPrice: 29, users: 3, installations: 10 },
  pro: { name: "Pro", monthlyPrice: 39, users: 5, installations: 25 },
  business: { name: "Business", monthlyPrice: 89, users: 15, installations: 100 },
};

/** The plan highlighted on the public pricing section. */
export const POPULAR_PLAN: FixedPlan = "pro";

/** Length of the free trial for every new company (private.organisation_access_on_create). */
export const TRIAL_DAYS = 14;

export const isPlan = (value: unknown): value is Plan =>
  value === "custom" || (FIXED_PLANS as readonly unknown[]).includes(value);
