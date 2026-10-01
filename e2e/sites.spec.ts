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

test.describe("Objektid ja paigaldised", () => {
  test("admin creates a site and an installation, edits and archives @responsive", async ({ page }) => {
    const org = await createOrg();
    await login(page, org.users.admin, `/o/${org.slug}/objektid`);
    await expect(page.getByText("Objekte pole veel lisatud")).toBeVisible();
    await page.getByRole("link", { name: "Lisa objekt" }).first().click();
    await field(page, "name").fill("Tallinna logistikakeskus");
    await field(page, "address").fill("Laki 12, Tallinn");
    await page.getByRole("button", { name: "Lisa objekt" }).click();
    await expect(page.getByRole("heading", { name: "Tallinna logistikakeskus" })).toBeVisible();

    await page.getByRole("link", { name: "Lisa paigaldis" }).first().click();
    await field(page, "name").fill("Peajaotuskilp");
    await field(page, "identifier").fill("PJK-1");
    await field(page, "installationType").selectOption("switchboard");
    await page.getByRole("button", { name: "Lisa paigaldis" }).click();
    await expect(page.getByRole("heading", { name: "Peajaotuskilp" })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.getByRole("link", { name: "Muuda paigaldist" }).click();
    await field(page, "status").selectOption("out_of_service");
    await page.getByRole("button", { name: "Salvesta" }).click();
    await expect(page.getByText("Kasutusest väljas").first()).toBeVisible();

    await page.getByRole("link", { name: "Muuda paigaldist" }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Arhiveeri paigaldis" }).click();
    await expect(page.getByText("Arhiveeritud paigaldised (1)")).toBeVisible();
  });

  test("duplicate identifier on the same site is explained", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    await createInstallation(org, site, "Kilp", "PJK-1");
    await login(page, org.users.admin); // login ?next= only accepts paths without a query
    await page.goto(`/o/${org.slug}/paigaldised/uus?objekt=${site}`);
    await field(page, "name").fill("Teine kilp");
    await field(page, "identifier").fill("pjk-1");
    await page.getByRole("button", { name: "Lisa paigaldis" }).click();
    await expect(page.getByText("Sellel objektil on sama tähisega paigaldis juba olemas.")).toBeVisible();
    await expect(field(page, "name")).toHaveValue("Teine kilp");
  });

  test("operator and viewer cannot manage master data", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Kilp");

    for (const role of ["operator", "viewer"] as const) {
      await login(page, org.users[role], `/o/${org.slug}/objektid/${site}`);
      await expect(page.getByRole("heading", { name: "Objekt", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: /Muuda objekti|Lisa paigaldis/ })).toHaveCount(0);
      await page.goto(`/o/${org.slug}/paigaldised/${installation}/muuda`);
      await expect(page.getByRole("heading", { name: "Ligipääs puudub" })).toBeVisible();
      await page.goto(`/o/${org.slug}/objektid/uus`);
      await expect(page.getByRole("heading", { name: "Ligipääs puudub" })).toBeVisible();
      await page.context().clearCookies();
    }
  });

  test("another organisation's site id is not found under my organisation", async ({ page }) => {
    const mine = await createOrg();
    const theirs = await createOrg();
    const theirSite = await createSite(theirs, "Salajane objekt");
    const theirInstallation = await createInstallation(theirs, theirSite, "Salajane kilp");
    await login(page, mine.users.owner, `/o/${mine.slug}/objektid/${theirSite}`);
    await expect(page.getByRole("heading", { name: "Lehte ei leitud" })).toBeVisible();
    await page.goto(`/o/${mine.slug}/paigaldised/${theirInstallation}/paevik`);
    await expect(page.getByRole("heading", { name: "Lehte ei leitud" })).toBeVisible();
    await expect(page.getByText("Salajane kilp")).toHaveCount(0);
  });
});
