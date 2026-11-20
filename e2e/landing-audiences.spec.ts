import type { BrowserContext } from "@playwright/test";
import { expect, expectNoHorizontalScroll, test } from "./support/fixtures";

async function setLanguage(context: BrowserContext, locale: "en" | "ru") {
  await context.addCookies([{ name: "kaidly_locale", value: locale, url: "http://localhost:3100" }]);
}

test.describe("Avaleht: kellele sobib, ettevõtte andmed", () => {
  test("'Kellele KAIDLY sobib' after 'Kuidas toimib' and before pricing; 1 column on phones, 2 from tablet @responsive", async ({ page }) => {
    await page.goto("/");
    const section = page.getByRole("region", { name: "Kellele KAIDLY sobib" });
    await expect(section).toBeVisible();
    const items = section.getByRole("listitem");
    await expect(items).toHaveCount(4);
    await expect(items.getByRole("heading", { level: 3 })).toHaveText([
      "Käidukorraldajad ja elektrifirmad",
      "Päikese- ja akupargid",
      "Ärihooned ja tootmine",
      "Korteriühistud ja haldusfirmad",
    ]);
    await expect(items.nth(3)).toContainText("Käidupäevik, mida saab auditi ajal ja üldkoosolekul näidata.");
    // Icons are decoration (the heading says it all).
    await expect(items.locator("svg").first()).toHaveAttribute("aria-hidden", "true");

    const tops = await page.evaluate(() => {
      const top = (el: Element | null) => (el ? el.getBoundingClientRect().top + window.scrollY : NaN);
      return {
        how: top(document.getElementById("kuidas-toimib")),
        audiences: top(document.querySelector('[data-section="audiences"]')),
        pricing: top(document.getElementById("hinnad")),
      };
    });
    expect(tops.how).toBeLessThan(tops.audiences);
    expect(tops.audiences).toBeLessThan(tops.pricing);

    // Stacked on phones, side by side (2 × 2) from 640 px.
    const boxes = await Promise.all([0, 1].map((i) => items.nth(i).boundingBox()));
    const width = page.viewportSize()?.width ?? 0;
    if (width < 640) expect(boxes[1]!.y).toBeGreaterThan(boxes[0]!.y);
    else expect(Math.abs(boxes[1]!.y - boxes[0]!.y)).toBeLessThan(2);
    await expectNoHorizontalScroll(page);

    // "Meist" is shown without a personal name; testimonials stay hidden (empty list).
    const about = page.getByRole("region", { name: "Meist" });
    await expect(about).toContainText("KAIDLY on loonud elektriinsener, kellel on ligi 10 aastat kogemust käidujuhtimises");
    const aboutTop = await about.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    expect(aboutTop).toBeGreaterThan(tops.pricing);
    await expect(about.getByTestId("about-facts")).toContainText("ligi 10 aastat");
    await expect(about.getByTestId("about-facts")).toContainText("Elektriinsener");
    await expect(about.getByRole("heading", { name: "Põhimõtted" })).toBeVisible();
    await expect(about.getByRole("link", { name: "Võta ühendust" })).toHaveAttribute("href", /^mailto:info@kaidly\.ee\?/);
    await expect(page.locator('[data-section="testimonials"]')).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/\[NIMI\]|TÄIDAB KENNETH/);

    // Footer: only filled company facts — today only the e-mail address.
    const facts = page.getByTestId("company-facts");
    await expect(facts.getByRole("link", { name: "info@kaidly.ee" })).toHaveAttribute("href", "mailto:info@kaidly.ee");
    await expect(facts).not.toContainText(/registrikood|null|undefined/);
  });

  test("title, description and the section in English and Russian", async ({ page, context }) => {
    await setLanguage(context, "en");
    await page.goto("/");
    await expect(page).toHaveTitle("KAIDLY – digital operating log and operating plan for electrical installations");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /^Operating log, operating plan, deficiencies/);
    await expect(page.getByRole("heading", { name: "Who KAIDLY is for" })).toBeVisible();

    await setLanguage(context, "ru");
    await page.reload();
    await expect(page).toHaveTitle("KAIDLY – цифровой оперативный журнал и план эксплуатации электроустановок");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /^Оперативный журнал, план эксплуатации/);
    await expect(page.getByRole("heading", { name: "Кому подходит KAIDLY" })).toBeVisible();
  });
});
