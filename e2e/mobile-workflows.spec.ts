import { createInstallation, createOrg, createSite, expect, field, login, sql, test } from "./support/fixtures";

test.describe("Välitöö telefonis", () => {
  test("a deficiency is recorded with a photo link in one go; no upload control @responsive", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Peakilp");
    await login(page, org.users.operator, `/o/${org.slug}`);
    await page.goto(`/o/${org.slug}/puudused/uus?paigaldis=${installation}`);

    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await field(page, "title").fill("Lahtine klemm X3");
    await field(page, "description").fill("Klemm X3 lahti, märgid ülekuumenemisest.");
    await page.getByLabel("Fotode link").fill("https://photos.example.com/album/klemm-x3");
    await page.getByRole("button", { name: "Lisa puudus" }).click();

    await expect(page.getByRole("heading", { name: "Lahtine klemm X3" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ava fotode link (photos.example.com) uues aknas" })).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    expect(sql(`select photos_url from public.deficiencies where organisation_id = '${org.id}'`)).toBe(
      "https://photos.example.com/album/klemm-x3",
    );
  });

  test("a lost connection while saving keeps the text and explains what happened @responsive", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Peakilp");
    const formUrl = `/o/${org.slug}/paigaldised/${installation}/paevik/uus`;
    await login(page, org.users.operator, formUrl);

    // Server Actions post to the page URL; drop exactly that request.
    await page.route(`**${formUrl}`, (route) =>
      route.request().method() === "POST" ? route.abort("internetdisconnected") : route.continue(),
    );
    await page.getByText("Hooldus", { exact: true }).click();
    await field(page, "description").fill("Ventilaatori filter vahetatud.");
    await page.getByRole("button", { name: "Salvesta sissekanne" }).click();

    await expect(page.getByText("Ühendus katkes. Kontrolli internetiühendust ja proovi uuesti.")).toBeVisible();
    await expect(field(page, "description")).toHaveValue("Ventilaatori filter vahetatud.");
    expect(sql(`select count(*) from public.log_entries where organisation_id = '${org.id}'`)).toBe("0");

    // Connection back: the same form saves.
    await page.unroute(`**${formUrl}`);
    await page.getByRole("button", { name: "Salvesta sissekanne" }).click();
    await expect(page.getByText("Sissekanne salvestatud.")).toBeVisible();
  });

  test("an unsaved entry survives a reload in the same tab, and is gone once saved", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Peakilp");
    const formUrl = `/o/${org.slug}/paigaldised/${installation}/paevik/uus`;
    await login(page, org.users.operator, formUrl);

    await page.getByText("Mõõtmine", { exact: true }).click();
    await field(page, "description").fill("Isolatsioonitakistus mõõdetud, tulemused protokollis.");
    await page.waitForTimeout(500); // draft is written after a short pause in typing
    await page.reload();

    await expect(page.getByText("Taastasime selle vahekaardi salvestamata mustandi.")).toBeVisible();
    await expect(field(page, "description")).toHaveValue("Isolatsioonitakistus mõõdetud, tulemused protokollis.");
    await expect(page.locator('input[name="entryType"][value="measurement"]:visible')).toBeChecked();

    await page.getByRole("button", { name: "Salvesta sissekanne" }).click();
    await expect(page.getByText("Sissekanne salvestatud.")).toBeVisible();
    await page.goto(formUrl);
    await expect(page.getByText("Taastasime selle vahekaardi salvestamata mustandi.")).toHaveCount(0);
    await expect(field(page, "description")).toHaveValue("");
  });
  test("drafts stay with their installation and are removed on sign-out", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const first = await createInstallation(org, site, "Peakilp");
    const second = await createInstallation(org, site, "Lao kilp");
    const formUrl = (id: string) => `/o/${org.slug}/paigaldised/${id}/paevik/uus`;
    await login(page, org.users.operator, formUrl(first));
    await field(page, "description").fill("Poolik kirjeldus peakilbi kohta.");
    await page.waitForTimeout(500);

    await page.goto(formUrl(second));
    await expect(field(page, "description")).toHaveValue("");

    await page.goto(formUrl(first));
    await expect(field(page, "description")).toHaveValue("Poolik kirjeldus peakilbi kohta.");
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith("kaidly:draft:")).length)).toBe(1);

    await page.goto(`/o/${org.slug}`);
    await page.getByRole("button", { name: "Konto" }).first().click();
    await page.getByRole("menuitem", { name: "Logi välja" }).click();
    await page.waitForURL(/\/auth\/login/);
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith("kaidly:draft:")).length)).toBe(0);
  });
});
