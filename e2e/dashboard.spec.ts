import {
  createInstallation,
  createOrg,
  createSite,
  expect,
  expectNoHorizontalScroll,
  field,
  login,
  sql,
  test,
} from "./support/fixtures";

const today = "(now() at time zone 'Europe/Tallinn')::date";

test.describe("Ülevaade ja esmakasutus", () => {
  test("dashboard shows what needs attention, scoped to the organisation @responsive", async ({ page }) => {
    const org = await createOrg("Tähelepanu OÜ");
    const other = await createOrg("Teine OÜ");
    const site = await createSite(org, "Katlamaja");
    const installation = await createInstallation(org, site, "Peakilp", "PK-1");
    const otherSite = await createSite(other, "Võõras objekt");
    const otherInstallation = await createInstallation(other, otherSite, "Võõras kilp");
    sql(`
      insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on, created_by)
      values ('${org.id}', '${site}', '${installation}', 'Termograafia hilinenud', 'once', ${today} - 4, '${org.users.admin.id}'),
             ('${org.id}', '${site}', '${installation}', 'Kilbi ülevaatus varsti', 'once', ${today} + 3, '${org.users.admin.id}'),
             ('${other.id}', '${otherSite}', '${otherInstallation}', 'Võõras hilinenud tegevus', 'once', ${today} - 4, '${other.users.admin.id}');
      insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, created_by)
      values ('${org.id}', '${site}', '${installation}', 'Kriitiline klemm', 'x', 'critical', '${org.users.operator.id}'),
             ('${org.id}', '${site}', '${installation}', 'Madal puudus', 'x', 'low', '${org.users.operator.id}'),
             ('${other.id}', '${otherSite}', '${otherInstallation}', 'Võõras kriitiline', 'x', 'critical', '${other.users.operator.id}');
      insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
      values ('${org.id}', '${site}', '${installation}', 'inspection', 'Esimene ülevaatus tehtud', '${org.users.operator.id}');`);

    await login(page, org.users.viewer, `/o/${org.slug}`);
    await expect(page.getByRole("heading", { name: "Mis vajab tähelepanu" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Üle tähtaja" }).getByText("Termograafia hilinenud")).toBeVisible();
    await expect(page.getByRole("list", { name: "Tähtaeg 14 päeva jooksul" }).getByText("Kilbi ülevaatus varsti")).toBeVisible();
    const serious = page.getByRole("list", { name: "Kõrged ja kriitilised puudused" });
    await expect(serious.getByText("Kriitiline klemm")).toBeVisible();
    await expect(serious.getByText("Madal puudus")).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Viimased sissekanded" }).getByText("Esimene ülevaatus tehtud")).toBeVisible();
    await expect(page.getByRole("list", { name: "Objektid, kus on lahtisi asju" }).getByText("Katlamaja")).toBeVisible();
    // Nothing from the other organisation; no onboarding once everything exists.
    await expect(page.getByText(/Võõras/)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Alusta siit" })).toHaveCount(0);
    // Viewers read; no quick-entry button.
    await expect(page.getByRole("link", { name: "Lisa sissekanne" })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });

  test("first use: site → installation → first log entry, guided from the overview", async ({ page }) => {
    const org = await createOrg("Uus Firma OÜ");
    await login(page, org.users.owner, `/o/${org.slug}`);

    await expect(page.getByRole("heading", { name: "Alusta siit" })).toBeVisible();
    await page.getByRole("link", { name: "Lisa objekt" }).click();
    await field(page, "name").fill("Kontorihoone");
    await page.getByRole("button", { name: /Lisa objekt|Salvesta/ }).click();
    await expect(page.getByRole("heading", { name: "Kontorihoone" })).toBeVisible();

    await page.goto(`/o/${org.slug}`);
    await page.getByRole("link", { name: "Lisa paigaldis" }).click();
    await field(page, "name").fill("Peajaotuskilp");
    await page.getByRole("button", { name: /Lisa paigaldis|Salvesta/ }).click();
    // The installation overview invites the first entry.
    await expect(page.getByRole("heading", { name: "Käidupäevik on veel tühi" })).toBeVisible();

    await page.goto(`/o/${org.slug}`);
    // One installation: quick entry goes straight to its form.
    await page.getByRole("link", { name: "Lisa esimene sissekanne" }).click();
    await expect(page).toHaveURL(/\/paevik\/uus$/);
    await page.getByText("Kontroll", { exact: true }).click();
    await field(page, "description").fill("Paigaldis üle võetud, seis korras");
    await page.getByRole("button", { name: "Salvesta sissekanne" }).click();
    await expect(page.getByText("Sissekanne salvestatud.")).toBeVisible();

    await page.goto(`/o/${org.slug}`);
    await expect(page.getByRole("heading", { name: "Alusta siit" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Mis vajab tähelepanu" })).toBeVisible();
  });

  test("members without sites are told who adds them", async ({ page }) => {
    const org = await createOrg();
    await login(page, org.users.operator, `/o/${org.slug}`);
    await expect(page.getByText(/Need lisab organisatsiooni administraator/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Lisa objekt" })).toHaveCount(0);
  });

  test("quick entry lists installations by site, recently used first @responsive", async ({ page }) => {
    const org = await createOrg();
    const a = await createSite(org, "Alfa objekt");
    const b = await createSite(org, "Beta objekt");
    const one = await createInstallation(org, a, "Kilp üks", "K-1");
    await createInstallation(org, b, "Kilp kaks", "K-2");
    sql(`insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
         values ('${org.id}', '${a}', '${one}', 'inspection', 'Eelmine', '${org.users.operator.id}');`);

    await login(page, org.users.operator, `/o/${org.slug}`);
    await page.getByRole("link", { name: "Lisa sissekanne" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/o/${org.slug}/sissekanne$`));
    await expect(page.getByRole("list", { name: "Viimati kasutatud" }).getByText("Kilp üks")).toBeVisible();
    await expect(page.getByRole("list", { name: "Beta objekt: paigaldised" }).getByText("Kilp kaks")).toBeVisible();
    await page.getByRole("list", { name: "Beta objekt: paigaldised" }).getByRole("link").click();
    await expect(page).toHaveURL(/\/paevik\/uus$/);
    await expectNoHorizontalScroll(page);
  });
});
