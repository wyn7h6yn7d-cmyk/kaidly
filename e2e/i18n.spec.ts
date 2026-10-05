import { createRequire } from "node:module";
import type { BrowserContext, Page } from "@playwright/test";
import {
  createInstallation,
  createOrg,
  createSite,
  expect,
  expectNoHorizontalScroll,
  field,
  login,
  sql,
  test,
} from "./support/fixtures";

const axeSource = createRequire(__filename).resolve("axe-core/axe.min.js");

async function setLanguage(context: BrowserContext, locale: "et" | "en" | "ru") {
  await context.addCookies([{ name: "kaidly_locale", value: locale, url: "http://localhost:3100" }]);
}

async function axe(page: Page) {
  await page.addScriptTag({ path: axeSource });
  const violations = await page.evaluate(async () => {
    // @ts-expect-error -- injected global
    const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return result.violations.map((v: { id: string }) => v.id);
  });
  expect(violations, page.url()).toEqual([]);
}

test.describe("Keeled · Languages · Языки", () => {
  test("visitors switch language in place; the URL stays the same @responsive", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Elektripaigaldise käit.");
    const select = page.getByRole("combobox", { name: "Keel" });
    if (await select.isVisible()) await select.selectOption("en");
    else await page.getByRole("banner").getByRole("button", { name: "English" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Electrical installation operation.");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Electrical installation operation.");

    await page.goto("/auth/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("signed-in switch keeps the session, the page and what was typed; the profile remembers it", async ({ page, browser }) => {
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Peakilp");
    const formUrl = `/o/${org.slug}/paigaldised/${installation}/paevik/uus`;
    await login(page, org.users.operator, formUrl);

    await page.getByText("Hooldus", { exact: true }).click();
    await field(page, "description").fill("Filtrid vahetatud");
    await page.getByRole("button", { name: "Konto" }).first().click();
    await page.getByRole("menuitemradio", { name: "Русский" }).click();

    await expect(page.getByRole("button", { name: "Сохранить запись" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${formUrl}$`));
    await expect(field(page, "description")).toHaveValue("Filtrid vahetatud");
    await expect(page.locator('input[name="entryType"][value="maintenance"]:visible')).toBeChecked();
    expect(sql(`select preferred_locale from public.profiles where id = '${org.users.operator.id}'`)).toBe("ru");

    // A fresh device: the saved language applies after signing in.
    const other = await browser.newContext();
    const fresh = await other.newPage();
    await login(fresh, org.users.operator, `/o/${org.slug}`);
    // (A fresh company without data shows the getting-started guide, not the attention panel.)
    await expect(fresh.getByRole("heading", { name: "Руководство по началу работы" })).toBeVisible();
    await other.close();
  });

  for (const locale of ["en", "ru"] as const) {
    test(`main pages in ${locale.toUpperCase()}: accessible, nothing overflows @responsive`, async ({ page, context }) => {
      test.setTimeout(120_000);
      const org = await createOrg();
      const site = await createSite(org, "Pikk objekti nimi logistikakeskuses");
      const installation = await createInstallation(org, site, "Peajaotuskilp", "PJK-1");
      sql(`insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, created_by)
           values ('${org.id}', '${site}', '${installation}', 'Lahtine klemm', 'x', 'critical', '${org.users.operator.id}');`);
      await setLanguage(context, locale);
      await login(page, org.users.admin, `/o/${org.slug}`);
      for (const path of [
        "/",
        `/o/${org.slug}`,
        `/o/${org.slug}/paigaldised/${installation}`,
        `/o/${org.slug}/paigaldised/${installation}/paevik/uus`,
        `/o/${org.slug}/puudused`,
        `/o/${org.slug}/dokumendid`,
        `/o/${org.slug}/seaded/ajalugu`,
      ]) {
        await page.goto(path);
        await page.locator("h1").first().waitFor();
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await axe(page);
        await expectNoHorizontalScroll(page);
      }
    });
  }
});
