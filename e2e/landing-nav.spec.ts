import { expect, expectNoHorizontalScroll, test } from "./support/fixtures";

const NEEDS = [
  ["Kes vajab käidukorraldajat?", "kes-vajab"],
  ["Valmis korraliseks auditiks", "audit"],
  ["Kellele KAIDLY sobib", "kellele"],
] as const;
const MAIN = [
  ["Kuidas töötab?", "kuidas-toimib"],
  ["Hinnakiri", "hinnad"],
  ["Meist", "meist"],
] as const;

/** The section's top is visible below the sticky header (nothing hidden under it). */
async function expectBelowHeader(page: import("@playwright/test").Page, id: string) {
  await expect.poll(async () => {
    const header = (await page.getByRole("banner").boundingBox())!;
    const top = await page.locator(`#${id}`).evaluate((el) => el.getBoundingClientRect().top);
    return top >= header.y + header.height - 2 && top < header.y + header.height + 40;
  }).toBe(true);
  await expect(page.locator(`#${id}`)).toBeFocused();
  expect(new URL(page.url()).hash).toBe("");
}

test.describe("Avalehe menüü", () => {
  test("desktop: 'Kas mul on vaja?' opens three questions; every link lands on its section below the sticky header", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByTestId("site-header-left").getByRole("navigation", { name: "Põhimenüü" });
    const toggle = nav.getByRole("button", { name: "Kas mul on vaja?" });
    for (const [name, id] of NEEDS) {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await nav.getByRole("link", { name, exact: true }).click();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expectBelowHeader(page, id);
      // The header stays at hand while scrolled.
      await expect(page.getByRole("banner")).toBeInViewport();
    }
    for (const [name, id] of MAIN) {
      await nav.getByRole("link", { name, exact: true }).click();
      await expectBelowHeader(page, id);
    }
  });

  test("desktop: keyboard — Enter opens, Tab reaches the links, Escape closes and returns focus", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Kas mul on vaja?" });
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("banner").getByRole("link", { name: "Kes vajab käidukorraldajat?", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
    // Clicking elsewhere closes it too.
    await toggle.click();
    await page.locator("main").click({ position: { x: 5, y: 400 } });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("phone and tablet: the menu groups the questions; each link scrolls and closes the menu @responsive", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 1024, "desktop has the header dropdown");
    await page.goto("/");
    const banner = page.getByRole("banner");
    const button = banner.getByRole("button", { name: "Menüü" });
    for (const [name, id] of [...NEEDS, ...MAIN]) {
      await button.click();
      const menu = banner.getByRole("navigation", { name: "Põhimenüü" });
      await expect(menu.getByText("Kas mul on vaja?")).toBeVisible();
      await menu.getByRole("link", { name, exact: true }).click();
      await expect(button).toHaveAttribute("aria-expanded", "false");
      await expectBelowHeader(page, id);
    }
    await expectNoHorizontalScroll(page);
  });

  test("footer lists every section", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    for (const [name] of [...NEEDS, ...MAIN]) await expect(footer.getByRole("link", { name, exact: true })).toBeVisible();
  });

  test("English and Russian labels", async ({ page, context }) => {
    await context.addCookies([{ name: "kaidly_locale", value: "en", url: "http://localhost:3100" }]);
    await page.goto("/");
    await page.getByRole("button", { name: "Do I need it?" }).click();
    await expect(page.getByRole("link", { name: "Who needs an operations manager?", exact: true }).first()).toBeVisible();
    await context.addCookies([{ name: "kaidly_locale", value: "ru", url: "http://localhost:3100" }]);
    await page.reload();
    await page.getByRole("button", { name: "Нужно ли мне?" }).click();
    await expect(page.getByRole("link", { name: "Кому подходит KAIDLY", exact: true }).first()).toBeVisible();
  });
});
