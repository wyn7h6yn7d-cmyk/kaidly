import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { ENTERPRISE_PLAN, FIXED_PLANS, FOUNDER_OFFER_ENABLED, PLAN_DETAILS, RECOMMENDED_PLAN, SITE_VIEWERS_COUNT_AS_USERS, TRIAL, TRIAL_DAYS } from "../../lib/plans.ts";
import { en } from "../../lib/i18n/en.ts";
import { et } from "../../lib/i18n/et.ts";
import { ru } from "../../lib/i18n/ru.ts";

// The public prices and the database catalogue (what is enforced) must never drift apart.
// The latest migration that sets the catalogue is the source of the database values.
const CATALOGUE_MIGRATION = "../../supabase/migrations/20261120100000_pricing_2026_11.sql";

test("plan display values equal the database catalogue", () => {
  const migration = readFileSync(new URL(CATALOGUE_MIGRATION, import.meta.url), "utf8");
  const rows = Object.fromEntries(
    [...migration.matchAll(/\('(start|team|pro|business)', (\d+), (\d+), (\d+)\)/g)].map((m) => [m[1], m.slice(2, 5).map(Number)]),
  );
  assert.deepEqual(Object.keys(rows).sort(), [...FIXED_PLANS].sort());
  for (const plan of FIXED_PLANS) {
    const d = PLAN_DETAILS[plan];
    assert.deepEqual(rows[plan], [d.monthlyPrice, d.users, d.installations], plan);
  }
});

test("no later migration changes the catalogue or the trial limits without updating this test", () => {
  const dir = new URL("../../supabase/migrations/", import.meta.url);
  const later = readdirSync(dir).filter((f) => f > "20261120100000_pricing_2026_11.sql" && f !== "20261120200000_site_viewers.sql");
  for (const file of later) {
    const sql = readFileSync(new URL(file, dir), "utf8");
    assert.doesNotMatch(sql, /subscription_plans|organisation_access_on_create/, `${file} touches plans: update CATALOGUE_MIGRATION`);
  }
});

test("pricing 2026-11: Start 19/190/1/10, Team 49/490/3/40, Pro 99/990/8/120, Business 199/1990/20/300", () => {
  assert.deepEqual(
    FIXED_PLANS.map((p) => {
      const d = PLAN_DETAILS[p];
      return [d.name, d.monthlyPrice, d.annualPrice, d.users, d.installations];
    }),
    [
      ["Start", 19, 190, 1, 10],
      ["Team", 49, 490, 3, 40],
      ["Pro", 99, 990, 8, 120],
      ["Business", 199, 1990, 20, 300],
    ],
  );
  // "2 kuud tasuta" must stay true: a year costs exactly 10 months.
  for (const plan of FIXED_PLANS) assert.equal(PLAN_DETAILS[plan].annualPrice, PLAN_DETAILS[plan].monthlyPrice * 10, plan);
  assert.equal(ENTERPRISE_PLAN.installationsFrom, PLAN_DETAILS.business.installations);
  assert.equal(RECOMMENDED_PLAN, "pro");
  assert.equal(FOUNDER_OFFER_ENABLED, false, "founder offer switched off (owner, 2026-11-21)");
});

test("trial: 14 days, 1 user, 10 active installations — in the config and in the database", () => {
  assert.deepEqual(TRIAL, { days: 14, users: 1, installations: 10 });
  assert.equal(TRIAL_DAYS, 14);
  const migration = readFileSync(new URL(CATALOGUE_MIGRATION, import.meta.url), "utf8");
  assert.match(migration, /v_trial\.ends_at, 1, 10\)/);
  assert.match(migration, /now\(\) \+ interval '14 days'/);
  for (const m of [et, en, ru]) {
    assert.match(m.landing.pricing.trialBody, /\b10\b/);
    assert.match(m.app.createOrganisation.trialNew, /\b10\b/);
    assert.match(m.app.plan.trialInstallationsFull, /\b10\b/);
  }
});

test("pricing copy: exact Estonian wording and natural plural forms", () => {
  const p = et.landing.pricing;
  assert.equal(et.landing.nav.howItWorks, "Kuidas töötab?");
  // Header labels (owner decision): "Hinnakiri" and "Registreeru", never "Hinnad" / "Loo konto".
  assert.equal(et.landing.nav.pricing, "Hinnakiri");
  assert.equal(et.landing.nav.signUp, "Registreeru");
  assert.equal(et.common.signIn, "Logi sisse");
  assert.equal(p.title, "Lihtne hinnastus. Kõik vajalik on igas paketis.");
  assert.equal(p.trial, "14 päeva tasuta");
  // No payment-card wording anywhere in the public copy (owner decision).
  for (const messages of [et, en, ru]) {
    assert.doesNotMatch(JSON.stringify(messages), /krediitkaart|credit card|банковск\S* карт/i);
  }
  assert.equal(en.landing.pricing.trial, "14 days free");
  assert.equal(ru.landing.pricing.trial, "14 дней бесплатно");
  assert.equal(p.perMonth, "€ / kuu + KM");
  assert.equal(p.perYear, "€ / aasta + KM");
  assert.equal(p.annualFree, "2 kuud tasuta");
  assert.equal(p.annualInvoice, "arve alusel");
  assert.equal(p.recommended, "Soovitatud");
  assert.equal(p.enterpriseName, "Ettevõte");
  assert.equal(p.enterprisePrice, "Kokkuleppel");
  assert.equal(p.contactCta, "Võta ühendust");
  assert.equal(p.vatNote, "Hinnad ei sisalda käibemaksu.");
  assert.equal(
    `${p.founderOffer.before}info@kaidly.ee${p.founderOffer.after}`,
    "Asutajapakkumine: esimesed 10 ettevõtet saavad 12 kuud 50% soodsamalt. Kirjuta info@kaidly.ee.",
  );
  assert.deepEqual(p.audience, {
    start: "Üksik käidukorraldaja",
    team: "Väike elektrifirma",
    pro: "Käidukorraldusega tegelev ettevõte",
    business: "Suurem hooldusettevõte",
    enterprise: "Suured portfellid",
  });
  assert.equal(
    p.trialBody,
    "Proovi KAIDLY-t 14 päeva kõigi funktsioonidega: prooviperioodil 1 kasutaja ja kuni 10 aktiivset elektripaigaldist. Pärast prooviperioodi jäävad andmed alles ja neid saab vaadata ning eksportida. Andmete lisamiseks ja muutmiseks vali pakett, arve saadame e-postiga.",
  );
  // Owner rule: no "most popular" label in any language.
  for (const messages of [et, en, ru]) {
    assert.doesNotMatch(JSON.stringify(messages), /populaarsem|most popular|самый популярный/i);
  }
  assert.deepEqual([1, 3, 8, 20].map(p.users), ["1 kasutaja", "3 kasutajat", "8 kasutajat", "20 kasutajat"]);
  assert.equal(p.installations(120), "120 aktiivset elektripaigaldist");
  assert.equal(p.installationsFrom(300), "300+ aktiivset elektripaigaldist");
  assert.deepEqual([1, 3, 8, 20].map(en.landing.pricing.users), ["1 user", "3 users", "8 users", "20 users"]);
  assert.deepEqual([1, 3, 8, 20].map(ru.landing.pricing.users), ["1 пользователь", "3 пользователя", "8 пользователей", "20 пользователей"]);
  assert.deepEqual([10, 40, 120, 300].map(ru.landing.pricing.installations), [
    "10 активных электроустановок", "40 активных электроустановок", "120 активных электроустановок", "300 активных электроустановок",
  ]);
});

test("site viewers do not count as users — the same in lib/plans.ts and in the database", () => {
  assert.equal(SITE_VIEWERS_COUNT_AS_USERS, false);
  const dir = new URL("../../supabase/migrations/", import.meta.url);
  const setters = readdirSync(dir)
    .sort()
    .map((f) => readFileSync(new URL(f, dir), "utf8"))
    .flatMap((sql) => [...sql.matchAll(/plan_settings \(id, site_viewers_count_as_users\) values \(true, (true|false)\)|set site_viewers_count_as_users = (true|false)/g)])
    .map((m) => (m[1] ?? m[2]) === "true");
  assert.ok(setters.length >= 1, "the migration sets the database value");
  assert.equal(setters.at(-1), SITE_VIEWERS_COUNT_AS_USERS);
});

test("Estonian case forms of the name are written with a hyphen (KAIDLY-t, KAIDLY-s, …)", () => {
  for (const file of ["lib/i18n/et.ts", "lib/legal/content.ts", "lib/admin/strings.ts", "scripts/email-templates.mjs"]) {
    const text = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(text, /KAIDLY(t|s|ga|sse|st)\b/, file);
  }
  assert.equal(
    et.landing.pricing.trialBody,
    "Proovi KAIDLY-t 14 päeva kõigi funktsioonidega: prooviperioodil 1 kasutaja ja kuni 10 aktiivset elektripaigaldist. Pärast prooviperioodi jäävad andmed alles ja neid saab vaadata ning eksportida. Andmete lisamiseks ja muutmiseks vali pakett, arve saadame e-postiga.",
  );
  for (const item of ["Auditipakett (PDF)", "Objekti vaatajad (ei lähe kasutajate arvu hulka)", "Kaheastmeline sisselogimine"]) {
    assert.ok((et.landing.pricing.features as readonly string[]).includes(item), item);
  }
  assert.match(et.landing.pricing.note, /Objekti vaatajad ei lähe arvesse\.$/);
});
