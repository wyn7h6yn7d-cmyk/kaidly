import type { BrowserContext } from "@playwright/test";
import { expect, expectNoHorizontalScroll, test } from "./support/fixtures";

async function setLanguage(context: BrowserContext, locale: "en" | "ru") {
  await context.addCookies([{ name: "kaidly_locale", value: locale, url: "http://localhost:3100" }]);
}

test.describe("Hinnakiri (avalik leht)", () => {
  test("navigation, trial and the five plans in Estonian @responsive", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Põhimenüü" });
    const wide = (page.viewportSize()?.width ?? 0) >= 1024;
    if (wide) await expect(nav.getByRole("link", { name: "Kuidas töötab?", exact: true })).toBeVisible();

    // The free trial is visible near the top on every width.
    await expect(page.getByText("14 päeva tasuta").filter({ visible: true }).first()).toBeInViewport();

    // "Hinnakiri" goes to the pricing section (from the header on tablet/desktop, the footer on
    // phones); the URL stays clean (public-header.spec.ts covers the scrolling in detail).
    const width = page.viewportSize()?.width ?? 0;
    const pricingLink = width >= 640 ? nav.getByRole("link", { name: "Hinnakiri", exact: true }) : page.getByRole("contentinfo").getByRole("link", { name: "Hinnakiri" });
    await pricingLink.click();
    const pricing = page.getByRole("region", { name: "Lihtne hinnastus. Kõik vajalik on igas paketis." });
    await expect(pricing.getByRole("heading", { level: 2 })).toBeInViewport();
    await expect.poll(() => new URL(page.url()).hash).toBe("");

    const plans = [
      ["Start", "19", "1 kasutaja", "5 aktiivset elektripaigaldist"],
      ["Team", "29", "3 kasutajat", "10 aktiivset elektripaigaldist"],
      ["Pro", "39", "5 kasutajat", "25 aktiivset elektripaigaldist"],
      ["Business", "89", "15 kasutajat", "100 aktiivset elektripaigaldist"],
    ];
    for (const [name, price, users, installations] of plans) {
      const card = pricing.getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true }) });
      await expect(card).toContainText(`${price}€ / kuu + KM`);
      await expect(card).toContainText(users);
      await expect(card).toContainText(installations);
    }
    const pro = pricing.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Pro", exact: true }) });
    await expect(pro).toContainText("Kõige populaarsem");
    await expect(pricing.getByText("Kõige populaarsem")).toHaveCount(1);
    await expect(pricing.getByRole("heading", { name: "Vajad rohkem?" })).toBeVisible();
    await expect(pricing.getByText("14 päeva tasuta")).toBeVisible();
    // The trial is stated without any payment-card wording; it is not a header item.
    await expect(page.locator("body")).not.toContainText(/krediitkaart|credit card|банковская карта/i);
    await expect(page.getByRole("banner").getByText("14 päeva tasuta")).toHaveCount(0);
    // Every plan has every feature: one shared list, no per-plan feature gating.
    await expect(pricing.getByRole("heading", { name: "Igas paketis", exact: true })).toBeVisible();
    await expect(pricing.getByText("Käidupäevik", { exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await pricing.getByRole("link", { name: "Alusta tasuta" }).first().click();
    await expect(page).toHaveURL(/\/auth\/sign-up$/);
  });

  test("pricing in English and Russian", async ({ page, context }) => {
    await setLanguage(context, "en");
    await page.goto("/#hinnad");
    await expect(page.getByRole("navigation", { name: "Main menu" }).getByRole("link", { name: "Pricing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Simple pricing. Everything you need is in every plan." })).toBeVisible();
    await expect(page.getByText("14 days free").filter({ visible: true }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/credit card/i);
    await expect(page.getByText("Most popular")).toBeVisible();
    await expect(page.getByText("15 users")).toBeVisible();

    await setLanguage(context, "ru");
    await page.reload();
    await expect(page.getByRole("navigation", { name: "Главное меню" }).getByRole("link", { name: "Цены" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Простые тарифы. Всё необходимое — в каждом из них." })).toBeVisible();
    await expect(page.getByText("Самый популярный")).toBeVisible();
    await expect(page.getByText("15 пользователей")).toBeVisible();
    await expect(page.getByText("14 дней бесплатно").filter({ visible: true }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/банковская карта/i);
    await expect(page.getByText("100 активных электроустановок")).toBeVisible();
  });
});
