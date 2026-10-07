import {
  createInstallation,
  createOrg,
  createSite,
  createUser,
  expect,
  expectNoHorizontalScroll,
  field,
  legacyFile,
  login,
  sql,
  test,
} from "./support/fixtures";

/**
 * Core workflows that must behave the same in every engine. Runs in Chromium with the normal
 * suite, and in Firefox, desktop WebKit (Safari's engine) and mobile WebKit (iPhone 13) with
 * `npm run test:e2e:browsers`. Direct URLs instead of navigation clicks, so the same steps work
 * with the desktop sidebar and the phone's bottom bar.
 */

const today = "(now() at time zone 'Europe/Tallinn')::date";

test.describe("Brauserid", () => {
  test("public pages: landing, language switch, scroll-to-top, password reveal @cross-browser", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Elektripaigaldise käit");
    await expectNoHorizontalScroll(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const top = page.getByRole("button", { name: "Tagasi üles" });
    await expect(top).toBeVisible();
    await top.click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);

    await page.goto("/auth/login");
    await page.waitForLoadState("networkidle");
    await field(page, "password").fill("Proov-parool-1");
    await page.getByRole("button", { name: "Näita parooli" }).click();
    await expect(field(page, "password")).toHaveAttribute("type", "text");
    await expect(field(page, "password")).toHaveValue("Proov-parool-1");
    await expectNoHorizontalScroll(page);

    await page.context().addCookies([{ name: "kaidly_locale", value: "en", url: "http://localhost:3100" }]);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Electrical installation operation");
  });

  test("field work: log entry, activity completion and a deficiency with dates @cross-browser", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Peakilp", "PK-1");
    const activity = sql(`insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, interval_value, interval_unit, next_due_on)
      values ('${org.id}', '${site}', '${installation}', 'Kvartaliülevaatus', 'recurring', 3, 'month', ${today}) returning id;`);
    await login(page, org.users.operator, `/o/${org.slug}/paigaldised/${installation}/paevik/uus`);

    await page.getByText("Kontroll", { exact: true }).click();
    await field(page, "description").fill("Brauseritest: kilbi kontroll, õäöü «jutumärgid».");
    await page.getByRole("button", { name: "Salvesta sissekanne" }).click();
    await expect(page.getByText("Sissekanne salvestatud.")).toBeVisible();
    expect(sql(`select count(*) from public.log_entries where organisation_id = '${org.id}'`)).toBe("1");

    // Completion: the datetime-local default is submitted as is.
    await page.goto(`/o/${org.slug}/kaidukava/${activity}/tehtud`);
    await page.getByRole("button", { name: "Märgi tehtuks" }).click();
    await expect(page.locator("main").getByRole("status")).toContainText("Järgmine tähtaeg");
    expect(sql(`select (next_due_on > ${today})::text from public.scheduled_activities where id = '${activity}'`)).toBe("true");

    // Deficiency with a typed due date (date inputs differ most between engines).
    await page.goto(`/o/${org.slug}/puudused/uus?paigaldis=${installation}`);
    await field(page, "title").fill("Brauseritest puudus");
    await field(page, "description").fill("Kaas puudub.");
    await field(page, "dueOn").fill("2027-03-15");
    await page.getByRole("button", { name: "Lisa puudus" }).click();
    await expect(page.getByRole("heading", { name: "Brauseritest puudus" })).toBeVisible();
    expect(sql(`select due_on::text from public.deficiencies where title = 'Brauseritest puudus' and organisation_id = '${org.id}'`)).toBe("2027-03-15");
    await expectNoHorizontalScroll(page);
  });

  test("documents: add a link, open an earlier file through the signed link, delete it, export reports @cross-browser", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Peakilp", "PK-1");
    const earlier = await legacyFile(org, { site, installation }, org.users.admin, "Vana mõõteprotokoll", "pdf");
    await login(page, org.users.admin, `/o/${org.slug}`);
    await page.goto(`/o/${org.slug}/dokumendid/uus?paigaldis=${installation}`);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await field(page, "title").fill("Mõõteprotokoll PK-1");
    await page.getByLabel("Dokumendi link").fill("https://drive.example.com/pk-1");
    await page.getByRole("button", { name: "Lisa dokument" }).click();
    await expect(page.getByRole("link", { name: "Ava dokument Mõõteprotokoll PK-1 uues aknas" })).toHaveAttribute(
      "href",
      "https://drive.example.com/pk-1",
    );

    // The earlier file opens through the access-checked, short-lived link.
    const opened = await page.request.get(`/o/${org.slug}/dokumendid/${earlier.id}/ava`, { maxRedirects: 0 });
    expect(opened.status()).toBe(302);
    const file = await page.request.get(`/o/${org.slug}/dokumendid/${earlier.id}/ava?lae=1`);
    expect(file.status()).toBe(200);
    expect(file.headers()["content-disposition"]).toContain("attachment");
    await page.goto(`/o/${org.slug}/dokumendid/${earlier.id}`);
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Kustuta fail Vana mõõteprotokoll" }).click();
    await expect(page.getByText("Fail on kustutatud.")).toBeVisible();
    expect(sql(`select count(*) from storage.objects where name = '${earlier.path}'`)).toBe("0");

    for (const format of ["csv", "pdf"] as const) {
      const r = await page.request.get(`/o/${org.slug}/aruanded/documents/eksport?format=${format}`);
      expect(r.status()).toBe(200);
      expect(r.headers()["content-disposition"]).toMatch(new RegExp(`^attachment; filename="KAIDLY_[A-Za-z0-9._-]+\\.${format}"$`));
    }
  });

  test("import, search, notifications and the admin console @cross-browser", async ({ page }) => {
    const org = await createOrg();
    await login(page, org.users.owner, `/o/${org.slug}/seaded/import`);
    await page.getByLabel("CSV-fail").setInputFiles({ name: "objektid.csv", mimeType: "text/csv", buffer: Buffer.from("﻿name;address\nBrauseri objekt;Tee 1\n", "utf8") });
    await page.getByRole("button", { name: "Impordi 1 rida" }).click();
    await expect(page.getByRole("heading", { name: "Imporditi 1 rida." })).toBeVisible();

    await page.goto(`/otsing?q=${encodeURIComponent("Brauseri")}`);
    await expect(page.locator("main")).toContainText("Brauseri objekt");
    await page.goto("/teavitused");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);

    const admin = await createUser("Brauseri Admin");
    sql(`insert into private.platform_admins (user_id) values ('${admin.id}');`);
    await page.context().clearCookies();
    await login(page, admin, "/admin");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto("/admin/deadlines");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
