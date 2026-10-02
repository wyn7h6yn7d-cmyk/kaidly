import type { APIResponse, BrowserContext } from "@playwright/test";
import { createInstallation, createOrg, createSite, expect, expectNoHorizontalScroll, login, sql, test, type TestOrg } from "./support/fixtures";

async function seed(org: TestOrg) {
  const site = await createSite(org, "Tallinna tehas");
  const installation = await createInstallation(org, site, "Peajaotuskilp", "PK-01");
  const other = await createInstallation(org, site, "Alajaam", "AJ-2");
  const original = sql(`insert into public.log_entries (organisation_id, site_id, electrical_installation_id, occurred_at, entry_type, description, created_by)
    values ('${org.id}', '${site}', '${installation}', now() - interval '3 days', 'inspection', 'Kilbi ülevaatus, kõik korras', '${org.users.operator.id}') returning id;`);
  sql(`insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, correction_of_id, correction_reason, created_by)
    values ('${org.id}', '${site}', '${installation}', 'inspection', 'Kilbi ülevaatus, klemm X3 lahti', '${original}', 'Vale tulemus', '${org.users.operator.id}');
    insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
    values ('${org.id}', '${site}', '${other}', 'maintenance', 'Alajaama hooldus', '${org.users.operator.id}');
    insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on)
    values ('${org.id}', '${site}', '${installation}', 'Hilinenud mõõtmine', 'once', current_date - 3),
           ('${org.id}', '${site}', '${installation}', 'Tuleviku kontroll', 'once', current_date + 60);
    insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, created_by)
    values ('${org.id}', '${site}', '${installation}', 'Lahtine klemm', 'X3', 'critical', '${org.users.operator.id}');
    insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, storage_path, mime_type, size_bytes, status, ready_at, uploaded_by, uploaded_by_name)
    values ('${org.id}', '${site}', '${installation}', 'measurement_protocol', 'Mõõteprotokoll 2026', 'protokoll.pdf', 'org/${org.id}/salajane-tee.pdf', 'application/pdf', 10, 'ready', now(), '${org.users.admin.id}', 'Admin');`);
  return { site, installation };
}

const fileName = (r: APIResponse) => /filename="([^"]+)"/.exec(r.headers()["content-disposition"] ?? "")?.[1] ?? "";

/** The saved profile language wins over the cookie, so set both. */
async function setLanguage(context: BrowserContext, locale: "en" | "ru", userId: string) {
  sql(`update public.profiles set preferred_locale = '${locale}' where id = '${userId}';`);
  await context.addCookies([{ name: "kaidly_locale", value: locale, url: "http://localhost:3100" }]);
}

test.describe("Aruanded", () => {
  test("operating log: filters, corrections, preview, PDF and CSV exports @responsive", async ({ page }) => {
    test.setTimeout(120_000);
    const org = await createOrg();
    const { installation } = await seed(org);
    await login(page, org.users.operator, `/o/${org.slug}/aruanded`);
    for (const title of ["Käidupäevik", "Käidukava", "Puudused", "Dokumendiregister", "Objekti kokkuvõte", "Elektripaigaldise kokkuvõte"]) {
      await expect(page.getByRole("main").getByRole("link", { name: new RegExp(`^${title}`) })).toBeVisible();
    }
    await page.goto(`/o/${org.slug}/aruanded/log`);
    await page.getByLabel("Elektripaigaldis").selectOption(installation);
    await page.getByRole("button", { name: "Näita eelvaadet" }).click();
    const preview = page.getByRole("article");
    await expect(preview.getByText("2 kirjet")).toBeVisible();
    await expect(preview.getByText("Alajaama hooldus")).toHaveCount(0);
    await expect(preview.getByText(/Parandab .* kannet\. Põhjus: Vale tulemus/)).toBeVisible();
    await expect(preview.getByText("Parandatud 1 kord")).toBeVisible();
    await expectNoHorizontalScroll(page);

    const pdf = await page.request.get(await page.getByRole("link", { name: "Ekspordi PDF" }).getAttribute("href") as string);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect(pdf.headers()["cache-control"]).toContain("no-store");
    expect(fileName(pdf)).toMatch(/^KAIDLY_Kaidupaevik_PK-01-Peajaotuskilp_\d{4}-\d{2}-\d{2}\.pdf$/);
    const bytes = await pdf.body();
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.toString("latin1")).toMatch(/\/Type\s*\/Page\b/);

    const csv = await page.request.get(await page.getByRole("link", { name: "Ekspordi CSV" }).getAttribute("href") as string);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const text = (await csv.body()).toString("utf8");
    expect(text.startsWith("﻿Aeg;Liik;Objekt;Tähis;Elektripaigaldis;Kirjeldus")).toBe(true);
    expect(text).toContain("Kilbi ülevaatus, klemm X3 lahti");
    expect(text).toContain("Vale tulemus");
    expect(text).not.toContain("Alajaama hooldus");
  });

  test("plan, deficiencies and document register filters; no storage paths or URLs", async ({ page }) => {
    const org = await createOrg();
    await seed(org);
    await login(page, org.users.viewer, `/o/${org.slug}/aruanded`);
    await page.goto(`/o/${org.slug}/aruanded/plan?tahtaeg=overdue`);
    const preview = page.getByRole("article");
    await expect(preview.getByText("Hilinenud mõõtmine")).toBeVisible();
    await expect(preview.getByText("3 päeva üle tähtaja")).toBeVisible();
    await expect(preview.getByText("Tuleviku kontroll")).toHaveCount(0);

    await page.goto(`/o/${org.slug}/aruanded/deficiencies?seis=resolved`);
    await expect(page.getByRole("article").getByText("Valitud filtritega kirjeid ei leitud.")).toBeVisible();
    await page.goto(`/o/${org.slug}/aruanded/deficiencies?raskus=critical`);
    await expect(page.getByRole("article").getByText("Lahtine klemm")).toBeVisible();

    await page.goto(`/o/${org.slug}/aruanded/documents`);
    await expect(page.getByRole("article").getByText("Mõõteprotokoll 2026")).toBeVisible();
    const csv = (await (await page.request.get(`/o/${org.slug}/aruanded/documents/eksport?format=csv`)).body()).toString("utf8");
    expect(csv).toContain("protokoll.pdf");
    expect(csv).not.toContain("salajane-tee");
    expect(csv).not.toMatch(/https?:\/\//);
  });

  test("installation and site summaries", async ({ page }) => {
    const org = await createOrg();
    const { site, installation } = await seed(org);
    await login(page, org.users.viewer, `/o/${org.slug}/paigaldised/${installation}`);
    await page.getByRole("link", { name: "Kokkuvõte" }).click();
    const preview = page.getByRole("article");
    await expect(preview.getByRole("heading", { name: "Elektripaigaldise kokkuvõte" })).toBeVisible();
    for (const s of ["Andmed", "Viimased sissekanded", "Üle tähtaja", "Tulevased tegevused (90 päeva)", "Avatud puudused", "Dokumendid"]) {
      await expect(preview.getByRole("heading", { name: s, exact: true })).toBeVisible();
    }
    await expect(preview.getByText("Hilinenud mõõtmine")).toBeVisible();
    const pdf = await page.request.get(`/o/${org.slug}/aruanded/installation/eksport?paigaldis=${installation}&format=pdf`);
    expect(fileName(pdf)).toMatch(/^KAIDLY_Paigaldise-kokkuvote_PK-01-Peajaotuskilp_/);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

    await page.goto(`/o/${org.slug}/objektid/${site}`);
    await page.getByRole("link", { name: "Kokkuvõte" }).click();
    await expect(page.getByRole("article").getByRole("heading", { name: "Objekti kokkuvõte" })).toBeVisible();
    await expect(page.getByRole("article").getByRole("cell", { name: "PK-01", exact: true }).first()).toBeVisible();
  });

  test("reports never cross tenants; expired companies can still export", async ({ page }) => {
    const a = await createOrg();
    const b = await createOrg();
    const { installation: foreign } = await seed(b);
    await seed(a);
    sql(`update private.organisation_access set trial_started_at = now() - interval '20 days', trial_ends_at = now() - interval '6 days' where organisation_id = '${a.id}';`);
    await login(page, a.users.owner, `/o/${a.slug}/aruanded`);
    // Another company's report: the ordinary 404.
    expect((await page.request.get(`/o/${b.slug}/aruanded/log/eksport?format=csv`)).status()).toBe(404);
    // A foreign installation id as a filter matches nothing in the own company.
    const csv = (await (await page.request.get(`/o/${a.slug}/aruanded/log/eksport?format=csv&paigaldis=${foreign}`)).body()).toString("utf8");
    expect(csv.trim().split("\r\n")).toHaveLength(1);
    expect((await page.request.get(`/o/${a.slug}/aruanded/installation/eksport?format=pdf&paigaldis=${foreign}`)).status()).toBe(404);
    // Expired (read-only): reading and exporting own data still works.
    const own = await page.request.get(`/o/${a.slug}/aruanded/log/eksport?format=pdf`);
    expect(own.status()).toBe(200);
  });

  test("reports in English and Russian", async ({ page, context }) => {
    const org = await createOrg();
    await seed(org);
    await setLanguage(context, "en", org.users.owner.id);
    await login(page, org.users.owner, `/o/${org.slug}/aruanded/deficiencies`);
    await expect(page.getByRole("article").getByRole("heading", { name: "Deficiencies", level: 2 })).toBeVisible();
    await setLanguage(context, "ru", org.users.owner.id);
    await page.reload();
    await expect(page.getByRole("article").getByRole("heading", { name: "Дефекты", level: 2 })).toBeVisible();
    const csv = (await (await page.request.get(`/o/${org.slug}/aruanded/deficiencies/eksport?format=csv`)).body()).toString("utf8");
    expect(csv.startsWith("﻿Название;Объект")).toBe(true);
    expect(csv).toContain("Критическая");
  });
});
