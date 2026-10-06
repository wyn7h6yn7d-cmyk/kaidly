import type { BrowserContext } from "@playwright/test";
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
  type TestOrg,
} from "./support/fixtures";

const TODAY = "(now() at time zone 'Europe/Tallinn')::date";

/** An activity due in `days` (inserted directly; the database creates its reminders). */
async function activity(org: TestOrg, title: string, days: number, reminders = "{14}", extra = "'once', null, null") {
  const site = await createSite(org, "Tallinna tehas");
  const installation = await createInstallation(org, site, "Peakilp", "PK-01");
  return sql(`insert into public.scheduled_activities
    (organisation_id, site_id, electrical_installation_id, title, frequency_type, interval_value, interval_unit, next_due_on, reminder_days, created_by)
    values ('${org.id}', '${site}', '${installation}', '${title}', ${extra}, ${TODAY} + ${days}, '${reminders}', '${org.users.admin.id}') returning id;`);
}

async function setLanguage(context: BrowserContext, locale: "en" | "ru" | "et") {
  await context.addCookies([{ name: "kaidly_locale", value: locale, url: "http://localhost:3100" }]);
}

test.describe("Meeldetuletused ja teavitused", () => {
  test("reminder settings on the activity form; the reminder arrives at once with a countdown", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Tallinna tehas");
    const installation = await createInstallation(org, site, "Peakilp", "PK-01");
    await login(page, org.users.admin, `/o/${org.slug}`);
    await page.goto(`/o/${org.slug}/kaidukava/uus?paigaldis=${installation}`);
    await field(page, "title").fill("Peakilbi perioodiline kontroll");
    const due = sql(`select to_char(${TODAY} + 5, 'YYYY-MM-DD')`);
    await field(page, "nextDueOn").fill(due);
    await expect(page.getByRole("group", { name: "Meeldetuletused" }).getByRole("checkbox", { name: "14 päeva enne" })).toBeChecked();
    await page.getByText("30 päeva enne").click();
    await field(page, "reminderCustom").fill("3");
    await page.getByRole("button", { name: "Lisa tegevus" }).click();

    await expect(page.getByRole("heading", { name: "Peakilbi perioodiline kontroll" })).toBeVisible();
    await expect(page.getByText("5 päeva jäänud").first()).toBeVisible();
    await expect(page.getByText("30, 14 ja 3 päeva enne tähtaega")).toBeVisible();
    expect(sql(`select reminder_days::text from public.scheduled_activities where title = 'Peakilbi perioodiline kontroll' and organisation_id = '${org.id}'`)).toBe("{30,14,3}");
    // One reminder per recipient (owner, admin, operator) for the tightest threshold reached.
    expect(sql(`select count(*) || ':' || min(threshold_days) from public.notifications where organisation_id = '${org.id}'`)).toBe("3:14");
    expect(sql(`select count(*) from public.notifications where user_id = '${org.users.viewer.id}'`)).toBe("0");

    await page.reload();
    await expect(page.getByRole("link", { name: "Teavitused, 1 lugemata" }).first()).toBeVisible();
  });

  test("bell, notification centre, direct link marks read, mark one and mark all read @responsive", async ({ page }) => {
    const org = await createOrg();
    const first = await activity(org, "Peakilbi perioodiline kontroll", 14);
    await activity(org, "Termograafia", 6, "{7}");
    await activity(org, "Isolatsioonitakistus", 2, "{7}");
    await login(page, org.users.operator, `/o/${org.slug}`);

    const bell = page.getByRole("link", { name: "Teavitused, 3 lugemata" }).locator("visible=true");
    await expect(bell).toBeVisible();
    await bell.click();
    await expect(page.getByRole("heading", { name: "Teavitused" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    const list = page.getByRole("list", { name: "Teavitused" });
    await expect(list.getByRole("listitem")).toHaveCount(3);
    const row = list.getByRole("listitem").filter({ hasText: "Peakilbi perioodiline kontroll" });
    await expect(row).toContainText("Tallinna tehas · PK-01 Peakilp");
    await expect(row).toContainText("14 päeva jäänud");
    await expect(row).toContainText("Lugemata");

    await row.getByRole("link", { name: "Vaata tegevust" }).click();
    await expect(page).toHaveURL(new RegExp(`/o/${org.slug}/kaidukava/${first}$`));
    await expect(page.getByRole("heading", { name: "Peakilbi perioodiline kontroll" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Teavitused, 2 lugemata" }).locator("visible=true")).toBeVisible();

    await page.goto("/teavitused");
    await list.getByRole("listitem").filter({ hasText: "Termograafia" }).getByRole("button", { name: "Märgi loetuks" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await page.getByRole("button", { name: "Märgi kõik loetuks" }).click();
    await expect(page.getByRole("button", { name: "Märgi kõik loetuks" })).toHaveCount(0);
    await page.getByRole("link", { name: "Lugemata" }).click();
    await expect(page.getByText("Lugemata teavitusi pole.")).toBeVisible();
    await page.getByRole("link", { name: "Kõik" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(3);
    await expect(list.getByText("Lugemata")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Teavitused", exact: true }).locator("visible=true")).toBeVisible();
  });

  test("toast: shown once for a new reminder, stays in the centre afterwards @responsive", async ({ page }) => {
    const org = await createOrg();
    await activity(org, "Hooldus", 14);
    await login(page, org.users.owner, `/o/${org.slug}`);
    const toast = page.getByTestId("reminder-toast");
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("Hooldus");
    await expect(toast).toContainText("Tallinna tehas · PK-01 Peakilp");
    await expect(toast).toContainText("14 päeva jäänud");
    await expect(page.getByRole("status").filter({ has: toast })).toHaveAttribute("aria-live", "polite");
    await expectNoHorizontalScroll(page);
    // Not again on the next page.
    await page.goto(`/o/${org.slug}/objektid`);
    await page.waitForTimeout(1500);
    await expect(toast).toHaveCount(0);
    await page.goto("/teavitused");
    await expect(page.getByRole("list", { name: "Teavitused" })).toContainText("Hooldus");
  });

  test("completing a recurring activity: old reminder becomes history, the countdown moves on", async ({ page }) => {
    const org = await createOrg();
    const id = await activity(org, "Iga-aastane kontroll", 3, "{14}", "'recurring', 1, 'year'");
    await login(page, org.users.operator, `/o/${org.slug}/kaidukava/${id}/tehtud`);
    await page.getByText("Kontroll", { exact: true }).click();
    await page.getByRole("button", { name: "Märgi tehtuks" }).click();
    await expect(page.getByText("Tegevus märgiti tehtuks ja lisati käidupäevikusse.")).toBeVisible();
    expect(sql(`select count(*) from public.notifications where scheduled_activity_id = '${id}' and read_at is null`)).toBe("0");
    expect(sql(`select count(*) from public.notifications where scheduled_activity_id = '${id}'`)).toBe("3");
    await page.goto(`/o/${org.slug}/kaidukava/${id}`);
    const left = sql(`select next_due_on - ${TODAY} from public.scheduled_activities where id = '${id}'`);
    await expect(page.getByText(`${left} päeva jäänud`).first()).toBeVisible();
    await page.goto("/teavitused?vaade=koik");
    await expect(page.getByText("Varasem kordus — tegevus on vahepeal tehtud või ümber planeeritud.")).toBeVisible();
    // Running the generator again changes nothing.
    sql(`select private.generate_activity_reminders();`);
    expect(sql(`select count(*) from public.notifications where scheduled_activity_id = '${id}'`)).toBe("3");
  });

  test("tenant isolation: another company's reminder link leads nowhere; viewers get no reminders", async ({ page }) => {
    test.setTimeout(120_000); // two sign-ins in two browsers: slow on a loaded machine
    const a = await createOrg("Teavitused A");
    const b = await createOrg("Teavitused B");
    await activity(a, "A tegevus", 5);
    const foreign = sql(`select id from public.notifications where organisation_id = '${a.id}' limit 1`);
    await login(page, b.users.owner, "/teavitused");
    await page.goto(`/teavitused/${foreign}`);
    await expect(page).toHaveURL(/\/teavitused$/);
    await expect(page.getByText("A tegevus")).toHaveCount(0);
    expect(sql(`select read_at is null from public.notifications where id = '${foreign}'`)).toBe("t");

    const other = await page.context().browser()!.newContext();
    const viewer = await other.newPage();
    await login(viewer, a.users.viewer, "/teavitused");
    await viewer.goto("/teavitused?vaade=koik");
    await expect(viewer.getByText("Teavitusi pole.")).toBeVisible();
    await other.close();
  });

  test("countdown and notifications in English and Russian", async ({ page, context }) => {
    const org = await createOrg();
    await activity(org, "Hooldus", 1, "{7}");
    await setLanguage(context, "en");
    await login(page, org.users.owner, "/teavitused");
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(page.getByText("1 day left").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "View activity" }).first()).toBeVisible();
    await setLanguage(context, "ru");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Уведомления" })).toBeVisible();
    await expect(page.getByText("Остался 1 день").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Уведомления, непрочитанных: 1/ }).locator("visible=true")).toBeVisible();
  });
});
