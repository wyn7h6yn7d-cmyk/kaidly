import type { BrowserContext } from "@playwright/test";
import { createInstallation, createOrg, createSite, expect, expectNoHorizontalScroll, login, sql, test, type TestOrg, uniqueId } from "./support/fixtures";

async function seed(org: TestOrg, tag: string) {
  const site = await createSite(org, `Tallinna tehas ${tag}`);
  const installation = await createInstallation(org, site, `Peajaotuskilp ${tag}`, `PK-${tag}`);
  const entry = sql(`insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
    values ('${org.id}', '${site}', '${installation}', 'measurement', 'Termograafiline ${tag} kontroll', '${org.users.operator.id}') returning id;`);
  const activity = sql(`insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on)
    values ('${org.id}', '${site}', '${installation}', 'Isolatsioon ${tag}', 'once', (now() at time zone 'Europe/Tallinn')::date + 40) returning id;`);
  const deficiency = sql(`insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, created_by)
    values ('${org.id}', '${site}', '${installation}', 'Klemm ${tag}', 'X3 lahti', 'high', '${org.users.operator.id}') returning id;`);
  const document = sql(`insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes, status, ready_at, uploaded_by)
    values ('${org.id}', '${site}', '${installation}', 'measurement_protocol', 'Mõõteprotokoll ${tag}', 'protokoll-${tag}.pdf', 'application/pdf', 10, 'ready', now(), '${org.users.admin.id}') returning id;`);
  return { site, installation, entry, activity, deficiency, document };
}

/** The saved profile language wins over the cookie, so set both. */
async function setLanguage(context: BrowserContext, locale: "en" | "ru", userId: string) {
  sql(`update public.profiles set preferred_locale = '${locale}' where id = '${userId}';`);
  await context.addCookies([{ name: "kaidly_locale", value: locale, url: "http://localhost:3100" }]);
}

test.describe("Otsing", () => {
  test("finds every kind of record, grouped, with direct links; never another tenant's", async ({ page }) => {
    test.setTimeout(120_000);
    const tag = uniqueId("s").replace(/[^a-z0-9]/gi, "").slice(-6);
    const a = await createOrg();
    const b = await createOrg();
    const ids = await seed(a, tag);
    await seed(b, `${tag}b`);

    await login(page, a.users.viewer, `/o/${a.slug}`);
    // The shortcut listener lives in the app shell, which streams in after the first paint.
    await page.locator('a[href="/otsing"]:visible').first().waitFor();
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Control+k");
    await expect(page).toHaveURL(/\/otsing$/);
    await expect(page.getByLabel("Otsi KAIDLYst")).toBeFocused();

    const search = async (q: string) => {
      await page.goto(`/otsing?q=${encodeURIComponent(q)}`);
      await expect(page.getByRole("main").getByRole("status")).toBeVisible();
    };
    await search(tag);
    for (const group of ["Objektid", "Elektripaigaldised", "Käidupäevik", "Käidukava", "Puudused", "Dokumendid"]) {
      await expect(page.getByRole("heading", { name: group })).toBeVisible();
    }
    // Only A's records, although B's names contain the same tag.
    await expect(page.getByText(`${tag}b`)).toHaveCount(0);

    const open = async (name: RegExp | string, url: RegExp) => {
      await search(tag);
      await page.getByRole("link", { name }).first().click();
      await expect(page).toHaveURL(url);
    };
    await open(`Tallinna tehas ${tag}`, new RegExp(`/objektid/${ids.site}$`));
    await open(new RegExp(`PK-${tag} Peajaotuskilp`), new RegExp(`/paigaldised/${ids.installation}$`));
    await open(/Termograafiline/, new RegExp(`/paevik/${ids.entry}$`));
    await open(`Isolatsioon ${tag}`, new RegExp(`/kaidukava/${ids.activity}$`));
    await open(`Klemm ${tag}`, new RegExp(`/puudused/${ids.deficiency}$`));
    await open(`Mõõteprotokoll ${tag}`, new RegExp(`/dokumendid/${ids.document}$`));

    // Localised entry type: "Mõõtmine" finds the measurement entry.
    await search("Mõõtmine");
    await expect(page.getByText(new RegExp(`Termograafiline ${tag} kontroll`))).toBeVisible();
    await search(`${tag}b`);
    await expect(page.getByText(/ei leitud midagi/)).toBeVisible();
  });

  test("expired companies stay searchable; mobile search from the top bar @responsive", async ({ page }) => {
    const tag = uniqueId("x").replace(/[^a-z0-9]/gi, "").slice(-6);
    const org = await createOrg();
    await seed(org, tag);
    sql(`update private.organisation_access set trial_started_at = now() - interval '20 days', trial_ends_at = now() - interval '6 days' where organisation_id = '${org.id}';`);
    await login(page, org.users.owner, `/o/${org.slug}`);
    await page.locator('a[href="/otsing"]:visible').first().click();
    await page.getByLabel("Otsi KAIDLYst").fill(tag);
    await page.getByRole("button", { name: "Otsi", exact: true }).click();
    await expect(page.getByRole("link", { name: `Klemm ${tag}` })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("search speaks English and Russian", async ({ page, context }) => {
    const tag = uniqueId("l").replace(/[^a-z0-9]/gi, "").slice(-6);
    const org = await createOrg();
    await seed(org, tag);
    await setLanguage(context, "en", org.users.owner.id);
    await login(page, org.users.owner, "/otsing");
    await page.goto(`/otsing?q=${tag}`);
    await expect(page.getByRole("heading", { name: "Electrical installations" })).toBeVisible();
    await setLanguage(context, "ru", org.users.owner.id);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Электроустановки" })).toBeVisible();
  });
});
