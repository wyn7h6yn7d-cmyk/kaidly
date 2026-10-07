import {
  apiAs,
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

// Photos are linked, not uploaded (migration photo_links). Images uploaded earlier stay
// visible and can be deleted: the file goes, the record keeps a trace.

const objectCount = (path: string) => sql(`select count(*) from storage.objects where bucket_id = 'documents' and name = '${path}'`);
const tombstone = (id: string) =>
  sql(`select (deleted_at is not null)::text || '/' || (file_removed_at is not null)::text || '/' || coalesce(deleted_by_name, '') from public.documents where id = '${id}'`);

test.describe("Fotode lingid", () => {
  test("journal: an invalid photo link is refused and nothing is lost; a valid one saves and opens externally", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Kilp");
    await login(page, org.users.operator, `/o/${org.slug}/paigaldised/${installation}/paevik/uus`);

    await page.getByText("Kontroll", { exact: true }).click();
    await field(page, "description").fill("Ülevaatus");
    const link = page.getByLabel("Fotode link");
    await expect(link).toHaveAttribute("placeholder", "https://...");
    await expect(page.getByText("Lisa link kaustale või albumile, kus fotod asuvad.")).toBeVisible();
    // The browser's own URL check would stop "http://"; check the server's answer too.
    await link.evaluate((input: HTMLInputElement) => (input.type = "text"));
    await link.fill("http://fotod.example.com/kilp");
    await page.getByRole("button", { name: "Salvesta sissekanne" }).click();
    await expect(page.getByText("Fotode link peab olema kehtiv aadress, mis algab https://-ga.")).toBeVisible();
    await expect(field(page, "description")).toHaveValue("Ülevaatus");
    await expect(page.getByLabel("Fotode link")).toHaveValue("http://fotod.example.com/kilp");
    expect(sql(`select count(*) from public.log_entries where organisation_id = '${org.id}'`)).toBe("0");

    await page.getByLabel("Fotode link").fill("https://fotod.example.com/kilp-2026");
    await page.getByRole("button", { name: "Salvesta sissekanne" }).click();
    await expect(page).toHaveURL(/paevik\?salvestatud=1$/);
    expect(sql(`select photos_url from public.log_entries where organisation_id = '${org.id}'`)).toBe("https://fotod.example.com/kilp-2026");
    await page.getByRole("link", { name: /Ülevaatus/ }).click();
    const saved = page.getByRole("link", { name: "Ava fotode link (fotod.example.com) uues aknas" });
    await expect(saved).toHaveAttribute("target", "_blank");
    await expect(saved).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("a correction carries the link forward and can change it; the original keeps its own", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Kilp");
    const entry = sql(`insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, photos_url, created_by)
      values ('${org.id}', '${site}', '${installation}', 'inspection', 'Algne', 'https://old.example.com/a', '${org.users.operator.id}') returning id;`);
    await login(page, org.users.operator, `/o/${org.slug}/paigaldised/${installation}/paevik/${entry}/paranda`);
    await expect(page.getByLabel("Fotode link")).toHaveValue("https://old.example.com/a");
    await page.getByLabel("Fotode link").fill("https://new.example.com/b");
    await field(page, "correctionReason").fill("Õige kaust");
    await page.getByRole("button", { name: /Salvesta parandus/ }).click();
    await expect(page.getByRole("link", { name: "Ava fotode link (new.example.com) uues aknas" }).first()).toBeVisible();
    expect(sql(`select photos_url from public.log_entries where id = '${entry}'`)).toBe("https://old.example.com/a");
  });

  test("tenant isolation: another company cannot read or set a photo link", async () => {
    const a = await createOrg("A Elekter OÜ");
    const b = await createOrg("B Elekter OÜ");
    const site = await createSite(a, "Objekt");
    const installation = await createInstallation(a, site, "Kilp");
    const deficiency = sql(`insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, photos_url, created_by)
      values ('${a.id}', '${site}', '${installation}', 'Puudus', 'x', 'low', 'https://a.example.com/fotod', '${a.users.operator.id}') returning id;`);
    const other = await apiAs(b.users.admin);
    expect((await other.from("deficiencies").select("photos_url").eq("id", deficiency)).data).toEqual([]);
    await other.from("deficiencies").update({ photos_url: "https://evil.example.com/" }).eq("id", deficiency);
    expect(sql(`select photos_url from public.deficiencies where id = '${deficiency}'`)).toBe("https://a.example.com/fotod");
    const viewer = await apiAs(a.users.viewer);
    await viewer.from("deficiencies").update({ photos_url: null }).eq("id", deficiency);
    expect(sql(`select photos_url from public.deficiencies where id = '${deficiency}'`)).toBe("https://a.example.com/fotod");
  });
});

test.describe("Faile ei salvestata", () => {
  test("direct API calls cannot register or upload any file: images, PDF, DOCX, XLSX", async () => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Kilp");
    const op = await apiAs(org.users.operator);
    for (const [name, mime] of [
      ["x.jpg", "image/jpeg"],
      ["x.pdf", "application/pdf"],
      ["x.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      ["x.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ]) {
      const { error } = await op.from("documents").insert({
        organisation_id: org.id, site_id: site, electrical_installation_id: installation,
        category: "other", title: name, original_filename: name, mime_type: mime, size_bytes: 10,
      });
      expect(error?.message, mime).toBe("file_uploads_disabled");
    }
    // Even with a registered pending path (written as postgres) Storage takes nothing.
    const path = sql(`insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes, uploaded_by)
      values ('${org.id}', '${site}', '${installation}', 'other', 'Pooleli', 'p.pdf', 'application/pdf', 9, '${org.users.operator.id}') returning storage_path;`);
    for (const mime of ["application/pdf", "image/png"]) {
      const upload = await op.storage.from("documents").upload(path, new Blob(["%PDF-1.4\n"], { type: mime }), { contentType: mime });
      expect(upload.error, mime).not.toBeNull();
    }
    const elsewhere = await op.storage
      .from("documents")
      .upload(`${org.id}/${crypto.randomUUID()}/${crypto.randomUUID()}`, new Blob(["x"], { type: "application/pdf" }), { contentType: "application/pdf" });
    expect(elsewhere.error).not.toBeNull();
    expect(sql(`select count(*) from storage.objects where bucket_id = 'documents' and name like '${org.id}/%'`)).toBe("0");
    // A link document goes through.
    const { error } = await op.from("documents").insert({
      organisation_id: org.id, site_id: site, electrical_installation_id: installation,
      category: "manual", title: "Juhend", external_url: "https://example.com/juhend.pdf",
    });
    expect(error).toBeNull();
  });
});

test.describe("Varem üles laaditud failid", () => {
  test("an operator deletes an old deficiency photo: file and visibility gone, trace stays @responsive", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Kilp");
    const deficiency = sql(`insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, created_by)
      values ('${org.id}', '${site}', '${installation}', 'Lahtine klemm', 'x', 'high', '${org.users.operator.id}') returning id;`);
    const photo = await legacyFile(org, { site, installation, deficiency }, org.users.operator, "Klemm X3");
    await login(page, org.users.operator, `/o/${org.slug}/puudused/${deficiency}`);

    await expect(page.getByRole("list", { name: "Fotod" }).getByRole("img", { name: "Klemm X3" })).toBeVisible();
    const button = page.getByRole("button", { name: "Kustuta pilt Klemm X3" });
    await expect(button).toBeVisible();
    // Phones: a full 44 px touch target (desktop uses the compact secondary size).
    if ((page.viewportSize()?.width ?? 0) < 640) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expectNoHorizontalScroll(page);

    // Cancelling the confirmation keeps everything.
    page.once("dialog", (dialog) => void dialog.dismiss());
    await button.click();
    await expect(button).toBeVisible();
    expect(objectCount(photo.path)).toBe("1");

    page.once("dialog", (dialog) => {
      expect(dialog.message()).toContain("jäädavalt");
      void dialog.accept();
    });
    await button.click();
    await expect(page.getByText("Fail on kustutatud.")).toBeVisible();
    await expect(page.getByRole("img", { name: "Klemm X3" })).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Kustutatud failid" })).toContainText(`Pilt kustutatud — ${org.users.operator.fullName}`);
    await expectNoHorizontalScroll(page);

    expect(objectCount(photo.path)).toBe("0");
    expect(tombstone(photo.id)).toBe(`true/true/${org.users.operator.fullName}`);
    expect(sql(`select count(*) from public.documents where id = '${photo.id}'`)).toBe("1");
    // Its old link no longer opens anything.
    const response = await page.request.get(`/o/${org.slug}/dokumendid/${photo.id}/ava`, { maxRedirects: 0 });
    expect(response.status()).toBe(303);
  });

  test("viewers and other companies cannot delete an old photo", async ({ page }) => {
    const org = await createOrg();
    const other = await createOrg("Teine OÜ");
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Kilp");
    const entry = sql(`insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
      values ('${org.id}', '${site}', '${installation}', 'inspection', 'Kanne', '${org.users.operator.id}') returning id;`);
    const photo = await legacyFile(org, { site, installation, logEntry: entry }, org.users.operator, "Kilbi foto");

    await login(page, org.users.viewer, `/o/${org.slug}/paigaldised/${installation}/paevik/${entry}`);
    await expect(page.getByRole("img", { name: "Kilbi foto" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Kustuta pilt/ })).toHaveCount(0);

    for (const client of [await apiAs(org.users.viewer), await apiAs(other.users.owner)]) {
      const { error } = await client.rpc("delete_document_file", { p_document_id: photo.id });
      expect(error?.message).toBe("not_found");
      await client.storage.from("documents").remove([photo.path]);
    }
    expect(objectCount(photo.path)).toBe("1");
    expect(tombstone(photo.id)).toBe("false/false/");
  });

  test("a deletion interrupted before the file was removed can be finished; nothing is half-visible", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Kilp");
    const photo = await legacyFile(org, { site, installation }, org.users.admin, "Kilbi üldfoto");
    // Step 1 happened (marked deleted) but the Storage removal never ran.
    const admin = await apiAs(org.users.admin);
    expect((await admin.rpc("delete_document_file", { p_document_id: photo.id })).data).toBe(photo.path);
    expect(tombstone(photo.id)).toBe(`true/false/${org.users.admin.fullName}`);

    await login(page, org.users.admin, `/o/${org.slug}/dokumendid/${photo.id}`);
    await expect(page.getByRole("main")).toContainText(`Pilt kustutatud — ${org.users.admin.fullName}`);
    await expect(page.getByRole("link", { name: "Ava", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Laadi alla" })).toHaveCount(0);
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Lõpeta kustutamine" }).click();
    await expect(page.getByText("Fail on kustutatud.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Lõpeta kustutamine" })).toHaveCount(0);
    expect(objectCount(photo.path)).toBe("0");
    expect(tombstone(photo.id)).toBe(`true/true/${org.users.admin.fullName}`);

    // The documents list keeps the trace without a file link.
    await page.goto(`/o/${org.slug}/dokumendid`);
    const row = page.getByRole("listitem").filter({ hasText: "Kilbi üldfoto" });
    await expect(row).toContainText("Fail kustutatud");
    await expect(row.getByRole("link", { name: /Ava/ })).toHaveCount(0);
  });

  test("general document images: admins delete, operators don't see the action", async ({ page }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Kilp");
    const photo = await legacyFile(org, { site, installation }, org.users.admin, "Kilbi vaade");
    await login(page, org.users.operator, `/o/${org.slug}/dokumendid/${photo.id}`);
    await expect(page.getByRole("heading", { name: "Kilbi vaade" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Kustuta pilt/ })).toHaveCount(0);
  });
});
