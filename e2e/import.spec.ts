import type { Page } from "@playwright/test";
import { createOrg, createSite, expect, expectNoHorizontalScroll, login, sql, test } from "./support/fixtures";

const axeSource = require.resolve("axe-core/axe.min.js");

/** axe-core WCAG 2.1 A/AA on the current state of the wizard (preview table, errors). */
async function expectAccessible(page: Page) {
  await page.addScriptTag({ path: axeSource });
  const violations = await page.evaluate(async () => {
    // @ts-expect-error -- injected global
    const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return result.violations.map((v: { id: string; nodes: { target: string[] }[] }) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  });
  expect(violations).toEqual([]);
}

async function upload(page: Page, name: string, content: string) {
  await page.getByLabel("CSV-fail").setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.from(content, "utf8") });
}

test.describe("Andmete import", () => {
  test("owner imports sites, then installations; a repeated import is refused per row @responsive", async ({ page }) => {
    const org = await createOrg();
    await login(page, org.users.owner, `/o/${org.slug}/seaded`);
    await page.getByRole("link", { name: "Andmete import" }).click();
    await expect(page.getByRole("heading", { name: "Andmete import" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Laadi alla mall: Objektid/ })).toHaveAttribute("href", "/templates/kaidly-objektid.csv");

    // Semicolon-separated with a BOM, as Estonian spreadsheets save it.
    await upload(page, "objektid.csv", "﻿name;address\nKase 4 kortermaja;Kase 4, Tallinn\nTööstuse ladu;\n");
    await expect(page.getByText("objektid.csv — 2 korras · 0 vigast")).toBeVisible();
    await expect(page.getByRole("table", { name: "Faili read" })).toContainText("Kase 4 kortermaja");
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
    await page.getByRole("button", { name: "Impordi 2 rida" }).click();
    await expect(page.getByRole("heading", { name: "Imporditi 2 rida." })).toBeVisible();
    expect(sql(`select count(*) from public.sites where organisation_id = '${org.id}'`)).toBe("2");

    await page.getByRole("button", { name: "Impordi veel" }).click();
    await expect(page.getByRole("radio", { name: "Elektripaigaldised" })).toBeChecked();
    await upload(
      page,
      "paigaldised.csv",
      "site,name,identifier,type,commissioned_on\nkase 4 kortermaja,Peakilp,PK-1,switchboard,2015-04-10\nTööstuse ladu,Lao kilp,JK-1,,\n",
    );
    await page.getByRole("button", { name: "Impordi 2 rida" }).click();
    await expect(page.getByRole("heading", { name: "Imporditi 2 rida." })).toBeVisible();
    expect(sql(`select string_agg(identifier || ':' || installation_type, ',' order by identifier) from public.electrical_installations where organisation_id = '${org.id}'`)).toBe("JK-1:other,PK-1:switchboard");

    // Same file again: the database finds the existing identifier and nothing is created.
    await page.getByRole("button", { name: "Impordi veel" }).click();
    await page.getByRole("radio", { name: "Elektripaigaldised" }).check();
    await upload(page, "uuesti.csv", "site,name,identifier\nTööstuse ladu,Uus kilp,JK-2\nKase 4 kortermaja,Peakilp,PK-1\n");
    await page.getByRole("button", { name: "Impordi 2 rida" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("Rida 2: Selle tähisega paigaldis on sellel objektil juba olemas. Midagi ei imporditud.");
    expect(sql(`select count(*) from public.electrical_installations where organisation_id = '${org.id}'`)).toBe("2");
  });

  test("invalid rows are shown with reasons and block the import", async ({ page }) => {
    const org = await createOrg();
    await createSite(org, "Objekt");
    await login(page, org.users.admin, `/o/${org.slug}/seaded/import`);
    await page.getByRole("radio", { name: "Elektripaigaldised" }).check();
    await upload(page, "vigane.csv", "site,name,identifier,type,commissioned_on\nObjekt,Kilp,K-1,reactor,31.12.2020\n,Ilma objektita,,,\nObjekt,=SUM(A1),,,\n");
    await expect(page.getByText("vigane.csv — 0 korras · 3 vigast")).toBeVisible();
    const table = page.getByRole("table", { name: "Faili read" });
    await expect(table).toContainText("Tundmatu paigaldise tüüp");
    await expect(table).toContainText("Kuupäev peab olema kujul AAAA-KK-PP");
    await expect(table).toContainText("Objekt puudub");
    await expect(table).toContainText("tabelarvutuse valem");
    await expect(page.getByRole("button", { name: /Impordi/ })).toHaveCount(0);
    await expect(page.locator("main").getByRole("alert")).toContainText("Failis on vigaseid ridu.");
    await expectAccessible(page);

    await upload(page, "vale.csv", "nimi,aadress\nA,B\n");
    await expect(page.locator("main").getByRole("alert")).toContainText("Esimeses reas puuduvad kohustuslikud veerud");
  });

  test("operators and viewers cannot import; an expired company can only check a file", async ({ page }) => {
    const org = await createOrg();
    await login(page, org.users.operator, `/o/${org.slug}/seaded/import`);
    await expect(page.getByRole("heading", { name: "Andmete import" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Andmete import" })).toHaveCount(0);

    sql(`update private.organisation_access set trial_started_at = now() - interval '20 days', trial_ends_at = now() - interval '6 days' where organisation_id = '${org.id}';`);
    await page.context().clearCookies();
    await login(page, org.users.owner, `/o/${org.slug}/seaded/import`);
    await upload(page, "objektid.csv", "name\nUus objekt\n");
    await expect(page.getByText("objektid.csv — 1 korras · 0 vigast")).toBeVisible();
    await expect(page.locator("main").getByRole("alert")).toContainText("Ettevõte on ainult vaatamiseks");
    await expect(page.getByRole("button", { name: /Impordi/ })).toHaveCount(0);
  });
});
