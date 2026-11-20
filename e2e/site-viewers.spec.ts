import type { BrowserContext, Page } from "@playwright/test";
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
  type TestOrg,
  type TestUser,
} from "./support/fixtures";

/** Company with sites A and B, content in both; returns ids. */
async function setup() {
  const org = await createOrg("Vaataja Test OÜ");
  const siteA = await createSite(org, "Mustamäe tee 5 korteriühistu", "Mustamäe tee 5, Tallinn");
  const siteB = await createSite(org, "Teine objekt");
  const instA = await createInstallation(org, siteA, "Peajaotuskilp", "PJK-1");
  const instB = await createInstallation(org, siteB, "Teise objekti kilp", "TK-9");
  const op = org.users.operator.id;
  sql(`
    insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
    values ('${org.id}', '${siteA}', '${instA}', 'inspection', 'A objekti ülevaatus tehtud', '${op}'),
           ('${org.id}', '${siteB}', '${instB}', 'inspection', 'B objekti salajane kanne', '${op}');
    insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, created_by)
    values ('${org.id}', '${siteA}', '${instA}', 'Kilbi uks ei sulgu', 'x', 'medium', '${op}');
    insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, created_by, status, resolution, resolved_at, resolved_by, resolved_by_name)
    values ('${org.id}', '${siteA}', '${instA}', 'Märgistus puudus', 'x', 'low', '${op}', 'resolved', 'Märgistus lisatud', now(), '${op}', 'Kati Käitaja');
    insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on)
    values ('${org.id}', '${siteA}', '${instA}', 'Termograafia', 'once', (now() at time zone 'Europe/Tallinn')::date + 20);
    insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes, status, ready_at, uploaded_by, external_url)
    values ('${org.id}', '${siteA}', '${instA}', 'single_line_diagram', 'Ühejooneskeem', 'skeem', 'application/pdf', 1, 'ready', now(), '${org.users.admin.id}', 'https://drive.example.com/skeem');`);
  return { org, siteA, siteB };
}

/** The admin invites `email` to site A through the site page and returns the link. */
async function invite(page: Page, org: TestOrg, siteA: string, email: string) {
  await login(page, org.users.admin, `/o/${org.slug}/objektid/${siteA}`);
  const panel = page.getByTestId("site-viewers");
  await expect(panel.getByRole("heading", { name: "Objekti vaatajad" })).toBeVisible();
  await expect(panel).toContainText("nt objekti omanik või korteriühistu juhatus");
  await panel.getByLabel("Vaataja e-post").fill(email);
  await expect(panel.getByRole("checkbox", { name: "Mustamäe tee 5 korteriühistu" })).toBeChecked();
  await expect(panel.getByRole("checkbox", { name: "Teine objekt" })).not.toBeChecked();
  await panel.getByRole("button", { name: "Loo kutse link" }).click();
  const link = panel.getByRole("textbox", { name: "Kutse link on valmis" });
  await expect(link).toHaveValue(/\/vaataja-kutse\/[A-Za-z0-9_-]{43}$/);
  await expect(panel.getByRole("link", { name: "Saada e-postiga" })).toHaveAttribute("href", new RegExp(`^mailto:${encodeURIComponent(email).replace(".", "\\.")}\\?subject=`));
  return new URL(await link.inputValue()).pathname;
}

async function viewerPage(context: BrowserContext) {
  return context.browser()!.newPage();
}

test.describe("Objekti vaataja", () => {
  test("invite → accept → sees only site A, read-only; other sites and URLs are 404; revoking ends access at once @responsive", async ({ page, context }) => {
    test.setTimeout(120_000);
    const { org, siteA, siteB } = await setup();
    const viewer: TestUser = await createUser("Juhatuse Liige");
    const seatsBefore = sql(`select private.seats_used('${org.id}')`);
    const path = await invite(page, org, siteA, viewer.email);

    const v = await viewerPage(context);
    await v.setViewportSize(page.viewportSize()!);
    await login(v, viewer, path);
    await expect(v.getByText("Mustamäe tee 5 korteriühistu").first()).toBeVisible();
    await v.getByRole("button", { name: "Võta kutse vastu" }).click();
    await expect(v).toHaveURL(new RegExp(`/vaade/${siteA}$`));

    // Everything of site A, nothing of site B.
    await expect(v.getByRole("heading", { name: "Mustamäe tee 5 korteriühistu", level: 1 })).toBeVisible();
    await expect(v.getByTestId("read-only")).toHaveText("Ainult vaatamiseks");
    await expect(v.getByRole("region", { name: "Paigaldised" })).toContainText("Peajaotuskilp");
    await expect(v.getByRole("region", { name: "Käidukava tähtajad" })).toContainText("Termograafia");
    await expect(v.getByRole("region", { name: "Käidupäevik" })).toContainText("A objekti ülevaatus tehtud");
    await expect(v.getByRole("region", { name: "Puudused" })).toContainText("Kilbi uks ei sulgu");
    await expect(v.getByRole("region", { name: "Puudused" })).toContainText("Märgistus lisatud");
    await expect(v.getByRole("link", { name: /Ava link/ })).toHaveAttribute("href", "https://drive.example.com/skeem");
    await expect(v.locator("body")).not.toContainText(/B objekti salajane kanne|Teise objekti kilp|Teine objekt/);
    // No way to change anything.
    await expect(v.locator("main form:visible")).toHaveCount(0);
    await expect(v.getByRole("button", { name: /Lisa|Muuda|Salvesta|Kustuta|Arhiveeri/ })).toHaveCount(0);
    await expectNoHorizontalScroll(v);

    // PDF report of site A downloads; site B and the company's own pages are not found.
    const pdf = await v.request.get(`/vaade/${siteA}/aruanne`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    for (const url of [`/vaade/${siteB}/aruanne`, `/o/${org.slug}/aruanded/site/eksport?format=pdf&objekt=${siteA}`, `/o/${org.slug}/aruanded/log/eksport?format=csv`]) {
      expect((await v.request.get(url, { maxRedirects: 0 })).status(), url).toBe(404);
    }
    // Pages: another site by URL or by changing the id, and the company's own pages.
    for (const url of [`/vaade/${siteB}`, `/vaade/${siteA.replace(/.$/, (c) => (c === "0" ? "1" : "0"))}`, `/o/${org.slug}/objektid/${siteA}`, `/o/${org.slug}/paevik`]) {
      await v.goto(url);
      await expect(v.getByRole("heading", { name: /Lehte ei leitud|Ettevõtet ei leitud/ }), url).toBeVisible();
      await expect(v.locator("body")).not.toContainText(/B objekti salajane kanne|A objekti ülevaatus tehtud/);
    }

    // Viewers do not take a seat.
    expect(sql(`select private.seats_used('${org.id}')`)).toBe(seatsBefore);

    // The admin sees the viewer and removes access; the viewer's next request is a 404.
    await page.reload();
    const panel = page.getByTestId("site-viewers");
    await expect(panel.getByRole("list", { name: "Objekti vaatajad" })).toContainText("Juhatuse Liige");
    page.once("dialog", (d) => d.accept());
    await panel.getByRole("button", { name: "Võta õigus ära: Juhatuse Liige" }).click();
    await expect(panel).toContainText("Sellel objektil ei ole vaatajaid.");
    await v.goto(`/vaade/${siteA}`);
    await expect(v.getByRole("heading", { name: "Lehte ei leitud" })).toBeVisible();
    await expect(v.locator("body")).not.toContainText("A objekti ülevaatus tehtud");
    expect((await v.request.get(`/vaade/${siteA}/aruanne`)).status()).toBe(404);
    await v.close();
  });

  test("an unpaid company shows its viewers nothing; operators cannot invite", async ({ page, context }) => {
    const { org, siteA } = await setup();
    const viewer = await createUser("Omanik Objektil");
    const path = await invite(page, org, siteA, viewer.email);
    const v = await viewerPage(context);
    await login(v, viewer, path);
    await v.getByRole("button", { name: "Võta kutse vastu" }).click();
    await expect(v).toHaveURL(new RegExp(`/vaade/${siteA}$`));

    sql(`update private.organisation_access set trial_started_at = now() - interval '30 days', trial_ends_at = now() - interval '16 days',
           full_access_from = null, full_access_until = null where organisation_id = '${org.id}';`);
    expect((await v.request.get(`/vaade/${siteA}/aruanne`)).status()).toBe(404);
    await v.goto(`/vaade/${siteA}`);
    await expect(v.getByRole("heading", { name: "Lehte ei leitud" })).toBeVisible();
    await v.goto("/vaade");
    await expect(v.getByText("Sul ei ole praegu ühtegi objekti vaatamiseks")).toBeVisible();
    await v.close();

    // The panel is for owners and admins only.
    const op = await viewerPage(context);
    sql(`update private.organisation_access set trial_started_at = now(), trial_ends_at = now() + interval '14 days' where organisation_id = '${org.id}';`);
    await login(op, org.users.operator, `/o/${org.slug}/objektid/${siteA}`);
    await expect(op.getByRole("heading", { name: "Mustamäe tee 5 korteriühistu", level: 1 })).toBeVisible();
    await expect(op.getByTestId("site-viewers")).toHaveCount(0);
    await op.close();
  });

  test("English and Russian", async ({ page, context }) => {
    const { org, siteA } = await setup();
    await context.addCookies([{ name: "kaidly_locale", value: "en", url: "http://localhost:3100" }]);
    await login(page, org.users.admin, `/o/${org.slug}/objektid/${siteA}`);
    await expect(page.getByRole("heading", { name: "Site viewers" })).toBeVisible();
    await context.addCookies([{ name: "kaidly_locale", value: "ru", url: "http://localhost:3100" }]);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Наблюдатели объекта" })).toBeVisible();
  });
});
