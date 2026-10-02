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

test.describe("Käidukava", () => {
  test("admin plans, operator completes, the log entry appears and the date advances @responsive", async ({
    page,
    browser,
  }) => {
    const org = await createOrg();
    const site = await createSite(org, "Tootmishoone");
    const installation = await createInstallation(org, site, "Peajaotuskilp", "PJK-1");

    // Admin creates a monthly activity from the installation (context not asked again).
    await login(page, org.users.admin, `/o/${org.slug}/paigaldised/${installation}/kaidukava`);
    await page.getByRole("link", { name: /Lisa (esimene )?tegevus/ }).first().click();
    await expect(page.locator('input[type="hidden"][name="installationId"]')).toHaveCount(1);
    await expect(page.locator('select[name="installationId"]')).toHaveCount(0);
    await field(page, "title").fill("Kilbi visuaalne kontroll");
    await field(page, "intervalValue").fill("1");
    await field(page, "intervalUnit").selectOption("month");
    await field(page, "nextDueOn").fill("2031-01-31");
    await page.getByRole("button", { name: "Lisa tegevus" }).click();
    await expect(page.getByRole("heading", { name: "Kilbi visuaalne kontroll" })).toBeVisible();
    await expect(page.getByText("Iga kuu")).toBeVisible();

    // Operator completes it.
    const operator = await browser.newPage({ viewport: page.viewportSize() ?? undefined });
    await login(operator, org.users.operator, page.url().replace(/^https?:\/\/[^/]+/, ""));
    await expect(operator.getByRole("link", { name: "Muuda tegevust" })).toHaveCount(0);
    await operator.getByRole("link", { name: "Märgi tehtuks" }).first().click();
    await expect(operator.getByText(/Tähtaeg 31\.01\.2031\./)).toBeVisible();
    await expect(field(operator, "description")).toHaveValue("Kilbi visuaalne kontroll");
    await field(operator, "result").fill("Korras");
    await operator.getByRole("button", { name: "Märgi tehtuks" }).click();

    await expect(operator.getByText("Tegevus märgiti tehtuks ja lisati käidupäevikusse.")).toBeVisible();
    // Anchored monthly schedule: 31 Jan → 28 Feb.
    await expect(operator.getByText("28.02.2031").first()).toBeVisible();
    await expect(operator.getByText("(tähtaeg 31.01.2031)")).toBeVisible();
    await expectNoHorizontalScroll(operator);

    // The completion is in the operating log.
    await operator.goto(`/o/${org.slug}/paigaldised/${installation}/paevik`);
    await expect(operator.getByText("Kilbi visuaalne kontroll")).toBeVisible();
    await expect(operator.getByText("Tulemus: Korras")).toBeVisible();
    await operator.close();
  });

  test("completing the same due date twice is refused", async ({ page, browser }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Kilp");
    const activity = sql(`insert into public.scheduled_activities
      (organisation_id, site_id, electrical_installation_id, title, frequency_type, interval_value, interval_unit, next_due_on)
      values ('${org.id}', '${site}', '${installation}', 'Mõõtmine', 'recurring', 1, 'year', '2031-05-01') returning id;`);

    // Two operators open the completion form for the same due date.
    await login(page, org.users.operator, `/o/${org.slug}/kaidukava/${activity}/tehtud`);
    const other = await browser.newPage();
    await login(other, org.users.admin, `/o/${org.slug}/kaidukava/${activity}/tehtud`);

    await page.getByRole("button", { name: "Märgi tehtuks" }).click();
    await expect(page.getByText("Tegevus märgiti tehtuks")).toBeVisible();
    await other.getByRole("button", { name: "Märgi tehtuks" }).click();
    await expect(other.getByText(/See tähtaeg on juba tehtuks märgitud/)).toBeVisible();
    await other.close();

    expect(sql(`select count(*) from public.log_entries where scheduled_activity_id = '${activity}';`)).toBe("1");
  });

  test("operators and viewers cannot change the plan; overdue is shown calmly", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Kilp");
    sql(`insert into public.scheduled_activities
      (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on)
      values ('${org.id}', '${site}', '${installation}', 'Hilinenud mõõtmine', 'once', (now() at time zone 'Europe/Tallinn')::date - 3);`);

    await login(page, org.users.viewer, `/o/${org.slug}/kaidukava`);
    const list = page.getByRole("list", { name: "Käidukava tegevused" });
    await expect(list.getByText("Hilinenud mõõtmine")).toBeVisible();
    await expect(list.getByText("Üle tähtaja")).toBeVisible();
    await expect(list.getByText("· 3 päeva")).toBeVisible();
    await expect(page.getByRole("link", { name: "Märgi tehtuks" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Lisa tegevus" })).toHaveCount(0);

    await page.goto(`/o/${org.slug}/kaidukava/uus`);
    await expect(page.getByRole("heading", { name: "Ligipääs puudub" })).toBeVisible();

    await page.goto(`/o/${org.slug}/kaidukava?seis=overdue`);
    await expect(page.getByText("Hilinenud mõõtmine")).toBeVisible();
    await page.goto(`/o/${org.slug}/kaidukava?seis=upcoming`);
    await expect(page.getByText("Valitud filtritega tegevusi ei leitud.")).toBeVisible();
  });
});
