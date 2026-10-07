import type { BrowserContext, Page } from "@playwright/test";
import { expect, expectNoHorizontalScroll, test } from "./support/fixtures";

async function setLanguage(context: BrowserContext, locale: "en" | "ru") {
  await context.addCookies([{ name: "kaidly_locale", value: locale, url: "http://localhost:3100" }]);
}

/** The landing page with React interactive (section links scroll in place only once hydrated). */
async function openLanding(page: Page, path = "/") {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/** The visible URL is exactly the clean landing URL: no fragment, no query. */
async function expectCleanUrl(page: Page) {
  await expect.poll(() => new URL(page.url()).hash).toBe("");
  expect(new URL(page.url()).pathname).toBe("/");
  expect(page.url()).not.toContain("#");
}

const PRICING_TITLE = "Lihtne hinnastus. Kõik vajalik on igas paketis.";
const WORKFLOW_TITLE = "Üks objekt. Kõik, mis selle käiduga juhtub.";

test.describe("Avalik päis ja sektsioonilingid", () => {
  test("labels and groups: logo + information left, account + language right @responsive", async ({ page }) => {
    await openLanding(page);
    const width = page.viewportSize()?.width ?? 0;
    const banner = page.getByRole("banner");
    const left = page.getByTestId("site-header-left");
    const right = page.getByTestId("site-header-right");

    await expect(left.getByRole("link", { name: "KAIDLY", exact: true })).toBeVisible();
    // Outdated labels are gone from the header (and "14 päeva tasuta" stays in the hero).
    await expect(banner.getByText("Hinnad", { exact: true })).toHaveCount(0);
    await expect(banner.getByText("Loo konto", { exact: true })).toHaveCount(0);
    await expect(banner.getByText("14 päeva tasuta")).toHaveCount(0);
    await expect(page.locator("main").getByText("14 päeva tasuta").first()).toBeVisible();

    if (width >= 1024) {
      const nav = left.getByRole("navigation", { name: "Põhimenüü" });
      await expect(right.getByRole("link", { name: "Logi sisse", exact: true })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Kuidas töötab?", exact: true })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Hinnakiri", exact: true })).toBeVisible();
      await expect(right.getByRole("link", { name: "Registreeru", exact: true })).toBeVisible();
      await expect(right.getByRole("group", { name: "Keel" })).toBeVisible();
      // Nothing informational on the right, nothing account-related on the left.
      await expect(right.getByRole("link", { name: /Kuidas töötab|Hinnakiri/ })).toHaveCount(0);
      await expect(left.getByRole("link", { name: /Logi sisse|Registreeru/ })).toHaveCount(0);

      // Geometry: the links sit right after the logo, the groups are pushed apart.
      const logo = (await left.getByRole("link", { name: "KAIDLY", exact: true }).boundingBox())!;
      const howItWorks = (await nav.getByRole("link", { name: "Kuidas töötab?" }).boundingBox())!;
      const pricing = (await nav.getByRole("link", { name: "Hinnakiri" }).boundingBox())!;
      const signIn = (await right.getByRole("link", { name: "Logi sisse" }).boundingBox())!;
      expect(howItWorks.x).toBeGreaterThan(logo.x + logo.width);
      expect(howItWorks.x - (logo.x + logo.width)).toBeLessThan(80);
      expect(pricing.x).toBeGreaterThan(howItWorks.x);
      expect(signIn.x - (pricing.x + pricing.width)).toBeGreaterThan(200);
      expect(Math.abs(howItWorks.y + howItWorks.height / 2 - (signIn.y + signIn.height / 2))).toBeLessThan(4);
    } else {
      // Below 1024 px: logo, language and the menu button; everything else is in the menu.
      await expect(right.getByRole("combobox", { name: "Keel" })).toBeVisible();
      await expect(right.getByRole("button", { name: "Menüü" })).toBeVisible();
      for (const name of ["Kuidas töötab?", "Hinnakiri", "Logi sisse", "Registreeru"]) {
        await expect(banner.getByRole("link", { name, exact: true })).toBeHidden();
      }
    }
    await expectNoHorizontalScroll(page);
  });

  test("Hinnakiri scrolls to pricing and the URL stays clean @responsive", async ({ page }) => {
    await openLanding(page);
    const width = page.viewportSize()?.width ?? 0;
    const historyBefore = await page.evaluate(() => window.history.length);
    if (width < 1024) await page.getByRole("button", { name: "Menüü" }).click();
    await page.getByRole("banner").getByRole("link", { name: "Hinnakiri", exact: true }).click();
    await expect(page.getByRole("heading", { name: PRICING_TITLE })).toBeInViewport();
    await expectCleanUrl(page);
    expect(await page.evaluate(() => window.history.length)).toBe(historyBefore);
    await expect(page.locator("#hinnad")).toBeFocused();
    await expectNoHorizontalScroll(page);
  });

  test("Kuidas töötab? (header and hero) scrolls without leaving a hash", async ({ page }) => {
    await openLanding(page);
    await page.getByRole("banner").getByRole("link", { name: "Kuidas töötab?", exact: true }).click();
    await expect(page.getByRole("heading", { name: WORKFLOW_TITLE })).toBeInViewport();
    await expectCleanUrl(page);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("link", { name: "Vaata, kuidas töötab" }).click();
    await expect(page.getByRole("heading", { name: WORKFLOW_TITLE })).toBeInViewport();
    await expectCleanUrl(page);
  });

  test("keyboard: Enter on Hinnakiri scrolls and moves focus to pricing", async ({ page }) => {
    await openLanding(page);
    await page.getByTestId("site-header-left").getByRole("link", { name: "Hinnakiri", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: PRICING_TITLE })).toBeInViewport();
    await expect(page.locator("#hinnad")).toBeFocused();
    await expectCleanUrl(page);
    // Tab continues inside the pricing section.
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest("#hinnad")))).toBe(true);
  });

  test("an old direct /#hinnad URL lands on pricing, then the URL is cleaned @responsive", async ({ page }) => {
    await page.goto("/#hinnad");
    await expect(page.getByRole("heading", { name: PRICING_TITLE })).toBeInViewport();
    await expectCleanUrl(page);
    await expect(page.getByRole("heading", { name: PRICING_TITLE })).toBeInViewport();
    await expectNoHorizontalScroll(page);
  });

  test("from another page: Hinnakiri opens the landing page at pricing; Back returns", async ({ page }) => {
    await page.goto("/privaatsus");
    await page.waitForLoadState("networkidle");
    await page.getByRole("contentinfo").getByRole("link", { name: "Hinnakiri", exact: true }).click();
    await expect(page.getByRole("heading", { name: PRICING_TITLE })).toBeInViewport();
    await expectCleanUrl(page);
    await page.goBack();
    await expect(page).toHaveURL(/\/privaatsus$/);
    await page.goForward();
    await expectCleanUrl(page);
  });

  test("English and Russian header labels", async ({ page, context }) => {
    await setLanguage(context, "en");
    await openLanding(page);
    const left = page.getByTestId("site-header-left");
    const right = page.getByTestId("site-header-right");
    await expect(left.getByRole("link", { name: "How does it work?", exact: true })).toBeVisible();
    await expect(left.getByRole("link", { name: "Pricing", exact: true })).toBeVisible();
    await expect(right.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
    await expect(right.getByRole("link", { name: "Sign up", exact: true })).toBeVisible();
    await left.getByRole("link", { name: "Pricing", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Simple pricing. Everything you need is in every plan." })).toBeInViewport();
    await expectCleanUrl(page);

    await setLanguage(context, "ru");
    await openLanding(page);
    await expect(left.getByRole("link", { name: "Как это работает?", exact: true })).toBeVisible();
    await expect(left.getByRole("link", { name: "Цены", exact: true })).toBeVisible();
    await expect(right.getByRole("link", { name: "Войти", exact: true })).toBeVisible();
    await expect(right.getByRole("link", { name: "Регистрация", exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

/** The menu below 1024 px (phones and tablets; desktop keeps the full header). */
test.describe("Mobiilimenüü @responsive @cross-browser", () => {
  test.beforeEach(async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 1024, "desktop header has no menu");
    await openLanding(page);
  });

  const ITEMS = ["Kuidas töötab?", "Hinnakiri", "Logi sisse", "Registreeru"];

  test("opens with all four destinations, Registreeru as the primary button, no overflow", async ({ page }) => {
    const banner = page.getByRole("banner");
    const button = banner.getByRole("button", { name: "Menüü" });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expectNoHorizontalScroll(page);

    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    const menu = banner.getByRole("navigation", { name: "Põhimenüü" });
    await expect(menu).toBeVisible();
    await expect(page.locator(`#${await button.getAttribute("aria-controls")}`)).toBeVisible();
    for (const name of ITEMS) await expect(menu.getByRole("link", { name, exact: true })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Registreeru", exact: true })).toHaveClass(/bg-k-volt/);
    await expect(menu.getByRole("link", { name: "Logi sisse", exact: true })).toHaveAttribute("href", "/auth/login");
    await expect(menu.getByRole("link", { name: "Registreeru", exact: true })).toHaveAttribute("href", "/auth/sign-up");
    for (const name of ITEMS) {
      const box = (await menu.getByRole("link", { name, exact: true }).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await expectNoHorizontalScroll(page);

    // The button toggles it closed again.
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeHidden();
  });

  test("keyboard: open with Enter, Tab into the links, Escape closes and returns focus", async ({ page, browserName }) => {
    const button = page.getByRole("button", { name: "Menüü" });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    // Safari moves Tab focus to links only with Option+Tab (its default setting).
    await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
    await expect(page.getByRole("banner").getByRole("link", { name: "Kuidas töötab?", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("banner").getByRole("navigation", { name: "Põhimenüü" })).toBeHidden();
    await expect(button).toBeFocused();
  });

  test("not a trap: Tab moves past the last item into the page", async ({ page, browserName }) => {
    await page.getByRole("button", { name: "Menüü" }).click();
    await page.getByRole("banner").getByRole("link", { name: "Registreeru", exact: true }).focus();
    await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest("header")))).toBe(false);
  });

  test("a section link scrolls, closes the menu and keeps the URL clean", async ({ page }) => {
    const button = page.getByRole("button", { name: "Menüü" });
    const banner = page.getByRole("banner");
    const historyBefore = await page.evaluate(() => window.history.length);

    await button.click();
    await banner.getByRole("link", { name: "Hinnakiri", exact: true }).click();
    await expect(page.getByRole("heading", { name: PRICING_TITLE })).toBeInViewport();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(banner.getByRole("navigation", { name: "Põhimenüü" })).toBeHidden();
    await expect(page.locator("#hinnad")).toBeFocused();
    await expectCleanUrl(page);

    await button.click();
    await banner.getByRole("link", { name: "Kuidas töötab?", exact: true }).click();
    await expect(page.getByRole("heading", { name: WORKFLOW_TITLE })).toBeInViewport();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expectCleanUrl(page);
    expect(await page.evaluate(() => window.history.length)).toBe(historyBefore);
    await expectNoHorizontalScroll(page);
  });

  test("a click outside closes it; Logi sisse and Registreeru open their pages", async ({ page }) => {
    const button = page.getByRole("button", { name: "Menüü" });
    await button.click();
    // Below the panel: the bottom of the screen is page content.
    const viewport = page.viewportSize()!;
    await page.mouse.click(viewport.width / 2, viewport.height - 20);
    await expect(button).toHaveAttribute("aria-expanded", "false");

    await button.click();
    await page.getByRole("banner").getByRole("link", { name: "Registreeru", exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/sign-up$/);
    await page.goBack();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Menüü" })).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "Menüü" }).click();
    await page.getByRole("banner").getByRole("link", { name: "Logi sisse", exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test("language switch: the menu follows ET → EN → RU", async ({ page }) => {
    const banner = page.getByRole("banner");
    const labels = {
      en: { menu: "Menu", items: ["How does it work?", "Pricing", "Sign in", "Sign up"] },
      ru: { menu: "Меню", items: ["Как это работает?", "Цены", "Войти", "Регистрация"] },
    } as const;
    for (const locale of ["en", "ru"] as const) {
      await banner.getByRole("combobox").selectOption(locale);
      const button = banner.getByRole("button", { name: labels[locale].menu, exact: true });
      await expect(button).toBeVisible();
      await button.click();
      for (const name of labels[locale].items) {
        await expect(banner.getByRole("navigation").getByRole("link", { name, exact: true })).toBeVisible();
      }
      await expectNoHorizontalScroll(page);
      await page.keyboard.press("Escape");
      await expect(button).toHaveAttribute("aria-expanded", "false");
    }
    expect(new URL(page.url()).pathname).toBe("/");
  });
});
