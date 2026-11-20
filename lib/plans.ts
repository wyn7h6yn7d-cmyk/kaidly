// KAIDLY plans (docs/SUBSCRIPTIONS.md) — the ONE configuration of prices and limits used by
// the public pricing table and the app. The database enforces the limits from its own copy
// (private.subscription_plans, latest: migration 20261120100000_pricing_2026_11); the test
// tests/unit/plans.test.ts fails if the two ever differ. Prices: EUR, VAT excluded.

export const FIXED_PLANS = ["start", "team", "pro", "business"] as const;
export type FixedPlan = (typeof FIXED_PLANS)[number];
export type Plan = FixedPlan | "custom";

export type PlanDetails = {
  name: string;
  monthlyPrice: number;
  /** Paid once a year, invoiced (no online payments). 10 × monthly = "2 kuud tasuta". */
  annualPrice: number;
  users: number;
  installations: number;
};

export const PLAN_DETAILS: Record<FixedPlan, PlanDetails> = {
  start: { name: "Start", monthlyPrice: 19, annualPrice: 190, users: 1, installations: 10 },
  team: { name: "Team", monthlyPrice: 49, annualPrice: 490, users: 3, installations: 40 },
  pro: { name: "Pro", monthlyPrice: 99, annualPrice: 990, users: 8, installations: 120 },
  business: { name: "Business", monthlyPrice: 199, annualPrice: 1990, users: 20, installations: 300 },
};

/**
 * "Ettevõte" (name in the dictionaries): price by agreement, more than the largest fixed
 * plan. In the app it is a `custom` plan whose price and limits a platform admin enters.
 */
export const ENTERPRISE_PLAN = { installationsFrom: 300 } as const;

/** The plan marked "Soovitatud" on the public pricing table (never "most popular"). */
export const RECOMMENDED_PLAN: FixedPlan = "pro";

/** Free trial for every new company (private.organisation_access_on_create). */
export const TRIAL = { days: 14, users: 1, installations: 10 } as const;
export const TRIAL_DAYS = TRIAL.days;

/** Founder offer banner above the pricing table. Set to false to hide it. */
export const FOUNDER_OFFER_ENABLED = true;

export const isPlan = (value: unknown): value is Plan =>
  value === "custom" || (FIXED_PLANS as readonly unknown[]).includes(value);
