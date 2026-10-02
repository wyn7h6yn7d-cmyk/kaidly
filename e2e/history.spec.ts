import { addMember, createOrg, createUser, expect, field, login, sql, test } from "./support/fixtures";

test.describe("Muudatuste ajalugu", () => {
  test("admins see readable, organisation-scoped history; operators do not @responsive", async ({ page }) => {
    const org = await createOrg("Ajalugu OÜ");
    const other = await createOrg("Võõras OÜ");
    // Changes made through the app as the admin, so the actor is recorded.
    await login(page, org.users.admin, `/o/${org.slug}/objektid/uus`);
    await field(page, "name").fill("Katlamaja");
    await page.getByRole("button", { name: /Lisa objekt/ }).click();
    await expect(page.getByRole("heading", { name: "Katlamaja" })).toBeVisible();
    sql(`insert into public.sites (organisation_id, name) values ('${other.id}', 'Võõras objekt');`);
    const newbie = await createUser("Uus Liige");
    await addMember(org, newbie, "viewer");
    sql(`update public.organisation_members set role = 'operator'
         where organisation_id = '${org.id}' and user_id = '${newbie.id}';`);

    await page.goto(`/o/${org.slug}/seaded`);
    await page.getByRole("link", { name: "Muudatuste ajalugu" }).click();
    const list = page.getByRole("list", { name: "Muudatused" });
    await expect(list.getByText("Objektid: lisati „Katlamaja“")).toBeVisible();
    await expect(list.getByText("Anne Admin").first()).toBeVisible();
    await expect(list.getByText("Uus Liige: roll Vaataja → Käitaja")).toBeVisible();
    await expect(page.getByText(/Võõras/)).toHaveCount(0);
    // Nothing internal leaks into the page.
    await expect(page.getByText(/token|storage_path|updated_at/)).toHaveCount(0);

    // Filter by area.
    await page.getByText("Filtrid").click();
    await field(page, "ala").selectOption({ label: "Liikmed" });
    await page.getByRole("button", { name: "Näita" }).click();
    await expect(list.getByText(/Katlamaja/)).toHaveCount(0);
    await expect(list.getByText("Uus Liige: roll Vaataja → Käitaja")).toBeVisible();
  });

  test("operators and viewers have no history tab and no access", async ({ page }) => {
    const org = await createOrg();
    await login(page, org.users.operator, `/o/${org.slug}/seaded`);
    await expect(page.getByRole("link", { name: "Muudatuste ajalugu" })).toHaveCount(0);
    await page.goto(`/o/${org.slug}/seaded/ajalugu`);
    await expect(page.getByRole("heading", { name: "Ligipääs puudub" })).toBeVisible();
  });
});
