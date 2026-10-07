import type { Page } from "@playwright/test";
import {
  createInstallation,
  createOrg,
  createSite,
  expect,
  expectNoHorizontalScroll,
  field,
  legacyFile,
  login,
  sql,
  test,
} from "./support/fixtures";

// Dokumendid is a link register (migration document_links): KAIDLY stores no files. Files
// uploaded earlier stay readable until an authorised member deletes them.

const objectCount = (path: string) => sql(`select count(*) from storage.objects where bucket_id = 'documents' and name = '${path}'`);

/** No file chooser, camera input or drop zone on the page. */
async function expectNoUploadUi(page: Page, where: string) {
  await expect(page.locator('input[type="file"]'), where).toHaveCount(0);
  await expect(page.locator("[capture]"), where).toHaveCount(0);
  await expect(page.getByText(/Lisa failid|Laadi üles|Laadi dokument üles|Vali fail|Pildista/), where).toHaveCount(0);
}

test.describe("Dokumendiregister", () => {
  test("no upload control anywhere in the operational app (owner, all main pages) @responsive", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Peakilp", "PK-1");
    const entry = sql(`insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
      values ('${org.id}', '${site}', '${installation}', 'inspection', 'Kanne', '${org.users.owner.id}') returning id;`);
    const deficiency = sql(`insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, created_by)
      values ('${org.id}', '${site}', '${installation}', 'Puudus', 'x', 'low', '${org.users.owner.id}') returning id;`);
    const doc = sql(`insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, external_url, uploaded_by)
      values ('${org.id}', '${site}', '${installation}', 'manual', 'Juhend', 'https://example.com/juhend', '${org.users.owner.id}') returning id;`);
    const base = `/o/${org.slug}`;
    await login(page, org.users.owner, base);
    for (const path of [
      base,
      `${base}/objektid/${site}`,
      `${base}/paigaldised/${installation}`,
      `${base}/paigaldised/${installation}/paevik/uus`,
      `${base}/paigaldised/${installation}/paevik/${entry}`,
      `${base}/paigaldised/${installation}/paevik/${entry}/paranda`,
      `${base}/paigaldised/${installation}/dokumendid`,
      `${base}/puudused/uus?paigaldis=${installation}`,
      `${base}/puudused/${deficiency}`,
      `${base}/puudused/${deficiency}/muuda`,
      `${base}/puudused/${deficiency}/lahenda`,
      `${base}/dokumendid`,
      `${base}/dokumendid/uus`,
      `${base}/dokumendid/${doc}`,
      `${base}/kaidukava`,
      `${base}/seaded`,
      "/konto",
    ]) {
      await page.goto(path);
      await page.locator("main h1, main h2").first().waitFor();
      await expectNoUploadUi(page, path);
    }
    await expectNoHorizontalScroll(page);
  });

  test("admin adds a general document link, opens it, archives and restores it; viewer reads only", async ({ page, browser }) => {
    const org = await createOrg();
    await createSite(org, "Objekt");
    await login(page, org.users.admin, `/o/${org.slug}/dokumendid`);

    await page.getByRole("link", { name: "Lisa dokument" }).first().click();
    await expect(page.getByText("Lisa link dokumendile või kaustale, kus dokument asub.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Dokumendi link" })).toHaveAttribute("placeholder", "https://...");
    await field(page, "title").fill("Ühejooneskeem PJK-1");
    await page.getByRole("textbox", { name: "Dokumendi link" }).fill("  https://firma.sharepoint.com/sites/kilbid/PJK-1.pdf  ");
    await field(page, "category").selectOption({ label: "Ühejooneskeem" });
    await page.getByRole("button", { name: "Lisa dokument" }).click();

    await expect(page).toHaveURL(new RegExp(`/o/${org.slug}/dokumendid\\?salvestatud=1$`));
    const list = page.getByRole("list", { name: "Dokumendid" });
    await expect(list.getByRole("link", { name: "Ühejooneskeem PJK-1", exact: true })).toBeVisible();
    const open = list.getByRole("link", { name: "Ava dokument Ühejooneskeem PJK-1 uues aknas" });
    await expect(open).toHaveAttribute("href", "https://firma.sharepoint.com/sites/kilbid/PJK-1.pdf");
    await expect(open).toHaveAttribute("target", "_blank");
    await expect(open).toHaveAttribute("rel", "noopener noreferrer");
    expect(sql(`select (storage_path is null)::text || '/' || external_url from public.documents where organisation_id = '${org.id}'`)).toBe(
      "true/https://firma.sharepoint.com/sites/kilbid/PJK-1.pdf",
    );

    // Viewer: sees it and can open the link, can't add or edit.
    const viewerContext = await browser.newContext();
    const viewer = await viewerContext.newPage();
    await login(viewer, org.users.viewer, `/o/${org.slug}/dokumendid`);
    await expect(viewer.getByRole("link", { name: "Ühejooneskeem PJK-1", exact: true })).toBeVisible();
    await expect(viewer.getByRole("link", { name: "Lisa dokument" })).toHaveCount(0);
    await viewer.getByRole("link", { name: "Ühejooneskeem PJK-1", exact: true }).click();
    await expect(viewer.getByRole("link", { name: "Ava dokument Ühejooneskeem PJK-1 uues aknas" })).toBeVisible();
    await expect(viewer.getByRole("textbox", { name: "Dokumendi link" })).toHaveCount(0);
    await viewer.goto(`/o/${org.slug}/dokumendid/uus`);
    await expect(viewer.getByRole("heading", { name: "Ligipääs puudub" })).toBeVisible();
    await viewerContext.close();

    // Edit the link; archive → gone from the list, kept in the archive; restore brings it back.
    await list.getByRole("link", { name: "Ühejooneskeem PJK-1", exact: true }).click();
    await page.getByRole("textbox", { name: "Dokumendi link" }).fill("https://drive.example.com/PJK-1");
    await page.getByRole("button", { name: "Salvesta" }).click();
    await expect(page.getByRole("link", { name: "Ava dokument Ühejooneskeem PJK-1 uues aknas" }).first()).toHaveAttribute(
      "href",
      "https://drive.example.com/PJK-1",
    );
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Arhiveeri" }).click();
    await expect(page.getByRole("button", { name: "Taasta" })).toBeVisible();
    await page.goto(`/o/${org.slug}/dokumendid`);
    await expect(page.getByRole("heading", { name: "Dokumente pole veel lisatud" })).toBeVisible();
    await page.getByRole("link", { name: "Arhiveeritud dokumendid" }).click();
    await page.getByRole("link", { name: "Ühejooneskeem PJK-1", exact: true }).click();
    await page.getByRole("button", { name: "Taasta" }).click();
    await expect(page.getByRole("button", { name: "Arhiveeri" })).toBeVisible();
  });

  test("operator adds an installation document from a phone; a malformed link is refused @responsive", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Peakilp", "PK-1");
    await login(page, org.users.operator, `/o/${org.slug}/paigaldised/${installation}/dokumendid`);
    await page.getByRole("link", { name: /^Lisa (esimene )?dokument$/ }).first().click();
    await field(page, "title").fill("Mõõteprotokoll 2026");
    const link = page.getByRole("textbox", { name: "Dokumendi link" });
    await link.fill("www.example.com/protokoll");
    // Skip the browser's own URL check to see the server's answer.
    await link.evaluate((input: HTMLInputElement) => input.form!.setAttribute("novalidate", ""));
    await page.getByRole("button", { name: "Lisa dokument" }).click();
    await expect(page.getByText("Dokumendi link peab olema kehtiv aadress, mis algab https://-ga.")).toBeVisible();
    await expect(field(page, "title")).toHaveValue("Mõõteprotokoll 2026");
    expect(sql(`select count(*) from public.documents where organisation_id = '${org.id}'`)).toBe("0");

    await page.getByRole("textbox", { name: "Dokumendi link" }).fill("https://1drv.ms/f/s!protokoll");
    await page.getByRole("button", { name: "Lisa dokument" }).click();
    await expect(page).toHaveURL(new RegExp(`/paigaldised/${installation}/dokumendid\\?salvestatud=1$`));
    await expect(page.getByRole("link", { name: "Ava dokument Mõõteprotokoll 2026 uues aknas" })).toHaveAttribute(
      "href",
      "https://1drv.ms/f/s!protokoll",
    );
    await expectNoHorizontalScroll(page);
    // Operators add documents but don't edit them (admins manage documents).
    await page.getByRole("link", { name: "Mõõteprotokoll 2026", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Dokumendi link" })).toHaveCount(0);
  });

  test("an earlier uploaded document stays readable; an admin deletes the file and adds a link instead", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Kilp");
    const file = await legacyFile(org, { site, installation }, org.users.admin, "Vana protokoll", "pdf");
    await login(page, org.users.admin, `/o/${org.slug}/dokumendid`);

    const list = page.getByRole("list", { name: "Dokumendid" });
    await expect(list.getByRole("listitem").filter({ hasText: "Vana protokoll" })).toContainText("varasem fail");
    const href = await list.getByRole("link", { name: /Ava fail/ }).getAttribute("href");
    const opened = await page.request.get(href!, { maxRedirects: 0 });
    expect(opened.status()).toBe(302);
    expect(opened.headers()["location"]).toContain("/storage/v1/object/sign/documents/");

    await list.getByRole("link", { name: "Vana protokoll", exact: true }).click();
    await expect(page.getByRole("link", { name: "Ava fail" })).toBeVisible();
    page.once("dialog", (dialog) => {
      expect(dialog.message()).toContain("jäädavalt");
      void dialog.accept();
    });
    await page.getByRole("button", { name: "Kustuta fail Vana protokoll" }).click();
    await expect(page.getByText("Fail on kustutatud.")).toBeVisible();
    await expect(page.getByRole("main")).toContainText(`Fail kustutatud — ${org.users.admin.fullName}`);
    await expect(page.getByRole("link", { name: "Ava fail" })).toHaveCount(0);
    expect(objectCount(file.path)).toBe("0");
    expect(sql(`select (deleted_at is not null)::text || '/' || (file_removed_at is not null)::text from public.documents where id = '${file.id}'`)).toBe("true/true");

    // No replacement upload — a link instead.
    await expectNoUploadUi(page, "document page after deleting the file");
    await page.getByRole("textbox", { name: "Dokumendi link" }).fill("https://drive.example.com/vana-protokoll");
    await page.getByRole("button", { name: "Salvesta" }).click();
    await expect(page.getByRole("link", { name: "Ava dokument Vana protokoll uues aknas" }).first()).toHaveAttribute(
      "href",
      "https://drive.example.com/vana-protokoll",
    );
  });

  test("another organisation's document is not found, not forbidden", async ({ page }) => {
    const a = await createOrg("A OÜ");
    const b = await createOrg("B OÜ");
    const site = await createSite(a, "A objekt");
    const installation = await createInstallation(a, site, "A kilp");
    const doc = sql(`
      insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title,
                                    original_filename, mime_type, size_bytes, status, ready_at, uploaded_by)
      values ('${a.id}', '${site}', '${installation}', 'audit', 'A audit', 'a.pdf', 'application/pdf', 10, 'ready', now(),
              '${a.users.admin.id}')
      returning id;`);
    // B's admin (member of B only) tries A's document through both organisations' URLs.
    await login(page, b.users.admin, `/o/${b.slug}/dokumendid`);
    // Through B's own URL the route sends B to its document page, which is "not found" for A's id.
    const viaB = await page.request.get(`/o/${b.slug}/dokumendid/${doc}/ava`, { maxRedirects: 0 });
    expect(viaB.status()).toBe(303);
    expect(viaB.headers()["location"]).toContain(`/o/${b.slug}/dokumendid/${doc}?fail=puudub`);
    expect((await page.request.get(`/o/${a.slug}/dokumendid/${doc}/ava`, { maxRedirects: 0 })).status()).toBe(404);
    await page.goto(`/o/${b.slug}/dokumendid/${doc}/ava`);
    await expect(page.getByRole("heading", { name: "Lehte ei leitud" })).toBeVisible();
    await expect(page.locator("main")).not.toContainText("A audit");
  });

  test("a document whose file is missing in Storage opens a clear notice, not an error", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Kilp");
    // Metadata without an object (e.g. after a database-only restore).
    const doc = sql(`insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title,
                       original_filename, mime_type, size_bytes, status, ready_at, uploaded_by)
                     values ('${org.id}', '${site}', '${installation}', 'manual', 'Kadunud fail', 'k.pdf', 'application/pdf', 10, 'ready', now(), '${org.users.admin.id}')
                     returning id;`);
    await login(page, org.users.viewer, `/o/${org.slug}/dokumendid`);
    await page.goto(`/o/${org.slug}/dokumendid/${doc}/ava`);
    await expect(page.getByRole("heading", { name: "Kadunud fail" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Faili ei õnnestunud praegu avada");
  });
});
