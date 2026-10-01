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

test.describe("Puudused", () => {
  test("operator records, progresses and resolves a deficiency; the log shows it @responsive", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Tootmishoone");
    const installation = await createInstallation(org, site, "Peajaotuskilp", "PJK-1");
    await login(page, org.users.operator, `/o/${org.slug}/paigaldised/${installation}/puudused`);

    await page.getByRole("link", { name: "Lisa puudus" }).first().click();
    await expect(page.locator('input[type="hidden"][name="installationId"]')).toHaveCount(1);
    await field(page, "title").fill("Lahtine klemm");
    await field(page, "description").fill("Peakilbi klemm X3 on lahti");
    await field(page, "severity").selectOption("high");
    await page.getByRole("button", { name: "Lisa puudus" }).click();

    await expect(page.getByRole("heading", { name: "Lahtine klemm" })).toBeVisible();
    await expect(page.getByText("Avatud", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Märgi töös" }).click();
    await expect(page.getByText("Töös", { exact: true }).first()).toBeVisible();

    await page.getByRole("link", { name: "Lahenda puudus" }).click();
    await page.getByRole("button", { name: "Lahenda puudus" }).click();
    // Resolution note is required (browser validation keeps the user on the form).
    await expect(page).toHaveURL(/\/lahenda$/);
    await field(page, "resolution").fill("Klemm pingutatud, kontrollitud termokaameraga");
    await page.getByRole("button", { name: "Lahenda puudus" }).click();

    await expect(page.getByText("Puudus on lahendatud ja lahendus lisati käidupäevikusse.")).toBeVisible();
    await expect(page.getByText("Lahendas: ").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Märgi töös" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Lahenda puudus" })).toHaveCount(0);
    await expectNoHorizontalScroll(page);

    await page.getByRole("link", { name: "Lahenduse sissekanne käidupäevikus" }).click();
    await expect(page.getByText("Klemm pingutatud, kontrollitud termokaameraga").first()).toBeVisible();
    await expect(page.getByText("Remont").first()).toBeVisible();

    // The resolved deficiency stays, in the resolved section.
    await page.goto(`/o/${org.slug}/paigaldised/${installation}/puudused`);
    await page.getByText("Lahendatud (1)").click();
    await expect(page.getByText("Lahtine klemm")).toBeVisible();
  });

  test("a deficiency cannot be resolved twice", async ({ page, browser }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Kilp");
    const deficiency = sql(`insert into public.deficiencies
      (organisation_id, site_id, electrical_installation_id, title, description, severity, created_by)
      values ('${org.id}', '${site}', '${installation}', 'Katkine kate', 'Kate puudu', 'low', '${org.users.admin.id}')
      returning id;`);

    await login(page, org.users.operator, `/o/${org.slug}/puudused/${deficiency}/lahenda`);
    const other = await browser.newPage();
    await login(other, org.users.admin, `/o/${org.slug}/puudused/${deficiency}/lahenda`);

    await field(page, "resolution").fill("Kate paigaldatud");
    await page.getByRole("button", { name: "Lahenda puudus" }).click();
    await expect(page.getByText("Puudus on lahendatud")).toBeVisible();

    await field(other, "resolution").fill("Ka mina parandasin");
    await other.getByRole("button", { name: "Lahenda puudus" }).click();
    await expect(other.getByText("See puudus on juba lahendatud.")).toBeVisible();
    await other.close();
    expect(sql(`select count(*) from public.log_entries where deficiency_id = '${deficiency}';`)).toBe("1");
  });

  test("viewer is read-only; filters narrow the list", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Kilp");
    sql(`insert into public.deficiencies
      (organisation_id, site_id, electrical_installation_id, title, description, severity, due_on, created_by)
      values ('${org.id}', '${site}', '${installation}', 'Kriitiline rike', 'x', 'critical', current_date - 2, '${org.users.admin.id}'),
             ('${org.id}', '${site}', '${installation}', 'Väike märkus', 'y', 'low', null, '${org.users.admin.id}');`);

    await login(page, org.users.viewer, `/o/${org.slug}/puudused`);
    const list = page.getByRole("list", { name: "Puudused" });
    await expect(list.getByText("Kriitiline rike")).toBeVisible();
    await expect(list.getByText("Tähtaeg ületatud")).toBeVisible();
    await expect(page.getByRole("link", { name: "Lisa puudus" })).toHaveCount(0);

    await page.goto(`/o/${org.slug}/puudused?raskus=low`);
    await expect(list.getByText("Väike märkus")).toBeVisible();
    await expect(list.getByText("Kriitiline rike")).toHaveCount(0);
    await page.goto(`/o/${org.slug}/puudused?tahtaeg=uletatud`);
    await expect(list.getByText("Kriitiline rike")).toBeVisible();
    await expect(list.getByText("Väike märkus")).toHaveCount(0);

    await list.getByText("Kriitiline rike").click();
    await expect(page.getByRole("link", { name: "Lahenda puudus" })).toHaveCount(0);
    await page.goto(`/o/${org.slug}/puudused/uus`);
    await expect(page.getByRole("heading", { name: "Ligipääs puudub" })).toBeVisible();
  });
});

test("resolved deficiencies are paginated, with the total shown on the installation", async ({ page }) => {
  const org = await createOrg();
  const site = await createSite(org, "Objekt");
  const installation = await createInstallation(org, site, "Kilp");
  sql(`insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity,
                                        status, resolution, resolved_at, resolved_by, resolved_by_name, created_by)
       select '${org.id}', '${site}', '${installation}', 'Lahendatud ' || lpad(n::text, 2, '0'), 'x', 'low',
              'resolved', 'Korras', now() - make_interval(hours => n), '${org.users.operator.id}', 'Kati', '${org.users.operator.id}'
         from generate_series(1, 51) n;`);
  await login(page, org.users.viewer, `/o/${org.slug}/paigaldised/${installation}/puudused`);
  await page.getByText("Lahendatud (51)").click();
  await page.getByRole("link", { name: "Näita kõiki (51)" }).click();

  const list = page.getByRole("list", { name: "Puudused" });
  await expect(list.getByRole("listitem")).toHaveCount(50);
  await page.getByRole("link", { name: "Järgmine lehekülg" }).click();
  await expect(page).toHaveURL(/seis=resolved/);
  await expect(page).toHaveURL(/lk=2/);
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Eelmine lehekülg" })).toBeVisible();
});
