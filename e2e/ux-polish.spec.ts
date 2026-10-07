import { createOrg, expect, expectNoHorizontalScroll, login, test } from "./support/fixtures";

test.describe("UX polish", () => {
  test("scroll-to-top appears after scrolling, returns to the top and keeps focus usable @responsive", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle"); // hydrated: the scroll listener is attached
    const button = page.getByRole("button", { name: "Tagasi üles" });
    await expect(button).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect(button).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(button).toBeVisible();
    // Stays clear of the footer at the very bottom.
    // (by test id: the Next.js dev overlay can contain a footer of its own)
    const footerTop = await page.getByTestId("site-footer").evaluate((f) => f.getBoundingClientRect().top);
    const buttonBottom = await button.evaluate((b) => b.getBoundingClientRect().bottom);
    expect(buttonBottom).toBeLessThanOrEqual(footerTop);
    await button.focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.locator("header a").first()).toBeFocused();
    await expectNoHorizontalScroll(page);
  });

  test("reduced motion: scroll-to-top jumps without animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForLoadState("networkidle"); // hydrated: the scroll listener is attached
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const button = page.getByRole("button", { name: "Tagasi üles" });
    await expect(button).toBeVisible();
    await button.click();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("'Kuidas töötab' lands on the workflow, including in-app reminders", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: "Kuidas töötab" }).click();
    await expect(page.getByRole("heading", { name: "Üks objekt. Kõik, mis selle käiduga juhtub." })).toBeInViewport();
    await expect.poll(() => new URL(page.url()).hash).toBe("");
    await expect(page.getByRole("heading", { name: "KAIDLY tuletab ise meelde." })).toBeVisible();
    const example = page.getByRole("img", { name: "Näide KAIDLY teavitusest" });
    await expect(example).toBeVisible();
    await expect(example.getByRole("link")).toHaveCount(0); // a static mock-up, not a fake link
    await expect(page.getByText("Teavitused on KAIDLYs, kellukese all.")).toBeVisible();
  });

  test("onboarding progress, reminders card and Help section", async ({ page }) => {
    const org = await createOrg();
    await login(page, org.users.owner, `/o/${org.slug}`);
    const progress = page.getByRole("region", { name: "Alustamise juhend" }).getByRole("progressbar");
    await expect(progress).toHaveAttribute("aria-valuenow", "1");
    await expect(progress).toHaveAttribute("aria-valuemax", "6");
    await expect(page.getByRole("complementary", { name: "Meeldetuletused ja tähtajad" })).toBeVisible();
    await page.getByRole("link", { name: "Kuidas meeldetuletused töötavad" }).click();
    await expect(page).toHaveURL(/\/abi#meeldetuletused$/);
    const help = page.getByRole("region", { name: "Meeldetuletused ja tähtajad" });
    await expect(help).toContainText("„14 päeva jäänud“");
    await expect(help).toContainText("e-kirju ega telefoni teavitusi praegu ei saadeta");
    await help.getByRole("link", { name: "Ava teavitused" }).click();
    await expect(page).toHaveURL(/\/teavitused$/);
  });
});
