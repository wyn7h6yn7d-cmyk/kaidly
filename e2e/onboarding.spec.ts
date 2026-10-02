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
  uniqueId,
} from "./support/fixtures";

async function setLanguage(context: BrowserContext, locale: "en" | "ru") {
  await context.addCookies([{ name: "kaidly_locale", value: locale, url: "http://localhost:3100" }]);
}

test.describe("Alustamine", () => {
  test("a new organisation is welcomed and guided step by step with real progress @responsive", async ({ page }) => {
    test.setTimeout(120_000);
    const user = await createUser("Uus Omanik");
    const company = `Alustaja ${uniqueId("a")} OÜ`; // unique: looked up by name below
    await login(page, user, "/o/uus");
    await field(page, "name").fill(company);
    await page.getByRole("button", { name: "Loo ettevõte" }).click();

    await expect(page.getByRole("heading", { name: "Ettevõte on valmis." })).toBeVisible();
    const overview = page.url().replace(/\?.*$/, "");
    const guide = page.getByRole("region", { name: "Alustamise juhend" });
    await expect(guide.getByText("1/6 tehtud")).toBeVisible();
    await expect(guide.getByText("Enne seda loo objekt.").first()).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.getByRole("link", { name: "Lisa esimene objekt" }).click();
    await field(page, "name").fill("Kontorihoone");
    await page.getByRole("button", { name: "Lisa objekt" }).click();
    await expect(page.getByRole("heading", { name: "Kontorihoone" })).toBeVisible();

    await page.goto(overview);
    await expect(guide.getByText("2/6 tehtud")).toBeVisible();
    await guide.getByRole("link", { name: "Lisa elektripaigaldis" }).click();
    await field(page, "name").fill("Peajaotuskilp");
    await page.getByRole("button", { name: "Lisa paigaldis" }).click();
    await expect(page.getByRole("heading", { name: "Käidupäevik on veel tühi" })).toBeVisible();

    await page.goto(overview);
    await expect(guide.getByText("3/6 tehtud")).toBeVisible();
    // One installation: the entry step goes straight to its form.
    await guide.getByRole("link", { name: "Lisa sissekanne" }).click();
    await expect(page).toHaveURL(/\/paevik\/uus$/);
    await page.getByText("Kontroll", { exact: true }).click();
    await field(page, "description").fill("Paigaldis üle võetud, seis korras");
    await page.getByRole("button", { name: "Salvesta sissekanne" }).click();
    await expect(page.getByText("Sissekanne salvestatud.")).toBeVisible();

    await page.goto(overview);
    await expect(guide.getByText("4/6 tehtud")).toBeVisible();
    await expect(guide.getByRole("link", { name: "Lisa tegevus" })).toBeVisible();
    await expect(guide.getByRole("link", { name: "Lisa dokument" })).toBeVisible();

    // Activity and document done (through SQL to keep the test short): complete.
    const orgId = sql(`select id from public.organisations where name = '${company}'`);
    sql(`insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on, created_by)
         select i.organisation_id, i.site_id, i.id, 'Ülevaatus', 'once', (now() at time zone 'Europe/Tallinn')::date + 30, '${user.id}'
           from public.electrical_installations i where i.organisation_id = '${orgId}';
         insert into public.documents (organisation_id, category, title, original_filename, mime_type, size_bytes, status, ready_at, uploaded_by)
         values ('${orgId}', 'manual', 'Juhend', 'juhend.pdf', 'application/pdf', 10, 'ready', now(), '${user.id}');`);
    await page.reload();
    await expect(page.getByRole("region", { name: "Alustamise juhend" })).toHaveCount(0);
    await page.goto(`${overview}/abi`);
    await expect(page.getByText("Kõik alustamise sammud on tehtud.")).toBeVisible();
    await expect(page.getByText("6/6 tehtud")).toBeVisible();
  });

  test("the guide can be hidden and reopened from Abi", async ({ page }) => {
    const org = await createOrg();
    await login(page, org.users.owner, `/o/${org.slug}`);
    const guide = page.getByRole("region", { name: "Alustamise juhend" });
    await expect(guide).toBeVisible();
    await guide.getByRole("button", { name: "Peida juhend" }).click();
    await expect(guide).toHaveCount(0);

    await page.goto(`/o/${org.slug}/abi`);
    await expect(page.getByRole("region", { name: "Alustamise juhend" })).toBeVisible();
    await expect(page.getByText("Elektripaigaldis", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Näita juhendit ülevaates" }).click();
    await expect(page.getByRole("button", { name: "Näita juhendit ülevaates" })).toHaveCount(0);
    await page.goto(`/o/${org.slug}`);
    await expect(page.getByRole("region", { name: "Alustamise juhend" })).toBeVisible();
  });

  test("empty modules explain themselves and send you to the missing prerequisite @responsive", async ({ page }) => {
    const org = await createOrg();
    await login(page, org.users.admin, `/o/${org.slug}/objektid`);
    await expect(page.getByRole("heading", { name: "Alusta esimesest objektist" })).toBeVisible();
    await expect(page.getByText("Alusta käidupäeviku pidamist")).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.goto(`/o/${org.slug}/paevik`);
    await expect(page.getByText("Sissekanded tehakse elektripaigaldise juurde. Lisa enne elektripaigaldis.")).toBeVisible();
    await page.getByRole("link", { name: "Lisa elektripaigaldis" }).click();
    await expect(page.getByText("Enne elektripaigaldise lisamist loo esimene objekt.")).toBeVisible();
    await page.getByRole("link", { name: "Lisa objekt" }).last().click();
    await expect(page).toHaveURL(new RegExp(`/o/${org.slug}/objektid/uus$`));

    await page.goto(`/o/${org.slug}/kaidukava`);
    await expect(page.getByText("KAIDLY jälgib tähtaega")).toBeVisible();
    await expect(page.getByText("Tegevused kuuluvad elektripaigaldise juurde. Lisa enne elektripaigaldis.")).toBeVisible();
    await page.goto(`/o/${org.slug}/puudused`);
    await expect(page.getByText("Puuduste all jälgid avastatud probleeme kuni nende lahendamiseni.", { exact: false })).toBeVisible();
    await page.goto(`/o/${org.slug}/dokumendid`);
    await expect(page.getByRole("link", { name: "Lisa esimene dokument" })).toBeVisible();
  });

  test("with an installation, empty modules offer their first action; viewers get no actions", async ({ page, browser }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Kilp");
    await login(page, org.users.operator, `/o/${org.slug}/paigaldised/${installation}/paevik`);
    await page.getByRole("link", { name: "Lisa esimene sissekanne" }).click();
    await expect(page).toHaveURL(/\/paevik\/uus$/);

    const other = await browser.newContext();
    const viewer = await other.newPage();
    await login(viewer, org.users.viewer, `/o/${org.slug}/kaidukava`);
    await expect(viewer.getByText("Tegevusi lisavad ettevõtte omanikud ja administraatorid.")).toBeVisible();
    await expect(viewer.getByRole("link", { name: "Lisa esimene tegevus" })).toHaveCount(0);
    await other.close();
  });

  test("onboarding speaks English and Russian", async ({ page, context }) => {
    const org = await createOrg();
    await setLanguage(context, "en");
    await login(page, org.users.owner, `/o/${org.slug}`);
    await expect(page.getByRole("region", { name: "Getting started" })).toBeVisible();
    await page.goto(`/o/${org.slug}/objektid`);
    await expect(page.getByRole("heading", { name: "Start with your first site" })).toBeVisible();
    await setLanguage(context, "ru");
    await page.goto(`/o/${org.slug}/abi`);
    await expect(page.getByRole("region", { name: "Руководство по началу работы" })).toBeVisible();
    await expect(page.getByText("Электроустановка", { exact: true })).toBeVisible();
  });
});
