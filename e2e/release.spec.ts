import { createOrg, createSite, createUser, expect, login, sql, test } from "./support/fixtures";

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
    await expect(page).toHaveTitle("KAIDLY | Elektripaigaldise digitaalne käidupäevik");
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

  test("unknown public URLs are a real 404; app URLs still lead to login", async ({ page, request }) => {
    const missing = await request.get("/see-lehte-pole-olemas", { maxRedirects: 0 });
    expect(missing.status()).toBe(404);
    const body = await missing.text();
    expect(body).not.toMatch(/at .*\.(ts|js):\d+|stack|supabase\.co|sb_secret|service_role/i);
    await page.goto("/see-lehte-pole-olemas");
    await expect(page.getByText("Lehte ei leitud")).toBeVisible();
    for (const path of ["/o", "/konto", "/admin", "/teavitused", "/otsing"]) {
      const protectedPage = await request.get(path, { maxRedirects: 0 });
      expect(protectedPage.status(), path).toBe(307);
      expect(protectedPage.headers().location, path).toContain("/auth/login?next=");
    }
  });

  test("sharing metadata: Open Graph and Twitter card with the static brand image", async ({ page, request }) => {
    await page.goto("/");
    const meta = (selector: string) => page.locator(selector).first().getAttribute("content");
    expect(await meta('meta[property="og:image"]')).toMatch(/\/og-kaidly\.png$/);
    expect(await meta('meta[property="og:url"]')).toMatch(/^https?:\/\/[^/]+\/?$/); // the site root
    expect(await meta('meta[property="og:type"]')).toBe("website");
    expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");
    expect(await meta('meta[name="twitter:image"]')).toMatch(/\/og-kaidly\.png$/);
    const image = await request.get("/og-kaidly.png");
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toBe("image/png");
    // Structured data parses and makes no claims about a company, reviews or ratings.
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent()) ?? "{}");
    const types = (ld["@graph"] as { "@type": string }[]).map((n) => n["@type"]).sort();
    expect(types).toEqual(["SoftwareApplication", "WebSite"]);
    expect(JSON.stringify(ld)).not.toMatch(/aggregateRating|review|Organization|address|telephone/i);
  });

  test("legal pages are reachable, clearly pre-launch drafts, and not indexed", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("contentinfo").getByRole("link", { name: "Privaatsus" }).click();
    await expect(page.getByRole("heading", { name: "Privaatsus", level: 1 })).toBeVisible();
    await expect(page.getByRole("note")).toHaveText("Eelversioon. KAIDLY privaatsustingimused täiendatakse enne teenuse avalikku käivitamist.");
    await expect(page.getByText("Teenuse osutaja andmed avaldatakse enne teenuse ametlikku käivitamist.").first()).toBeVisible();
    await expect(page.getByRole("main").getByText(/\[|TODO|null/)).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await page.goto("/kasutustingimused");
    await expect(page.getByRole("heading", { name: "Kasutustingimused", level: 1 })).toBeVisible();
    await expect(page.getByRole("note")).toHaveText("Eelversioon. KAIDLY kasutustingimused täiendatakse enne teenuse avalikku käivitamist.");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByText(/TBA/)).toHaveCount(0);
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

  test("adding a document never offers a file upload; a link is required", async ({ page }) => {
    const org = await createOrg();
    await createSite(org, "Objekt");
    await login(page, org.users.admin, `/o/${org.slug}/dokumendid`);
    await page.getByRole("link", { name: "Lisa dokument" }).first().click();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await expect(page.getByLabel("Dokumendi link")).toHaveAttribute("required", "");
    await page.locator('[name="title"]:visible').fill("Juhend");
    await page.getByLabel("Dokumendi link").evaluate((input: HTMLInputElement) => input.removeAttribute("required"));
    await page.getByRole("button", { name: "Lisa dokument" }).click();
    await expect(page.getByText("Lisa dokumendi link.")).toBeVisible();
  });
});
