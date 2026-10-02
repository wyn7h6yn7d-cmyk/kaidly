import type { BrowserContext } from "@playwright/test";
import {
  createInstallation,
  createOrg,
  createSite,
  createUser,
  expect,
  expectNoHorizontalScroll,
  field,
  login,
  sql,
  test,
  type TestOrg,
  uniqueId,
} from "./support/fixtures";

const expire = (org: TestOrg) =>
  sql(`update private.organisation_access set trial_started_at = now() - interval '20 days', trial_ends_at = now() - interval '6 days'
       where organisation_id = '${org.id}';`);

async function setLanguage(context: BrowserContext, locale: "en" | "ru") {
  await context.addCookies([{ name: "kaidly_locale", value: locale, url: "http://localhost:3100" }]);
}

test.describe("Prooviperiood ja ligipääs", () => {
  test("a new company starts a 14-day trial with full access", async ({ page }) => {
    const user = await createUser("Proovija");
    await login(page, user, "/o/uus");
    await field(page, "name").fill(`Proovi ${uniqueId("p")} OÜ`);
    await page.getByRole("button", { name: "Loo ettevõte" }).click();
    await expect(page.getByRole("heading", { name: "Ettevõte on valmis." })).toBeVisible();
    await expect(page.getByTestId("access-banner")).toContainText(/Prooviperioodi lõpuni 1[34] päeva/);
    await expect(page.getByTestId("access-banner")).toContainText("KAIDLY täiskasutus on aktiivne kuni");
    expect(sql(`select (trial_ends_at - trial_started_at)::text from private.organisation_access a join public.organisation_members m on m.organisation_id = a.organisation_id where m.user_id = '${user.id}'`)).toBe("14 days");
    await page.goto(page.url().replace(/\?.*$/, "") + "/objektid/uus");
    await field(page, "name").fill("Proovi objekt");
    await page.getByRole("button", { name: "Lisa objekt" }).click();
    await expect(page.getByRole("heading", { name: "Proovi objekt" })).toBeVisible();
  });

  test("the last three days are more visible", async ({ page }) => {
    const org = await createOrg();
    sql(`update private.organisation_access set trial_ends_at = now() + interval '2 days' where organisation_id = '${org.id}';`);
    await login(page, org.users.owner, `/o/${org.slug}`);
    await expect(page.getByTestId("access-banner")).toContainText("Prooviperioodi lõpuni 2 päeva");
    await expect(page.getByTestId("access-banner")).toHaveClass(/border-k-warn/);
  });

  test("expired company: everything readable, nothing writable, persistent notice @responsive", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Tallinna tehas");
    const installation = await createInstallation(org, site, "Peakilp", "PK-01");
    const activity = sql(`insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on)
      values ('${org.id}', '${site}', '${installation}', 'Hooldus', 'once', (now() at time zone 'Europe/Tallinn')::date + 5) returning id;`);
    sql(`insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
         values ('${org.id}', '${site}', '${installation}', 'inspection', 'Enne aegumist tehtud', '${org.users.operator.id}');`);
    expire(org);

    await login(page, org.users.admin, `/o/${org.slug}`);
    const banner = page.getByTestId("access-banner");
    await expect(banner).toContainText("Prooviperiood on lõppenud");
    await expect(banner).toContainText("Ettevõtte andmed on alles ja saad neid vaadata, kuid uusi sissekandeid teha ei saa.");
    await expectNoHorizontalScroll(page);

    await page.goto(`/o/${org.slug}/paevik`);
    await expect(page.getByText("Enne aegumist tehtud")).toBeVisible();
    await expect(page.getByRole("link", { name: /Lisa sissekanne/ })).toHaveCount(0);
    await page.goto(`/o/${org.slug}/objektid`);
    await expect(page.getByText("Tallinna tehas")).toBeVisible();
    await expect(page.getByRole("link", { name: "Lisa objekt" })).toHaveCount(0);
    await page.goto(`/o/${org.slug}/kaidukava/${activity}`);
    await expect(page.getByRole("heading", { name: "Hooldus" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Märgi tehtuks" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Muuda tegevust" })).toHaveCount(0);

    // Write pages explain the read-only state instead of failing on save.
    await page.goto(`/o/${org.slug}/objektid/uus`);
    await expect(page.getByRole("heading", { name: "Ettevõte on ainult vaatamiseks" })).toBeVisible();
    await page.goto(`/o/${org.slug}/sissekanne`);
    await expect(page.getByRole("heading", { name: "Ettevõte on ainult vaatamiseks" })).toBeVisible();
    // Admin-level reading still works.
    await page.goto(`/o/${org.slug}/seaded/ajalugu`);
    await expect(page.getByRole("navigation", { name: "Seaded" }).getByRole("link", { name: "Muudatuste ajalugu" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Ettevõte on ainult vaatamiseks" })).toHaveCount(0);

    // The existing reminder still opens its activity, read-only.
    const reminder = sql(`select id from public.notifications where user_id = '${org.users.admin.id}' limit 1`);
    await page.goto(`/teavitused/${reminder}`);
    await expect(page).toHaveURL(new RegExp(`/kaidukava/${activity}$`));
    await expect(page.getByRole("link", { name: "Märgi tehtuks" })).toHaveCount(0);

    // History is intact and the account still works.
    expect(sql(`select count(*) from public.log_entries where organisation_id = '${org.id}'`)).toBe("1");
    await page.goto("/konto");
    await expect(page.getByRole("heading", { name: "Minu konto" })).toBeVisible();
  });

  test("one user: active company writable, expired company read-only", async ({ page }) => {
    const active = await createOrg(`Aktiivne ${uniqueId("a")}`);
    const expired = await createOrg(`Aegunud ${uniqueId("e")}`);
    sql(`insert into public.organisation_members (organisation_id, user_id, role) values ('${expired.id}', '${active.users.owner.id}', 'owner');`);
    expire(expired);
    sql(`update private.organisation_access set full_access_from = now(), full_access_until = null where organisation_id = '${active.id}';`);

    await login(page, active.users.owner, `/o/${active.slug}/objektid`);
    await expect(page.getByTestId("access-banner")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Lisa objekt" }).first()).toBeVisible();
    await page.goto(`/o/${expired.slug}/objektid`);
    await expect(page.getByTestId("access-banner")).toContainText("Prooviperiood on lõppenud");
    await expect(page.getByRole("link", { name: "Lisa objekt" })).toHaveCount(0);
    await page.goto(`/o/${active.slug}/objektid/uus`);
    await field(page, "name").fill("Uus objekt");
    await page.getByRole("button", { name: "Lisa objekt" }).click();
    await expect(page.getByRole("heading", { name: "Uus objekt" })).toBeVisible();
  });

  test("platform admin: extend trial, activate full access, expire — audited", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const admin = await createUser(`Platvorm ${uniqueId("p")}`);
    sql(`select private.bootstrap_platform_admin('${admin.email}');`);
    const name = `Kliendi ${uniqueId("k")} OÜ`;
    const org = await createOrg(name);
    expire(org);

    await login(page, admin, `/admin/companies/${org.id}`);
    const section = page.getByRole("region", { name: "KAIDLY ligipääs" });
    await expect(section.getByText("Aegunud", { exact: true })).toBeVisible();
    await page.locator("#access-extend").selectOption("14");
    await page.getByRole("button", { name: "Pikenda prooviperioodi" }).click();
    await expect(section.getByText("Prooviperiood", { exact: true })).toBeVisible();

    const owner = await (await browser.newContext()).newPage();
    await login(owner, org.users.owner, `/o/${org.slug}`);
    await expect(owner.getByTestId("access-banner")).toContainText(/Prooviperioodi lõpuni (13|14) päeva/);

    await page.locator("#access-period").selectOption("12");
    await page.locator("#access-invoice").fill("ARV-2026-017");
    await page.getByRole("button", { name: "Aktiveeri täiskasutus" }).click();
    await expect(section.getByText("Täiskasutus", { exact: true })).toBeVisible();
    await expect(section.getByText("ARV-2026-017").first()).toBeVisible();
    await owner.reload();
    await expect(owner.getByTestId("access-banner")).toHaveCount(0);

    await page.getByRole("button", { name: "Lõpeta ligipääs" }).click();
    await page.getByRole("dialog").getByLabel(/Kinnitamiseks kirjuta/).fill(name);
    await page.getByRole("dialog").getByRole("button", { name: "Kinnita" }).click();
    await expect(section.getByText("Aegunud", { exact: true })).toBeVisible();
    await owner.reload();
    await expect(owner.getByTestId("access-banner")).toContainText("KAIDLY ligipääs on lõppenud");

    await page.goto("/admin/companies?ligipaas=expired");
    await expect(page.getByRole("link", { name })).toBeVisible();
    await page.goto("/admin/audit");
    const rows = page.getByRole("row").filter({ hasText: admin.fullName });
    await expect(rows.filter({ hasText: "Prooviperioodi pikendati" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "Täiskasutus aktiveeriti / muudeti" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "Ligipääs lõpetati" })).toHaveCount(1);
  });

  test("expired: the getting-started guide blames the ended trial, and no broken contact link", async ({ page }) => {
    const org = await createOrg();
    expire(org);
    await login(page, org.users.admin, `/o/${org.slug}`);
    const guide = page.getByRole("region", { name: "Alustamise juhend" });
    await expect(guide.getByText("Prooviperiood on lõppenud. Täiskasutuse taastamiseks võta KAIDLYga ühendust.").first()).toBeVisible();
    await expect(guide.getByText("Seda sammu teeb ettevõtte omanik või administraator.")).toHaveCount(0);
    // KAIDLY_CONTACT_EMAIL is not set for the test server: plain message, no mailto link.
    const banner = page.getByTestId("access-banner");
    await expect(banner).toContainText("Täiskasutuse jätkamiseks võta ühendust KAIDLYga.");
    await expect(banner.locator('a[href^="mailto:"]')).toHaveCount(0);
  });

  test("access notices in English and Russian", async ({ page, context }) => {
    const org = await createOrg();
    expire(org);
    await setLanguage(context, "en");
    await login(page, org.users.owner, `/o/${org.slug}`);
    await expect(page.getByTestId("access-banner")).toContainText("The trial has ended");
    await setLanguage(context, "ru");
    await page.reload();
    await expect(page.getByTestId("access-banner")).toContainText("Пробный период закончился");
  });
});
