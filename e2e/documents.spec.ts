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
} from "./support/fixtures";

// A 1×1 PNG and a minimal PDF: real files, no network.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

test.describe("Dokumendid ja fotod", () => {
  test("operator adds a log entry with a photo from the phone @responsive", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Tootmishoone");
    const installation = await createInstallation(org, site, "Peajaotuskilp", "PJK-1");
    await login(page, org.users.operator, `/o/${org.slug}/paigaldised/${installation}/paevik/uus`);

    await page.getByText("Kontroll", { exact: true }).click();
    await field(page, "description").fill("Kilbi ülevaatus, foto lisatud");
    await page.getByLabel("Pildista või vali fotod").setInputFiles({
      name: "kilp.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await expect(page.getByRole("list", { name: "Manused" }).getByText("kilp.png")).toBeVisible();
    await page.getByRole("button", { name: "Salvesta sissekanne" }).click();
    await expect(page).toHaveURL(new RegExp(`/paigaldised/${installation}/paevik\\?salvestatud=1$`));

    await page.getByRole("link", { name: /Kilbi ülevaatus/ }).click();
    const photo = page.getByRole("list", { name: "Fotod" }).getByRole("img", { name: "kilp" });
    await expect(photo).toBeVisible();
    // The thumbnail really loads through the access-checked, short-lived link.
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await expectNoHorizontalScroll(page);

    expect(sql(`select count(*) from public.documents where organisation_id = '${org.id}' and status = 'ready'`)).toBe(
      "1",
    );
  });

  test("a failed upload keeps the saved entry and can be retried", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Kilp");
    await login(page, org.users.operator, `/o/${org.slug}/paigaldised/${installation}/paevik/uus`);

    // The network drops while the file is uploading.
    await page.route("**/storage/v1/object/documents/**", (route) => route.abort("connectionreset"));
    await page.getByText("Hooldus", { exact: true }).click();
    await field(page, "description").fill("Hooldus tehtud, foto ei läinud kohe läbi");
    await page.getByLabel("Pildista või vali fotod").setInputFiles({ name: "hooldus.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "Salvesta sissekanne" }).click();

    await expect(page.getByText(/Sissekanne on salvestatud. Mõni fail jäi üles laadimata/)).toBeVisible();
    await expect(field(page, "description")).toHaveValue("Hooldus tehtud, foto ei läinud kohe läbi");
    // The incomplete upload was cleaned up; the entry exists once.
    expect(sql(`select count(*) from public.documents where organisation_id = '${org.id}'`)).toBe("0");
    expect(sql(`select count(*) from public.log_entries where organisation_id = '${org.id}'`)).toBe("1");

    await page.unroute("**/storage/v1/object/documents/**");
    await page.getByRole("button", { name: "Proovi uuesti" }).click();
    await expect(page).toHaveURL(new RegExp(`/paigaldised/${installation}/paevik\\?salvestatud=1$`));
    expect(sql(`select count(*) from public.log_entries where organisation_id = '${org.id}'`)).toBe("1");
    expect(sql(`select count(*) from public.documents where organisation_id = '${org.id}' and status = 'ready'`)).toBe("1");
  });

  test("files outside the allowlist are refused before upload", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Kilp");
    await login(page, org.users.operator, `/o/${org.slug}/paigaldised/${installation}/paevik/uus`);

    await page.getByLabel("Pildista või vali fotod").setInputFiles({
      name: "skeem.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    });
    await expect(page.getByRole("alert").getByText(/skeem\.svg/)).toBeVisible();
    await expect(page.getByRole("list", { name: "Manused" })).toHaveCount(0);
  });

  test("admin uploads, archives and restores a general document; viewer reads only", async ({ page, browser }) => {
    const org = await createOrg();
    await createSite(org, "Objekt");
    await login(page, org.users.admin, `/o/${org.slug}/dokumendid`);

    await page.getByRole("link", { name: "Laadi dokument üles" }).first().click();
    await page.getByLabel("Vali fail").setInputFiles({
      name: "Ühejooneskeem_PJK-1.pdf",
      mimeType: "application/pdf",
      buffer: PDF,
    });
    await expect(field(page, "title")).toHaveValue("Ühejooneskeem PJK-1");
    await field(page, "category").selectOption({ label: "Ühejooneskeem" });
    await page.getByRole("button", { name: "Laadi üles" }).click();

    await expect(page).toHaveURL(new RegExp(`/o/${org.slug}/dokumendid\\?salvestatud=1$`));
    const list = page.getByRole("list", { name: "Dokumendid" });
    await expect(list.getByRole("link", { name: "Ühejooneskeem PJK-1" })).toBeVisible();

    // Opening redirects to a short-lived signed Storage URL.
    const href = await list.getByRole("link", { name: /Ava fail/ }).getAttribute("href");
    const opened = await page.request.get(href!, { maxRedirects: 0 });
    expect(opened.status()).toBe(302);
    expect(opened.headers()["location"]).toContain("/storage/v1/object/sign/documents/");
    const file = await page.request.get(href!);
    expect(file.status()).toBe(200);

    // Viewer: sees it, can't upload.
    const viewerContext = await browser.newContext();
    const viewer = await viewerContext.newPage();
    await login(viewer, org.users.viewer, `/o/${org.slug}/dokumendid`);
    await expect(viewer.getByRole("link", { name: "Ühejooneskeem PJK-1" })).toBeVisible();
    await expect(viewer.getByRole("link", { name: "Laadi dokument üles" })).toHaveCount(0);
    await viewer.goto(`/o/${org.slug}/dokumendid/uus`);
    await expect(viewer.getByRole("heading", { name: "Ligipääs puudub" })).toBeVisible();
    await viewerContext.close();

    // Archive → gone from the list, kept in the archive; restore brings it back.
    await list.getByRole("link", { name: "Ühejooneskeem PJK-1" }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Arhiveeri" }).click();
    await expect(page.getByRole("button", { name: "Taasta" })).toBeVisible();
    await page.goto(`/o/${org.slug}/dokumendid`);
    await expect(page.getByText("Dokumente pole veel üles laaditud.")).toBeVisible();
    await page.getByRole("link", { name: "Arhiveeritud dokumendid" }).click();
    await page.getByRole("link", { name: "Ühejooneskeem PJK-1" }).click();
    await page.getByRole("button", { name: "Taasta" }).click();
    await expect(page.getByRole("button", { name: "Arhiveeri" })).toBeVisible();
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
    expect((await page.request.get(`/o/${b.slug}/dokumendid/${doc}/ava`, { maxRedirects: 0 })).status()).toBe(404);
    expect((await page.request.get(`/o/${a.slug}/dokumendid/${doc}/ava`, { maxRedirects: 0 })).status()).toBe(404);
    await page.goto(`/o/${b.slug}/dokumendid/${doc}`);
    await expect(page.getByRole("heading", { name: "Lehte ei leitud" })).toBeVisible();
  });

  test("photos can be added to an open deficiency", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Kilp");
    const deficiency = sql(`
      insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description,
                                       severity, created_by)
      values ('${org.id}', '${site}', '${installation}', 'Lahtine klemm', 'Peakilbis', 'high', '${org.users.operator.id}')
      returning id;`);
    await login(page, org.users.operator, `/o/${org.slug}/puudused/${deficiency}`);
    await page.getByLabel("Lisa fotod").setInputFiles({ name: "klemm.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByRole("list", { name: "Fotod" }).getByRole("img", { name: "klemm" })).toBeVisible();
  });
});
