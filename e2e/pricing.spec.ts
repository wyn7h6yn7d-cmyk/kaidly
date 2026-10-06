import type { BrowserContext } from "@playwright/test";
import { expect, expectNoHorizontalScroll, test } from "./support/fixtures";

async function setLanguage(context: BrowserContext, locale: "en" | "ru") {
  await context.addCookies([{ name: "kaidly_locale", value: locale, url: "http://localhost:3100" }]);
}

test.describe("Hinnad (avalik leht)", () => {
  test("navigation, trial and the five plans in Estonian @responsive", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Põhimenüü" });
    const wide = (page.viewportSize()?.width ?? 0) >= 1024;
    if (wide) await expect(nav.getByRole("link", { name: "Kuidas töötab?", exact: true })).toBeVisible();

    // The free trial is visible near the top on every width.
    await expect(page.getByText("14 päeva tasuta").filter({ visible: true }).first()).toBeInViewport();
    await expect(page.getByText("Krediitkaarti pole vaja").filter({ visible: true }).first()).toBeVisible();

    // "Hinnad" goes to the pricing section (from the header on tablet/desktop, the footer on phones).
    const width = page.viewportSize()?.width ?? 0;
    const pricingLink = width >= 640 ? nav.getByRole("link", { name: "Hinnad", exact: true }) : page.getByRole("contentinfo").getByRole("link", { name: "Hinnad" });
    await pricingLink.click();
    await expect(page).toHaveURL(/#hinnad$/);
    const pricing = page.getByRole("region", { name: "Lihtne hinnastus. Kõik vajalik on igas paketis." });
    await expect(pricing.getByRole("heading", { level: 2 })).toBeInViewport();

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
    await expect(pricing.getByText("Krediitkaarti pole vaja")).toBeVisible();
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
    await expect(page.getByText("No credit card required").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("Most popular")).toBeVisible();
    await expect(page.getByText("15 users")).toBeVisible();

    await setLanguage(context, "ru");
    await page.reload();
    await expect(page.getByRole("navigation", { name: "Главное меню" }).getByRole("link", { name: "Цены" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Простые тарифы. Всё необходимое — в каждом из них." })).toBeVisible();
    await expect(page.getByText("Самый популярный")).toBeVisible();
    await expect(page.getByText("15 пользователей")).toBeVisible();
    await expect(page.getByText("100 активных электроустановок")).toBeVisible();
  });
});
