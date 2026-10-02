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
} from "./support/fixtures";

test.describe("Ettevõtte kustutamine ja deaktiveerimine", () => {
  test("an owner deletes their only, empty organisation and lands on 'no active organisation' @responsive", async ({ page }) => {
    const owner = await createUser("Ainus Omanik");
    await login(page, owner, "/o/uus");
    await field(page, "name").fill("Kustutatav OÜ");
    await page.getByRole("button", { name: "Loo ettevõte" }).click();
    await expect(page.getByRole("heading", { name: "Ettevõte on valmis." })).toBeVisible();

    await page.goto(page.url().replace(/\?.*$/, "") + "/seaded");
    await page.getByRole("link", { name: "Kustuta või deaktiveeri ettevõte" }).click();
    await expect(page.getByRole("heading", { name: "Kustuta ettevõte jäädavalt" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    const submit = page.getByRole("button", { name: "Kustuta ettevõte jäädavalt" });
    await expect(submit).toBeDisabled();
    await page.getByLabel(/Kinnitamiseks kirjuta ettevõtte nimi/).fill("Kustutatav");
    await expect(submit).toBeDisabled();
    await page.getByLabel(/Kinnitamiseks kirjuta ettevõtte nimi/).fill("Kustutatav OÜ");
    await submit.click();

    await expect(page).toHaveURL(/\/o$/);
    await expect(page.getByRole("heading", { name: "Sul pole aktiivset ettevõtet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Loo ettevõte" }).first()).toBeVisible();
    expect(sql(`select count(*) from public.organisations where name = 'Kustutatav OÜ'`)).toBe("0");
    // The account survives and can create a new organisation.
    expect(sql(`select count(*) from public.profiles where id = '${owner.id}'`)).toBe("1");
  });

  test("an organisation with history can only be deactivated; it becomes read-only and the owner can restore it", async ({ page }) => {
    const org = await createOrg("Ajalooga OÜ");
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Kilp");
    sql(`insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
         values ('${org.id}', '${site}', '${installation}', 'inspection', 'Ülevaatus', '${org.users.operator.id}');`);
    await login(page, org.users.owner, `/o/${org.slug}/seaded/kustuta`);

    await expect(page.getByRole("heading", { name: "Deaktiveeri ettevõte" })).toBeVisible();
    await expect(page.getByText(/Ajaloolisi käiduandmeid ei kustutata enne, kui andmete säilitamise reeglid on kinnitatud/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Kustuta ettevõte jäädavalt" })).toHaveCount(0);
    await page.getByLabel(/Kinnitamiseks kirjuta ettevõtte nimi/).fill("Ajalooga OÜ");
    await page.getByRole("button", { name: "Deaktiveeri ettevõte" }).click();

    await expect(page).toHaveURL(/\/o$/);
    await expect(page.getByRole("list", { name: "Deaktiveeritud ettevõtted" }).getByText("Ajalooga OÜ")).toBeVisible();
    expect(sql(`select count(*) from public.log_entries where organisation_id = '${org.id}'`)).toBe("1");

    // Any page of the organisation shows the notice; writes are refused by the database.
    await page.goto(`/o/${org.slug}/paevik`);
    await expect(page.getByRole("heading", { name: "Ettevõte on deaktiveeritud" })).toBeVisible();
    await page.getByRole("button", { name: "Taasta ettevõte" }).click();
    await expect(page.getByRole("heading", { name: "Ajalooga OÜ" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mis vajab tähelepanu" })).toBeVisible();
  });

  test("admins can't delete or deactivate; members of a deactivated organisation see who can restore it", async ({ page, browser }) => {
    const org = await createOrg();
    await login(page, org.users.admin, `/o/${org.slug}/seaded`);
    await expect(page.getByRole("link", { name: "Kustuta või deaktiveeri ettevõte" })).toHaveCount(0);
    await page.goto(`/o/${org.slug}/seaded/kustuta`);
    await expect(page.getByRole("heading", { name: "Ligipääs puudub" })).toBeVisible();

    sql(`update public.organisations set deactivated_at = now() where id = '${org.id}';`);
    const other = await browser.newContext();
    const viewer = await other.newPage();
    await login(viewer, org.users.viewer, `/o/${org.slug}`);
    await expect(viewer.getByRole("heading", { name: "Ettevõte on deaktiveeritud" })).toBeVisible();
    await expect(viewer.getByText("Ettevõtte saab taastada selle omanik.")).toBeVisible();
    await expect(viewer.getByRole("button", { name: "Taasta ettevõte" })).toHaveCount(0);
    await other.close();
  });

  test("deleting one organisation leaves the others; switching still works", async ({ page }) => {
    const first = await createOrg("Esimene OÜ");
    const second = await createOrg("Teine OÜ");
    sql(`insert into public.organisation_members (organisation_id, user_id, role)
         values ('${second.id}', '${first.users.owner.id}', 'owner');`);
    await login(page, first.users.owner, `/o/${first.slug}/seaded/kustuta`);
    await page.getByLabel(/Kinnitamiseks kirjuta ettevõtte nimi/).fill("Esimene OÜ");
    await page.getByRole("button", { name: "Kustuta ettevõte jäädavalt" }).click();
    // The only remaining active organisation opens directly.
    await expect(page.getByRole("heading", { name: "Teine OÜ" })).toBeVisible();
    expect(sql(`select count(*) from public.organisations where id = '${second.id}'`)).toBe("1");
    expect(sql(`select count(*) from public.organisation_members where organisation_id = '${second.id}'`)).toBe("5");
  });
});
