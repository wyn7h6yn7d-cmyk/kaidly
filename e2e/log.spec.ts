import {
  createInstallation,
  createOrg,
  createSite,
  expect,
  expectNoHorizontalScroll,
  field,
  login,
  test,
} from "./support/fixtures";

test.describe("Käidupäevik", () => {
  test("operator adds an entry from the installation in a few steps @responsive", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Tallinna logistikakeskus");
    const installation = await createInstallation(org, site, "Peajaotuskilp", "PJK-1");
    await login(page, org.users.operator, `/o/${org.slug}/paigaldised/${installation}`);

    await page.getByRole("link", { name: "Lisa sissekanne" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/paigaldised/${installation}/paevik/uus$`));
    // Context is known: no site or installation pickers on the form.
    await expect(field(page, "siteId")).toHaveCount(0);
    await page.getByText("Kontroll", { exact: true }).click();
    await field(page, "description").fill("Visuaalne kontroll, kõik korras");
    await page.getByRole("button", { name: "Salvesta sissekanne" }).click();

    await expect(page).toHaveURL(new RegExp(`/paigaldised/${installation}/paevik\\?salvestatud=1$`));
    await expect(page.getByText("Sissekanne salvestatud.")).toBeVisible();
    await expect(page.getByText("Visuaalne kontroll, kõik korras")).toBeVisible();
    await expect(page.getByText("Kirja pannud: Kati Käitaja")).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("empty log invites the first entry; viewers get no button", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Kilp");

    await login(page, org.users.viewer, `/o/${org.slug}/paigaldised/${installation}/paevik`);
    await expect(page.getByText("Käidupäevikus pole veel sissekandeid.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Lisa (esimene )?sissekanne/ })).toHaveCount(0);

    await page.goto(`/o/${org.slug}/paigaldised/${installation}/paevik/uus`);
    await expect(page.getByRole("heading", { name: "Ligipääs puudub" })).toBeVisible();
  });

  test("validation error keeps what was typed", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Kilp");
    await login(page, org.users.operator, `/o/${org.slug}/paigaldised/${installation}/paevik/uus`);

    await page.getByText("Mõõtmine", { exact: true }).click();
    await field(page, "description").fill("Isolatsioonitakistuse mõõtmine");
    await page.getByText("Lisa tulemus või muuda aega ja teostajat").click();
    await field(page, "result").fill("> 500 MΩ");
    await field(page, "occurredAt").fill("2999-01-01T10:00");
    await page.getByRole("button", { name: "Salvesta sissekanne" }).click();

    await expect(page.getByText("Toimumise aeg ei saa olla tulevikus.")).toBeVisible();
    await expect(field(page, "description")).toHaveValue("Isolatsioonitakistuse mõõtmine");
    await expect(field(page, "result")).toHaveValue("> 500 MΩ");
    await expect(page.locator('input[name="entryType"][value="measurement"]:checked')).toHaveCount(1);
  });

  test("correction keeps the original and shows the relationship", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Kilp");
    await login(page, org.users.operator, `/o/${org.slug}/paigaldised/${installation}/paevik/uus`);

    await page.getByText("Hooldus", { exact: true }).click();
    await field(page, "description").fill("Klemmide pingutamine");
    await page.getByRole("button", { name: "Salvesta sissekanne" }).click();
    await page.getByText("Klemmide pingutamine").click();

    // Append-only UI: there is no edit, only "Paranda sissekanne".
    await expect(page.getByRole("link", { name: /^Muuda/ })).toHaveCount(0);
    await page.getByRole("link", { name: "Paranda sissekanne" }).click();
    await expect(
      page.getByText(
        "Algset sissekannet ei muudeta. Parandus lisatakse käidupäevikusse uue sissekandena.",
      ),
    ).toBeVisible();
    await field(page, "description").fill("Klemmide pingutamine, kilp JK-2");
    await page.getByRole("button", { name: "Salvesta parandus" }).click();
    await expect(page.getByText("Paranduse põhjus")).toBeVisible(); // reason is required
    await field(page, "correctionReason").fill("Kilbi tähis puudus");
    await page.getByRole("button", { name: "Salvesta parandus" }).click();

    await expect(page.getByRole("heading", { name: "Ajalugu" })).toBeVisible();
    await expect(page.getByText("Algne sissekanne")).toBeVisible();
    await expect(page.getByText("Parandus 1")).toBeVisible();
    await expect(page.getByText("Põhjus: Kilbi tähis puudus")).toBeVisible();
    // The original stays readable in the history.
    await expect(
      page.getByRole("listitem").filter({ hasText: "Algne sissekanne" }).getByText("Klemmide pingutamine", { exact: true }),
    ).toBeVisible();

    await page.goto(`/o/${org.slug}/paigaldised/${installation}/paevik`);
    await expect(page.getByText(/^Parandatud /)).toBeVisible();
    // Corrections are not separate rows in the log.
    await expect(page.getByRole("list", { name: "Käidupäeviku sissekanded" }).getByRole("listitem")).toHaveCount(1);
  });

  test("organisation log filters by installation and type", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const first = await createInstallation(org, site, "Esimene kilp", "K-1");
    const second = await createInstallation(org, site, "Teine kilp", "K-2");
    await login(page, org.users.operator, `/o/${org.slug}/paigaldised/${first}/paevik/uus`);
    await page.getByText("Rike", { exact: true }).click();
    await field(page, "description").fill("Kaitse rakendus");
    await page.getByRole("button", { name: "Salvesta sissekanne" }).click();
    await page.goto(`/o/${org.slug}/paigaldised/${second}/paevik/uus`);
    await page.getByText("Kontroll", { exact: true }).click();
    await field(page, "description").fill("Teise kilbi kontroll");
    await page.getByRole("button", { name: "Salvesta sissekanne" }).click();

    await page.goto(`/o/${org.slug}/paevik`);
    await expect(page.getByText("Kaitse rakendus")).toBeVisible();
    await expect(page.getByText("Teise kilbi kontroll")).toBeVisible();

    await page.goto(`/o/${org.slug}/paevik?liik=fault`);
    await expect(page.getByText("Kaitse rakendus")).toBeVisible();
    await expect(page.getByText("Teise kilbi kontroll")).toHaveCount(0);

    await page.goto(`/o/${org.slug}/paevik?paigaldis=${second}`);
    await expect(page.getByText("Teise kilbi kontroll")).toBeVisible();
    await expect(page.getByText("Kaitse rakendus")).toHaveCount(0);
  });
});
