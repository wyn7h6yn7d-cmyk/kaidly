import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FIXED_PLANS, PLAN_DETAILS, POPULAR_PLAN, TRIAL_DAYS } from "../../lib/plans.ts";
import { en } from "../../lib/i18n/en.ts";
import { et } from "../../lib/i18n/et.ts";
import { ru } from "../../lib/i18n/ru.ts";

// The public prices and the database catalogue (what is enforced) must never drift apart.
test("plan display values equal the database catalogue", () => {
  const migration = readFileSync(new URL("../../supabase/migrations/20261007100000_subscription_plans.sql", import.meta.url), "utf8");
  const rows = Object.fromEntries(
    [...migration.matchAll(/\('(start|team|pro|business)', (\d+), (\d+), (\d+), \d+\)/g)].map((m) => [m[1], m.slice(2, 5).map(Number)]),
  );
  assert.deepEqual(Object.keys(rows).sort(), [...FIXED_PLANS].sort());
  for (const plan of FIXED_PLANS) {
    const d = PLAN_DETAILS[plan];
    assert.deepEqual(rows[plan], [d.monthlyPrice, d.users, d.installations], plan);
  }
});

test("launch plans: Start 19/1/5, Team 29/3/10, Pro 39/5/25, Business 89/15/100; Pro is the popular one; 14-day trial", () => {
  assert.deepEqual(
    FIXED_PLANS.map((p) => [PLAN_DETAILS[p].name, PLAN_DETAILS[p].monthlyPrice, PLAN_DETAILS[p].users, PLAN_DETAILS[p].installations]),
    [["Start", 19, 1, 5], ["Team", 29, 3, 10], ["Pro", 39, 5, 25], ["Business", 89, 15, 100]],
  );
  assert.equal(POPULAR_PLAN, "pro");
  assert.equal(TRIAL_DAYS, 14);
  const migration = readFileSync(new URL("../../supabase/migrations/20261002170000_organisation_access.sql", import.meta.url), "utf8");
  assert.match(migration, /now\(\) \+ interval '14 days'/);
});

test("pricing copy: exact Estonian wording and natural plural forms", () => {
  const p = et.landing.pricing;
  assert.equal(et.landing.nav.howItWorks, "Kuidas töötab?");
  assert.equal(et.landing.nav.pricing, "Hinnad");
  assert.equal(p.title, "Lihtne hinnastus. Kõik vajalik on igas paketis.");
  assert.equal(p.trial, "14 päeva tasuta");
  assert.equal(p.noCard, "Krediitkaarti pole vaja");
  assert.equal(p.popular, "Kõige populaarsem");
  assert.equal(p.perMonth, "€ / kuu + KM");
  assert.deepEqual([1, 3, 5, 15].map(p.users), ["1 kasutaja", "3 kasutajat", "5 kasutajat", "15 kasutajat"]);
  assert.equal(p.installations(25), "25 aktiivset elektripaigaldist");
  assert.equal(p.customTitle, "Vajad rohkem?");
  assert.equal(p.customCta, "Võta ühendust");
  assert.deepEqual([1, 3, 5, 15].map(en.landing.pricing.users), ["1 user", "3 users", "5 users", "15 users"]);
  assert.deepEqual([1, 3, 5, 15].map(ru.landing.pricing.users), ["1 пользователь", "3 пользователя", "5 пользователей", "15 пользователей"]);
  assert.deepEqual([5, 10, 25, 100].map(ru.landing.pricing.installations), [
    "5 активных электроустановок", "10 активных электроустановок", "25 активных электроустановок", "100 активных электроустановок",
  ]);
});
