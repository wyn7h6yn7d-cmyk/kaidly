import type { BrowserContext } from "@playwright/test";
import { expect, expectNoHorizontalScroll, test } from "./support/fixtures";

async function setLanguage(context: BrowserContext, locale: "en" | "ru") {
  await context.addCookies([{ name: "kaidly_locale", value: locale, url: "http://localhost:3100" }]);
}

test.describe("Hinnakiri (avalik leht)", () => {
  test("navigation, trial, the plans, the yearly switch and the founder offer in Estonian @responsive", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Põhimenüü" });
    const wide = (page.viewportSize()?.width ?? 0) >= 1024;
    if (wide) await expect(nav.getByRole("link", { name: "Kuidas töötab?", exact: true })).toBeVisible();

    // The free trial is visible near the top on every width.
    await expect(page.getByText("14 päeva tasuta").filter({ visible: true }).first()).toBeInViewport();

    // "Hinnakiri" goes to the pricing section (header on desktop, the header menu below
    // 1024 px); the URL stays clean (public-header.spec.ts covers the scrolling in detail).
    if (!wide) await page.getByRole("button", { name: "Menüü" }).click();
    await nav.getByRole("link", { name: "Hinnakiri", exact: true }).click();
    const pricing = page.getByRole("region", { name: "Lihtne hinnastus. Kõik vajalik on igas paketis." });
    await expect(pricing.getByRole("heading", { level: 2 })).toBeInViewport();
    await expect.poll(() => new URL(page.url()).hash).toBe("");

    const plans = [
      ["Start", "19", "190", "1 kasutaja", "10 aktiivset elektripaigaldist", "Üksik käidukorraldaja"],
      ["Team", "49", "490", "3 kasutajat", "40 aktiivset elektripaigaldist", "Väike elektrifirma"],
      ["Pro", "99", "990", "8 kasutajat", "120 aktiivset elektripaigaldist", "Käidukorraldusega tegelev ettevõte"],
      ["Business", "199", "1 990", "20 kasutajat", "300 aktiivset elektripaigaldist", "Suurem hooldusettevõte"],
    ];
    const card = (name: string) => pricing.getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true }) });
    for (const [name, price, , users, installations, audience] of plans) {
      await expect(card(name)).toContainText(`${price}€ / kuu + KM`);
      await expect(card(name)).toContainText(users);
      await expect(card(name)).toContainText(installations);
      await expect(card(name)).toContainText(audience);
    }
    // "Soovitatud" only on Pro; "Kõige populaarsem" is gone (owner rule: no invented labels).
    await expect(card("Pro")).toContainText("Soovitatud");
    await expect(pricing.getByText("Soovitatud")).toHaveCount(1);
    await expect(page.locator("body")).not.toContainText(/Kõige populaarsem/i);
    await expect(pricing.getByText("2 kuud tasuta")).toHaveCount(0);

    // Founder offer (FOUNDER_OFFER_ENABLED) above the table, VAT note below it.
    await expect(pricing.getByTestId("founder-offer")).toHaveText(
      "Asutajapakkumine: esimesed 10 ettevõtet saavad 12 kuud 50% soodsamalt. Kirjuta info@kaidly.ee.",
    );
    await expect(pricing.getByTestId("founder-offer").getByRole("link", { name: "info@kaidly.ee" })).toHaveAttribute("href", /^mailto:info@kaidly\.ee\?/);
    await expect(pricing.getByTestId("vat-note")).toHaveText("Hinnad ei sisalda käibemaksu.");

    // Ettevõte: by agreement, 300+, contact.
    const enterprise = pricing.locator('[data-plan="enterprise"]');
    await expect(enterprise.getByRole("heading", { name: "Ettevõte" })).toBeVisible();
    await expect(enterprise).toContainText("Kokkuleppel");
    await expect(enterprise).toContainText("300+ aktiivset elektripaigaldist");
    await expect(enterprise).toContainText("Suured portfellid");
    await expect(enterprise.getByRole("link", { name: "Võta ühendust" })).toHaveAttribute("href", /^mailto:info@kaidly\.ee\?/);

    // Yearly: 10 × monthly, "2 kuud tasuta", invoiced, contact instead of a checkout.
    await pricing.getByText("Aasta", { exact: true }).click();
    await expect(pricing.getByRole("radio", { name: "Aasta" })).toBeChecked();
    for (const [name, , annual] of plans) {
      await expect(card(name)).toContainText(new RegExp(`${annual.replace(" ", "\\s")}€ / aasta \\+ KM`));
      await expect(card(name)).toContainText("2 kuud tasuta");
      await expect(card(name)).toContainText("arve alusel");
      await expect(card(name).getByRole("link", { name: "Võta ühendust" })).toHaveAttribute("href", /^mailto:info@kaidly\.ee\?/);
    }
    await expectNoHorizontalScroll(page);
    await pricing.getByText("Kuu", { exact: true }).click();
    await expect(card("Start")).toContainText("19€ / kuu + KM");
    await expect(pricing.getByText("2 kuud tasuta")).toHaveCount(0);
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
    await expect(page.getByText("Recommended", { exact: true })).toBeVisible();
    await expect(page.getByText("Most popular")).toHaveCount(0);
    await expect(page.getByText("20 users")).toBeVisible();
    await expect(page.getByText("Prices exclude VAT.", { exact: true })).toBeVisible();

    await setLanguage(context, "ru");
    await page.reload();
    await expect(page.getByRole("navigation", { name: "Главное меню" }).getByRole("link", { name: "Цены" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Простые тарифы. Всё необходимое — в каждом из них." })).toBeVisible();
    await expect(page.getByText("Рекомендуем", { exact: true })).toBeVisible();
    await expect(page.getByText("Самый популярный")).toHaveCount(0);
    await expect(page.getByText("20 пользователей")).toBeVisible();
    await expect(page.getByText("14 дней бесплатно").filter({ visible: true }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/банковская карта/i);
    await expect(page.getByText("300 активных электроустановок")).toBeVisible();
  });
});
