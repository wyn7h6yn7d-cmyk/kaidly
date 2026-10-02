import type { BrowserContext, Page } from "@playwright/test";
import { createOrg, createUser, expect, expectNoHorizontalScroll, field, login, sql, test } from "./support/fixtures";

/** Every URL the page requests, to prove credentials never travel in one. */
function recordUrls(page: Page) {
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  return urls;
}

test.describe("Minu konto", () => {
  test("change name, see email, request an email change on the same account @responsive", async ({ page }) => {
    const user = await createUser("Konto Omanik");
    await login(page, user, "/konto");
    await expect(page.getByRole("heading", { name: "Minu konto" })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await field(page, "fullName").fill("Konto Omanik Uus");
    await page.getByRole("button", { name: "Salvesta" }).click();
    await expect(page.getByText("Salvestatud.")).toBeVisible();
    expect(sql(`select full_name from public.profiles where id = '${user.id}'`)).toBe("Konto Omanik Uus");

    await expect(page.getByLabel("Praegune e-post")).toHaveValue(user.email);
    const next = `uus-${user.email}`;
    await field(page, "email").fill(next);
    await page.getByRole("button", { name: "Muuda e-posti aadressi" }).click();
    await expect(page.getByText(/Uus e-posti aadress tuleb kinnitada\./)).toBeVisible();
    // Auth holds the pending change for the same user; nothing switches before confirmation.
    expect(sql(`select email_change from auth.users where id = '${user.id}'`)).toBe(next);
    expect(sql(`select email from auth.users where id = '${user.id}'`)).toBe(user.email);
  });

  test("password change needs the current password and a matching confirmation; no credential in any URL or table", async ({
    page,
    browser,
  }) => {
    const user = await createUser("Parooli Vahetaja");
    const urls = recordUrls(page);
    // A second signed-in device that must be signed out by the change.
    const other: BrowserContext = await browser.newContext();
    const otherPage = await other.newPage();
    await login(otherPage, user, "/konto");

    await login(page, user, "/konto");
    const newPassword = "Uus-Turvaline-Parool-2026";

    await field(page, "currentPassword").fill("vale-parool-123");
    await field(page, "newPassword").fill(newPassword);
    await field(page, "confirmPassword").fill(newPassword);
    await page.getByRole("button", { name: "Muuda parooli" }).click();
    await expect(page.getByText("Praegune parool ei ole õige.")).toBeVisible();

    await field(page, "currentPassword").fill(user.password);
    await field(page, "newPassword").fill(newPassword);
    await field(page, "confirmPassword").fill(`${newPassword}x`);
    await page.getByRole("button", { name: "Muuda parooli" }).click();
    await expect(page.getByText(/Paroolid ei kattu/)).toBeVisible();

    await field(page, "currentPassword").fill(user.password);
    await field(page, "newPassword").fill(newPassword);
    await field(page, "confirmPassword").fill(newPassword);
    await page.getByRole("button", { name: "Muuda parooli" }).click();
    await expect(page.getByText(/Parool muudetud\./)).toBeVisible();
    await expect(field(page, "newPassword")).toHaveValue("");

    for (const secret of [user.password, newPassword, "vale-parool-123"]) {
      expect(urls.filter((u) => u.includes(secret) || u.includes(encodeURIComponent(secret)))).toEqual([]);
      expect(page.url()).not.toContain(secret);
      const hits = sql(`select count(*) from public.profiles p where p::text like '%${secret}%'`) +
        sql(`select count(*) from public.activity_history h where h::text like '%${secret}%'`);
      expect(hits).toBe("00");
    }

    // Every other session (refresh token) is revoked at once; only this one remains. An
    // already-issued access token on the other device lapses at its expiry (≤ 1 h).
    expect(sql(`select count(*) from auth.sessions where user_id = '${user.id}'`)).toBe("1");
    await other.close();
    await page.goto("/konto");
    await expect(page.getByRole("heading", { name: "Minu konto" })).toBeVisible();
  });

  test("forgot-password link and sign out of other devices", async ({ page, browser }) => {
    const user = await createUser("Seansside Haldaja");
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await login(otherPage, user, "/konto");
    await login(page, user, "/konto");

    await expect(page.getByRole("link", { name: "Unustasid praeguse parooli?" })).toHaveAttribute("href", "/auth/forgot-password");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Logi teistest seadmetest välja" }).click();
    await expect.poll(() => sql(`select count(*) from auth.sessions where user_id = '${user.id}'`)).toBe("1");
    await other.close();

    await page.getByRole("button", { name: "Logi välja" }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("account page in English and Russian", async ({ page, context }) => {
    const user = await createUser("Keeled");
    await context.addCookies([{ name: "kaidly_locale", value: "en", url: "http://localhost:3100" }]);
    await login(page, user, "/konto");
    await expect(page.getByRole("button", { name: "Change password" })).toBeVisible();
    await context.addCookies([{ name: "kaidly_locale", value: "ru", url: "http://localhost:3100" }]);
    await page.reload();
    await expect(page.getByRole("button", { name: "Сменить пароль" })).toBeVisible();
  });
});

test.describe("Ettevõtte andmed", () => {
  test("admins edit company details; the slug stays; operators and viewers only read @responsive", async ({ page, browser }) => {
    const org = await createOrg("Andmetega OÜ");
    await login(page, org.users.admin, `/o/${org.slug}/seaded`);
    await field(page, "name").fill("Ümbernimetatud OÜ");
    await field(page, "contactEmail").fill("info@firma.ee");
    await field(page, "contactPhone").fill("+372 5555 5555");
    await field(page, "address").fill("Tööstuse 1, Tallinn");
    await field(page, "notes").fill("Võtmed valvelauas");
    await page.getByRole("button", { name: "Salvesta" }).click();
    await expect(page.getByText("Salvestatud.")).toBeVisible();
    expect(sql(`select name || '|' || slug || '|' || contact_email from public.organisations where id = '${org.id}'`)).toBe(
      `Ümbernimetatud OÜ|${org.slug}|info@firma.ee`,
    );
    await expectNoHorizontalScroll(page);

    // The old address still works after the rename.
    await page.goto(`/o/${org.slug}`);
    await expect(page.getByRole("heading", { name: "Ümbernimetatud OÜ" })).toBeVisible();

    const other = await browser.newContext();
    const viewer = await other.newPage();
    await login(viewer, org.users.viewer, `/o/${org.slug}/seaded`);
    await expect(viewer.getByText("Ettevõtte andmeid saavad muuta omanikud ja administraatorid.")).toBeVisible();
    await expect(viewer.getByText("Tööstuse 1, Tallinn")).toBeVisible();
    await expect(viewer.locator('[name="contactEmail"]')).toHaveCount(0);
    await other.close();
  });
});
