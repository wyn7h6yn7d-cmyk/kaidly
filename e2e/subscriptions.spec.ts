import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { createOrg, createUser, expect, login, sql, test, uniqueId, type TestUser } from "./support/fixtures";

// Platform Admin → Tellimused, the customer's plan view, plan limits in the app, and that
// nobody else can read or change subscriptions (docs/SUBSCRIPTIONS.md).

async function platformAdmin(): Promise<TestUser> {
  const admin = await createUser(`Platvorm ${uniqueId("p")}`);
  sql(`select private.bootstrap_platform_admin('${admin.email}');`);
  return admin;
}

/** The Tallinn business date + n calendar months as 06.04.2027 (same rule as the database). */
const dayPlusMonths = (n: number, from = "private.business_date()") =>
  sql(`select to_char(private.add_months(${from}, ${n}), 'DD.MM.YYYY')`);

async function review(page: Page) {
  await page.getByRole("button", { name: "Vaata üle" }).click();
  return page.getByTestId("subscription-summary").first();
}

async function apply(page: Page) {
  await page.getByRole("button", { name: "Kinnita ja rakenda" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Kinnita muudatus" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Kinnita ja rakenda" }).click();
  await expect(page.getByText("Tellimus salvestatud.")).toBeVisible();
}

test.describe("Tellimused (platvormi admin)", () => {
  test("list, fixed plan values, activate Pro for 6 months, extend, Custom, history; the customer sees only plan and usage", async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    const admin = await platformAdmin();
    const name = `Tellija ${uniqueId("t")} OÜ`;
    const org = await createOrg(name);

    // Menu entry, list, search.
    await login(page, admin, "/admin");
    await page.getByRole("navigation", { name: "KAIDLY Admin" }).getByRole("link", { name: "Tellimused" }).click();
    await expect(page.getByRole("heading", { name: "Tellimused", level: 1 })).toBeVisible();
    await page.getByRole("searchbox").fill(name);
    await page.getByRole("searchbox").press("Enter");
    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row).toContainText("Paketita");
    await expect(row).toContainText("Prooviperiood");
    await expect(row).toContainText("4 / –");
    await row.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();

    // Fixed plans fill in their price and limits.
    const plan = page.getByLabel("Pakett", { exact: true });
    const values = page.getByTestId("fixed-plan-values");
    for (const [value, text] of [
      ["start", "19 € / kuu + KM · kasutajaid 1 · aktiivseid paigaldisi 5"],
      ["team", "29 € / kuu + KM · kasutajaid 3 · aktiivseid paigaldisi 10"],
      ["pro", "39 € / kuu + KM · kasutajaid 5 · aktiivseid paigaldisi 25"],
      ["business", "89 € / kuu + KM · kasutajaid 15 · aktiivseid paigaldisi 100"],
    ]) {
      await plan.selectOption(value);
      await expect(values).toHaveText(text);
    }

    // Pro, 6 months: summary, confirmation, saved.
    await plan.selectOption("pro");
    await page.locator("#sub-period").selectOption("6");
    const summary = await review(page);
    // The form still shows what was reviewed (no automatic form reset after the action).
    await expect(summary).toBeVisible();
    await expect(plan).toHaveValue("pro");
    await expect(page.locator("#sub-period")).toHaveValue("6");
    const until6 = dayPlusMonths(6);
    await expect(summary).toContainText("Aktiveerimine");
    await expect(summary).toContainText("Pro");
    await expect(summary).toContainText("39 € / kuu + KM");
    await expect(summary).toContainText("Kasutajad: 5");
    await expect(summary).toContainText("Paigaldised: 25");
    await expect(summary).toContainText("Periood: 6 kuud");
    await expect(summary).toContainText(`Kehtib kuni: ${until6}`);
    await apply(page);
    const current = page.getByRole("region", { name: "Praegune tellimus" });
    await expect(current).toContainText("Täiskasutus");
    await expect(current).toContainText(until6);
    await expect(current).toContainText("4 / 5");

    // Extending an active subscription counts from its paid-until day.
    await page.locator("#sub-period").selectOption("3");
    const extended = await review(page);
    const iso6 = sql(`select private.add_months(private.business_date(), 6)`);
    const until9 = dayPlusMonths(3, `'${iso6}'::date`);
    await expect(extended).toContainText("Pikendamine");
    await expect(extended).toContainText(`Kehtib kuni: ${until9}`);
    await apply(page);
    await expect(current).toContainText(until9);

    // Custom: own label, price and limits; the period stays.
    await plan.selectOption("custom");
    await page.getByLabel("Custom paketi nimi").fill("Raamleping 2027");
    await page.getByLabel("Kokkulepitud kuutasu (€, ilma KM-ta)").fill("120");
    await page.getByLabel("Kasutajate limiit (kokku)").fill("8");
    await page.getByLabel("Aktiivsete elektripaigaldiste limiit").fill("40");
    await page.locator("#sub-period").selectOption("none");
    const custom = await review(page);
    await expect(custom).toContainText("Raamleping 2027 (Custom)");
    await expect(custom).toContainText("120 € / kuu + KM");
    await expect(custom).toContainText("Kehtivus ei muutu");
    await apply(page);
    await expect(current).toContainText("Raamleping 2027 (Custom)");
    await expect(current).toContainText(until9);

    // Internal note: admin only.
    await page.locator("#ref-notes").fill("Sisemine märkus: maksab aastaarvega");
    await page.getByRole("button", { name: "Salvesta" }).click();
    await expect(current).toContainText("Sisemine märkus: maksab aastaarvega");

    // History: previous → new plan, paid-until, limits, who.
    const history = page.getByRole("region", { name: "Muudatuste ajalugu" });
    await expect(history.getByRole("row").filter({ hasText: "Paketita → Pro" })).toContainText(admin.fullName);
    await expect(history.getByRole("row").filter({ hasText: "Pro → Raamleping 2027 (Custom)" })).toContainText("5 / 25 → 8 / 40");
    await expect(history.getByRole("row").filter({ hasText: `${until6} → ${until9}` })).toHaveCount(1);

    // Shortcut from the company card.
    await page.goto(`/admin/companies/${org.id}`);
    await page.getByRole("link", { name: "Halda tellimust" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/tellimused/${org.id}$`));

    // The customer: plan, usage and expiry — no price, no note; no admin pages.
    const owner = await (await browser.newContext()).newPage();
    await login(owner, org.users.owner, `/o/${org.slug}/seaded`);
    const planSection = owner.getByRole("region", { name: "Pakett" });
    await expect(planSection).toContainText("Raamleping 2027");
    await expect(planSection).toContainText("4 / 8");
    await expect(planSection).toContainText("0 / 40");
    await expect(planSection).toContainText("Kehtib kuni");
    await expect(owner.getByText("Sisemine märkus")).toHaveCount(0);
    await expect(owner.getByText("120")).toHaveCount(0);
    await owner.goto(`/admin/tellimused/${org.id}`);
    await expect(owner.getByText("Lehte ei leitud")).toBeVisible();
    await owner.goto("/admin/tellimused");
    await expect(owner.getByText("Lehte ei leitud")).toBeVisible();
  });
});

test.describe("Paketi limiidid rakenduses", () => {
  test("full seats replace the invitation form; a full installation limit replaces the new-installation form", async ({ page }) => {
    const org = await createOrg(`Limiidid ${uniqueId("l")} OÜ`);
    // Team: 3 seats, but the company already has 4 members — nothing is removed, no new invitations.
    sql(`update private.organisation_access set plan = 'team', user_limit = 3, installation_limit = 1 where organisation_id = '${org.id}';`);
    await login(page, org.users.owner, `/o/${org.slug}/seaded/liikmed`);
    await expect(page.getByText("Kasutajad: 4 / 3")).toBeVisible();
    await expect(page.getByText("Paketi kasutajate arv on täis")).toBeVisible();
    await expect(page.getByRole("link", { name: "Vaata hindu" })).toHaveAttribute("href", "/#hinnad");
    await expect(page.getByRole("button", { name: "Loo kutse" })).toHaveCount(0);
    await expect(page.getByText(/Konto Omanik|Olev Omanik/).first()).toBeVisible(); // existing members still listed

    // One active installation allowed: the first works, then the form is replaced.
    const site = sql(`insert into public.sites (organisation_id, name) values ('${org.id}', 'Limiidi objekt') returning id;`);
    sql(`insert into public.electrical_installations (organisation_id, site_id, name, installation_type)
         values ('${org.id}', '${site}', 'Ainus kilp', 'switchboard');`);
    await page.goto(`/o/${org.slug}/paigaldised/uus`);
    await expect(page.getByText("Paketi aktiivsete elektripaigaldiste arv on täis")).toBeVisible();
    await expect(page.getByRole("button", { name: "Lisa paigaldis" })).toHaveCount(0);

    // Archiving frees the slot.
    sql(`update public.electrical_installations set archived_at = now() where organisation_id = '${org.id}';`);
    await page.reload();
    await expect(page.getByText("Paketi aktiivsete elektripaigaldiste arv on täis")).toHaveCount(0);
  });

  test("plan in English and Russian on the settings page", async ({ page, context }) => {
    const org = await createOrg(`Keeled ${uniqueId("k")} OÜ`);
    sql(`update private.organisation_access set plan = 'business', user_limit = 15, installation_limit = 100 where organisation_id = '${org.id}';`);
    sql(`update public.profiles set preferred_locale = 'en' where id = '${org.users.viewer.id}';`);
    await context.addCookies([{ name: "kaidly_locale", value: "en", url: "http://localhost:3100" }]);
    await login(page, org.users.viewer, `/o/${org.slug}/seaded`);
    const en = page.getByRole("region", { name: "Plan" });
    await expect(en).toContainText("Business");
    await expect(en).toContainText("4 / 15");
    await expect(en).toContainText("Free trial");
    sql(`update public.profiles set preferred_locale = 'ru' where id = '${org.users.viewer.id}';`);
    await context.addCookies([{ name: "kaidly_locale", value: "ru", url: "http://localhost:3100" }]);
    await page.reload();
    const ru = page.getByRole("region", { name: "Тариф" });
    await expect(ru).toContainText("4 / 15");
    await expect(ru).toContainText("Пробный период");
  });
});

test.describe("Tellimuste andmed API kaudu", () => {
  test("a company owner cannot read or change subscription administration", async () => {
    const org = await createOrg(`API ${uniqueId("a")} OÜ`);
    const client = createClient(process.env.E2E_API_URL!, process.env.E2E_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInError } = await client.auth.signInWithPassword({ email: org.users.owner.email, password: org.users.owner.password });
    expect(signInError).toBeNull();

    const set = await client.rpc("admin_set_subscription", {
      p_org: org.id, p_plan: "business", p_label: null, p_price: null, p_user_limit: null, p_installation_limit: null,
      p_months: 24, p_paid_until: null, p_start: null,
    });
    expect(set.error?.message).toBe("not_found");
    expect((await client.rpc("admin_subscription", { p_org: org.id })).error?.message).toBe("not_found");
    expect((await client.rpc("admin_subscriptions", { p_search: null, p_filter: null, p_limit: 50, p_offset: 0 })).error?.message).toBe("not_found");
    expect((await client.rpc("admin_set_access_reference", { p_org: org.id, p_invoice_reference: "x", p_notes: "x" })).error?.message).toBe("not_found");
    expect(sql(`select status from private.organisation_access_state('${org.id}')`)).toBe("trial");
    expect(sql(`select coalesce(plan, '-') from private.organisation_access where organisation_id = '${org.id}'`)).toBe("-");

    // The private schema is not an API schema.
    const direct = await fetch(`${process.env.E2E_API_URL}/rest/v1/organisation_access?select=*`, {
      headers: {
        apikey: process.env.E2E_PUBLISHABLE_KEY!,
        Authorization: `Bearer ${(await client.auth.getSession()).data.session!.access_token}`,
        "Accept-Profile": "private",
      },
    });
    expect(direct.status).toBe(406);

    // Their own view: plan and usage, never admin fields.
    const { data } = await client.rpc("organisation_plan", { p_org: org.id });
    expect(Object.keys(data as object).sort()).toEqual(
      ["indefinite", "installation_limit", "installations_active", "paid_until", "plan", "plan_label", "seats_used", "status", "trial_ends_at", "user_limit"],
    );
  });
});
