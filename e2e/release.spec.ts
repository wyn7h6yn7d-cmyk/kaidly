import { createOrg, createSite, createUser, expect, login, sql, test } from "./support/fixtures";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

test.describe("Väljalase", () => {
  test("security headers, no indexing outside production, health check without secrets", async ({ page, request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
    expect(h["x-powered-by"]).toBeUndefined();
    // Not production on the custom domain: nothing may be indexed.
    expect(h["x-robots-tag"]).toContain("noindex");
    expect((await (await request.get("/robots.txt")).text())).toMatch(/Disallow: \//);
    await page.goto("/");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page).toHaveTitle("KAIDLY | Elektripaigaldise käit lihtsalt");
    // The hero background is decoration only: hidden from assistive tech, never focusable.
    const backdrop = page.locator('[aria-hidden="true"]:has(> svg[focusable="false"])').first();
    await expect(backdrop).toBeAttached();
    expect(await backdrop.locator("a, button, [tabindex]").count()).toBe(0);

    const health = await request.get("/api/health");
    expect(health.status()).toBe(200);
    const body = await health.json();
    expect(body).toMatchObject({ app: "ok", auth: "ok", storage: "ok" });
    expect(JSON.stringify(body)).not.toMatch(/supabase|http|key|eyJ|sb_/i);
  });

  test("legal pages are reachable and clearly marked as drafts until the operator facts are confirmed", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("contentinfo").getByRole("link", { name: "Privaatsus" }).click();
    await expect(page.getByRole("heading", { name: "Privaatsus", level: 1 })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("Mustand");
    await expect(page.getByText("Teenuse osutaja andmed avaldatakse enne teenuse ametlikku käivitamist.").first()).toBeVisible();
    await expect(page.getByRole("main").getByText(/\[|TODO|null/)).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await page.goto("/kasutustingimused");
    await expect(page.getByRole("heading", { name: "Kasutustingimused", level: 1 })).toBeVisible();
    await expect(page.getByText(/14-päevane prooviperiood/)).toBeVisible();
  });

  test("account deletion request explains the process; no broken link without a contact address", async ({ page }) => {
    const user = await createUser("Kustutaja");
    await login(page, user, "/konto");
    const section = page.getByRole("region", { name: "Konto kustutamise taotlus" });
    await expect(section).toContainText("Midagi ei kustutata automaatselt.");
    await expect(section).toContainText("Taotluse saatmiseks võta KAIDLYga ühendust.");
    await expect(section.locator('a[href^="mailto:"]')).toHaveCount(0);
  });

  test("signing out other devices cuts their data access at once (not after token expiry)", async ({ page, browser }) => {
    const org = await createOrg();
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await login(otherPage, org.users.owner, `/o/${org.slug}`);
    await expect(otherPage.getByRole("heading", { name: org.name })).toBeVisible();

    await login(page, org.users.owner, "/konto");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Logi teistest seadmetest välja" }).click();
    await expect.poll(() => sql(`select count(*) from auth.sessions where user_id = '${org.users.owner.id}'`)).toBe("1");

    // The other device still holds an unexpired access token, but the database refuses it.
    await otherPage.goto(`/o/${org.slug}`);
    await expect(otherPage.getByRole("heading", { name: org.name })).toHaveCount(0);
    await other.close();
    // This device keeps working.
    await page.goto(`/o/${org.slug}`);
    await expect(page.getByRole("heading", { name: org.name })).toBeVisible();
  });

  test("upload limits give a clear message", async ({ page }) => {
    const org = await createOrg();
    await createSite(org, "Objekt");
    sql(`insert into private.upload_events (user_id, organisation_id, size_bytes)
         select '${org.users.admin.id}', '${org.id}', 1 from generate_series(1, 100);`);
    await login(page, org.users.admin, `/o/${org.slug}/dokumendid`);
    await page.getByRole("link", { name: "Laadi dokument üles" }).first().click();
    await page.getByLabel("Vali fail").setInputFiles({ name: "juhend.pdf", mimeType: "application/pdf", buffer: PDF });
    await page.locator('[name="category"]:visible').selectOption({ label: "Juhend" });
    await page.getByRole("button", { name: "Laadi üles" }).click();
    await expect(page.getByText("Liiga palju üleslaadimisi lühikese aja jooksul.", { exact: false })).toBeVisible();
  });
});
