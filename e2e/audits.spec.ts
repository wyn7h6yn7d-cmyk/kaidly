import {
  createInstallation,
  createOrg,
  createSite,
  createUser,
  expect,
  expectNoHorizontalScroll,
  login,
  sql,
  test,
} from "./support/fixtures";

test.describe("Korraline audit ja auditipakett", () => {
  test("an admin records an audit and the next deadline; the site shows the countdown; the package downloads @responsive", async ({ page }) => {
    test.setTimeout(120_000);
    const org = await createOrg("Auditi Test OÜ");
    const site = await createSite(org, "Tehase alajaam", "Tööstuse 1");
    const inst = await createInstallation(org, site, "Alajaam", "AJ-1");
    sql(`insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, created_by, occurred_at)
         values ('${org.id}', '${site}', '${inst}', 'inspection', 'Ülevaatus tehtud', '${org.users.operator.id}', now() - interval '10 days');`);

    await login(page, org.users.admin, `/o/${org.slug}/paigaldised/${inst}`);
    const panel = page.getByTestId("audit-panel");
    await expect(panel).toContainText("Auditi andmeid pole veel lisatud.");
    await panel.getByText("Lisa auditi andmed").first().click();
    const today = sql(`select to_char((now() at time zone 'Europe/Tallinn')::date - 60, 'YYYY-MM-DD')`);
    const next = sql(`select to_char((now() at time zone 'Europe/Tallinn')::date + 80, 'YYYY-MM-DD')`);
    const form = panel.getByTestId("audit-form");
    await form.getByLabel("Auditi kuupäev").fill(today);
    await form.getByLabel("Auditi teinud asutus").fill("Auditor OÜ");
    await form.getByLabel("Tulemus").fill("Positiivne");
    await form.getByLabel("Dokumendi link").fill("https://drive.example.com/audit");
    await form.getByLabel("Järgmise korralise auditi tähtaeg").fill(next);
    await form.getByRole("button", { name: "Lisa auditi andmed" }).click();
    await expect(panel).toContainText("Positiivne");
    await expect(panel.getByTestId("next-audit")).toContainText("80 päeva jäänud");
    await expect(panel.getByRole("link", { name: /Ava dokument/ })).toHaveAttribute("href", "https://drive.example.com/audit");

    // Reminders 90 and 30 days before, as one activity of the operating plan.
    expect(sql(`select reminder_days::text from public.scheduled_activities where electrical_installation_id = '${inst}' and kind = 'periodic_audit' and archived_at is null`)).toBe("{90,30}");

    await page.goto(`/o/${org.slug}/objektid/${site}`);
    await expect(page.getByTestId("nearest-audit")).toContainText("Lähim auditi tähtaeg");
    await expect(page.getByTestId("nearest-audit")).toContainText("80 päeva jäänud");
    await page.getByRole("link", { name: "Auditipakett" }).click();
    await expect(page.getByRole("heading", { name: "Kokkuvõte audiitorile", level: 1 })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/TTJA vorm|ametlik vorm/i);
    await expectNoHorizontalScroll(page);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Laadi alla PDF" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^KAIDLY_Auditipakett_Tehase-alajaam_\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  test("operators see the audit data but cannot record it; another company gets 404; a site viewer downloads their package", async ({ page, context }) => {
    const org = await createOrg("Auditi Kaks OÜ");
    const site = await createSite(org, "Objekt A");
    const inst = await createInstallation(org, site, "Kilp", "K-1");
    const other = await createOrg("Võõras OÜ");
    sql(`insert into public.installation_audits (organisation_id, site_id, electrical_installation_id, audited_on, result, auditor, created_by)
         values ('${org.id}', '${site}', '${inst}', current_date - 100, 'Puudustega', 'Kontroll OÜ', '${org.users.admin.id}');`);

    await login(page, org.users.operator, `/o/${org.slug}/paigaldised/${inst}`);
    const panel = page.getByTestId("audit-panel");
    await expect(panel).toContainText("Puudustega");
    await expect(panel.getByText("Lisa auditi andmed")).toHaveCount(0);
    expect((await page.request.get(`/o/${org.slug}/objektid/${site}/auditipakett/pdf`)).status()).toBe(200);

    const stranger = await context.browser()!.newPage();
    await login(stranger, other.users.owner, `/o/${other.slug}`);
    expect((await stranger.request.get(`/o/${org.slug}/objektid/${site}/auditipakett/pdf`)).status()).toBe(404);
    expect((await stranger.request.get(`/o/${other.slug}/objektid/${site}/auditipakett/pdf`)).status()).toBe(404);
    await stranger.close();

    const viewer = await createUser("Ühistu Juhatus");
    sql(`insert into public.site_viewers (organisation_id, site_id, user_id) values ('${org.id}', '${site}', '${viewer.id}');`);
    const v = await context.browser()!.newPage();
    await login(v, viewer, `/vaade/${site}`);
    await expect(v.getByRole("link", { name: "Auditipakett" })).toBeVisible();
    const res = await v.request.get(`/vaade/${site}/auditipakett`);
    expect(res.status()).toBe(200);
    expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
    expect((await v.request.get(`/vaade/${site.replace(/.$/, (ch) => (ch === "0" ? "1" : "0"))}/auditipakett`)).status()).toBe(404);
    await v.close();
  });
});
