import type { BrowserContext } from "@playwright/test";
import { expect, expectNoHorizontalScroll, test } from "./support/fixtures";

async function setLanguage(context: BrowserContext, locale: "en" | "ru") {
  await context.addCookies([{ name: "kaidly_locale", value: locale, url: "http://localhost:3100" }]);
}

const LAW = "https://www.riigiteataja.ee/et/akt/SeOS";
const TTJA = "https://ttja.ee";
const GUIDE = "https://ttja.ee/sites/default/files/documents/2024-01/Elektripaigaldiste%20auditi%20juhendmaterjal%2012.1.pdf";

test.describe("Avaleht: käidukorraldaja ja audit", () => {
  test("two sections right after the hero, before 'Excel' and 'Kuidas toimib', with official links @responsive", async ({ page }) => {
    await page.goto("/");
    const who = page.getByRole("region", { name: "Kes vajab käidukorraldajat?" });
    const audit = page.getByRole("region", { name: "Valmis korraliseks auditiks" });
    await expect(who).toBeVisible();
    await expect(audit).toBeVisible();

    // Order in the document: hero → who needs → audit → Excel → … → Kuidas toimib.
    const order = await page.evaluate(() => {
      const top = (el: Element | null) => (el ? el.getBoundingClientRect().top + window.scrollY : NaN);
      const excel = [...document.querySelectorAll("h2")].find((h) => h.textContent?.includes("Excel ei ole käiduraamat."));
      return {
        hero: top(document.querySelector("main section")),
        who: top(document.querySelector('[data-section="who-needs"]')),
        audit: top(document.querySelector('[data-section="audit-ready"]')),
        excel: top(excel ?? null),
        how: top(document.getElementById("kuidas-toimib")),
      };
    });
    expect(order.hero).toBeLessThan(order.who);
    expect(order.who).toBeLessThan(order.audit);
    expect(order.audit).toBeLessThan(order.excel);
    expect(order.excel).toBeLessThan(order.how);
    // The first section after the hero is "Kes vajab käidukorraldajat?".
    await expect(page.locator("main > section").nth(1)).toHaveAttribute("data-section", "who-needs");

    await expect(who.getByRole("listitem")).toHaveText([
      "madalpingepaigaldisega, mille peakaitse on üle 100 A;",
      "kõrgepingepaigaldisega, sh alajaamad ning keskpingel liitunud päikese- ja akupargid;",
      "plahvatusohtliku keskkonna paigaldisega või teatud meditsiiniruumidega.",
    ]);
    await expect(who).toContainText("Täpsed nõuded on seadmete ohutuse seaduses ja selle alusel antud määrustes.");
    for (const [name, href] of [["Seadmete ohutuse seadus", LAW], ["TTJA", TTJA]] as const) {
      const link = who.getByRole("link", { name: new RegExp(`^${name}`) });
      await expect(link).toHaveAttribute("href", href);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    await expect(audit.getByRole("link", { name: /^TTJA auditi juhendmaterjal/ })).toHaveAttribute("href", GUIDE);
    // The landing page describes the audit package; the button itself is in the app.
    await expect(audit).toContainText("Ühe nupuvajutusega saad auditipaketi: käidukava, käidupäevik, puudused ja dokumendid ühes PDF-is.");
    await expect(audit.getByRole("button")).toHaveCount(0);
    await expect(audit.getByRole("link")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Excel ei ole käiduraamat." })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("English and Russian", async ({ page, context }) => {
    await setLanguage(context, "en");
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Who needs an operations manager?" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ready for the periodic audit" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^TTJA audit guidance/ })).toHaveAttribute("href", GUIDE);

    await setLanguage(context, "ru");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Кому нужен ответственный за эксплуатацию?" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Готовы к плановому аудиту" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Закон о безопасности оборудования/ })).toHaveAttribute("href", LAW);
  });
});
