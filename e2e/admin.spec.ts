import {
  createOrg,
  createUser,
  expect,
  expectNoHorizontalScroll,
  login,
  sql,
  test,
  type TestUser,
  uniqueId,
} from "./support/fixtures";

async function platformAdmin(): Promise<TestUser> {
  const user = await createUser(`Platvormi Admin ${uniqueId("a")}`);
  sql(`select private.bootstrap_platform_admin('${user.email}');`);
  return user;
}

const ADMIN_PATHS = ["/admin", "/admin/users", "/admin/companies", "/admin/deadlines", "/admin/system", "/admin/audit"];

test.describe("KAIDLY Admin", () => {
  test("company owners and other users get the ordinary 404 everywhere under /admin", async ({ page }) => {
    const org = await createOrg("Tavaline OÜ");
    await login(page, org.users.owner, `/o/${org.slug}`);
    await page.locator(`button[aria-label="Konto"]:visible`).first().click();
    await expect(page.getByRole("menuitem", { name: "KAIDLY Admin" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    for (const path of [...ADMIN_PATHS, `/admin/users/${org.users.owner.id}`, `/admin/companies/${org.id}`]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Lehte ei leitud" })).toBeVisible();
      await expect(page.getByText("KAIDLY Admin")).toHaveCount(0);
    }
  });

  test("the platform admin sees the console, the menu entry, and every page @responsive", async ({ page }) => {
    test.setTimeout(120_000);
    const admin = await platformAdmin();
    const name = `Klient ${uniqueId("k")} OÜ`;
    const org = await createOrg(name);
    await login(page, admin, "/o");
    await page.locator(`button[aria-label="Konto"]:visible`).first().click();
    await page.getByRole("menuitem", { name: "KAIDLY Admin" }).click();
    await expect(page.getByRole("heading", { name: "Mis toimub KAIDLYs?" })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.goto(`/admin/companies?q=${encodeURIComponent(name)}`);
    await page.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("Dokumentide ja sissekannete sisu siin ei kuvata.")).toBeVisible();
    await expectNoHorizontalScroll(page);
    for (const path of ["/admin/users", "/admin/deadlines", "/admin/system", "/admin/audit"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
    // The admin is not a member of the customer company and can't open it in the app.
    await page.goto(`/o/${org.slug}`);
    await expect(page.getByRole("heading", { name })).toHaveCount(0);
    expect(sql(`select count(*) from public.organisation_members where user_id = '${admin.id}'`)).toBe("0");
  });

  test("admin actions need a deliberate confirmation and are audited", async ({ page }) => {
    test.setTimeout(120_000);
    const admin = await platformAdmin();
    const org = await createOrg("Toimingute OÜ");
    const target = org.users.viewer;
    await login(page, admin, `/admin/users/${target.id}`);
    await expect(page.getByText("Kasutajana sisse logida ega tema parooli vaadata ei saa")).toBeVisible();

    // Role change through the dialog.
    await page.getByLabel("Muuda rolli").selectOption("operator");
    await page.getByRole("button", { name: "Muuda rolli" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Vaataja → Käitaja");
    await dialog.getByRole("button", { name: "Kinnita" }).click();
    await expect.poll(() => sql(`select role from public.organisation_members where user_id = '${target.id}'`)).toBe("operator");

    // Disabling needs the typed email; the button stays disabled until it matches.
    await page.getByRole("button", { name: "Peata konto" }).click();
    const confirm = page.getByRole("dialog").getByRole("button", { name: "Kinnita" });
    await expect(confirm).toBeDisabled();
    await page.getByRole("dialog").getByLabel(/Kinnitamiseks kirjuta/).fill(target.email);
    await confirm.click();
    await expect.poll(() => sql(`select banned_until is not null from auth.users where id = '${target.id}'`)).toBe("t");
    await expect(page.getByText("Konto peatatud").first()).toBeVisible();

    await page.getByRole("button", { name: "Taasta konto" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Kinnita" }).click();
    await expect.poll(() => sql(`select banned_until is null from auth.users where id = '${target.id}'`)).toBe("t");

    await page.goto("/admin/audit");
    const mine = page.getByRole("row").filter({ hasText: admin.fullName });
    await expect(mine.filter({ hasText: "Roll muudetud" })).toHaveCount(1);
    await expect(mine.filter({ hasText: "Konto peatatud" })).toHaveCount(1);
    await expect(mine.filter({ hasText: "Konto taastatud" })).toHaveCount(1);
    expect(sql(`select count(*) from private.admin_audit_log where admin_user_id = '${admin.id}'`)).toBe("3");
  });

  test("a disabled account can't sign in", async ({ page }) => {
    const user = await createUser("Peatatud Kasutaja");
    sql(`update auth.users set banned_until = now() + interval '100 years' where id = '${user.id}';`);
    await page.goto("/auth/login");
    await page.waitForLoadState("networkidle");
    await page.locator('input[name="email"]:visible').fill(user.email);
    await page.locator('input[name="password"]:visible').fill(user.password);
    await page.locator('form button[type="submit"]:visible').click();
    await expect(page.getByText("See konto on peatatud. Võta ühendust KAIDLY toega.")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("platform-wide deadlines: filters, no archived or resolved items, deactivated companies excluded", async ({ page }) => {
    const admin = await platformAdmin();
    const tag = uniqueId("t");
    const a = await createOrg(`Tähtaegade A ${tag}`);
    const b = await createOrg(`Tähtaegade B ${tag}`);
    for (const [org, title, extra] of [
      [a, `Üle tähtaja ${tag}`, "current_date - 2, null"],
      [a, `Arhiveeritud ${tag}`, "current_date - 2, now()"],
      [b, `Deaktiveeritud ${tag}`, "current_date - 2, null"],
    ] as const) {
      sql(`with s as (insert into public.sites (organisation_id, name) values ('${org.id}', 'Objekt') returning id),
               i as (insert into public.electrical_installations (organisation_id, site_id, name, installation_type)
                     select '${org.id}', id, 'Kilp', 'switchboard' from s returning id, site_id)
           insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on, archived_at, created_by)
           select '${org.id}', site_id, id, '${title}', 'once', ${extra}, '${org.users.owner.id}' from i;`);
    }
    sql(`update public.organisations set deactivated_at = now() where id = '${b.id}';`);
    await login(page, admin, "/admin/deadlines");
    await expect(page.getByText(`Üle tähtaja ${tag}`)).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: `Üle tähtaja ${tag}` })).toContainText("2 päeva üle tähtaja");
    await expect(page.getByText(`Arhiveeritud ${tag}`)).toHaveCount(0);
    await expect(page.getByText(`Deaktiveeritud ${tag}`)).toHaveCount(0);

    await page.getByLabel("Näita ka deaktiveeritud ettevõtteid").check();
    await page.getByRole("button", { name: "Rakenda" }).click();
    await expect(page.getByText(`Deaktiveeritud ${tag}`)).toBeVisible();

    await page.locator('select[name="ettevote"]').selectOption({ label: `Tähtaegade A ${tag}` });
    await page.getByRole("button", { name: "Rakenda" }).click();
    await expect(page.getByText(`Üle tähtaja ${tag}`)).toBeVisible();
    await expect(page.getByText(`Deaktiveeritud ${tag}`)).toHaveCount(0);
  });
});
