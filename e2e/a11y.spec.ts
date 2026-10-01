import type { Page } from "@playwright/test";
import {
  createInstallation,
  createOrg,
  createSite,
  expect,
  expectNoHorizontalScroll,
  login,
  sql,
  test,
} from "./support/fixtures";

// Lightweight automated accessibility check: axe-core (WCAG 2.1 A/AA) on the main pages,
// plus no sideways scrolling, at every viewport. It complements, not replaces, the manual
// keyboard and screen-reader passes recorded in docs/IMPLEMENTATION_PLAN.md.
const axeSource = require.resolve("axe-core/axe.min.js");

async function expectAccessible(page: Page) {
  await page.addScriptTag({ path: axeSource });
  const violations = await page.evaluate(async () => {
    // @ts-expect-error -- injected global
    const result = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return result.violations.map(
      (v: { id: string; nodes: { target: string[] }[] }) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    );
  });
  expect(violations, page.url()).toEqual([]);
  await expectNoHorizontalScroll(page);
}

test("main pages pass axe (WCAG 2.1 AA) and fit the screen @responsive", async ({ page }) => {
  test.setTimeout(120_000);
  const org = await createOrg();
  const site = await createSite(org, "Tootmishoone", "Tööstuse 1, Tallinn");
  const installation = await createInstallation(org, site, "Peajaotuskilp", "PJK-1");
  const entry = sql(`
    insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
    values ('${org.id}', '${site}', '${installation}', 'inspection', 'Ülevaatus tehtud', '${org.users.operator.id}') returning id;`);
  const deficiency = sql(`
    insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, created_by)
    values ('${org.id}', '${site}', '${installation}', 'Lahtine klemm', 'Peakilbis', 'critical', '${org.users.operator.id}') returning id;`);
  const doc = sql(`
    insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title,
                                  original_filename, mime_type, size_bytes, status, ready_at, uploaded_by)
    values ('${org.id}', '${site}', '${installation}', 'measurement_protocol', 'Mõõteprotokoll', 'm.pdf',
            'application/pdf', 1000, 'ready', now(), '${org.users.admin.id}') returning id;`);

  const base = `/o/${org.slug}`;
  const pages = [
    base,
    `${base}/sissekanne`,
    `${base}/objektid/${site}`,
    `${base}/paigaldised/${installation}`,
    `${base}/paigaldised/${installation}/paevik/uus`,
    `${base}/paigaldised/${installation}/paevik/${entry}`,
    `${base}/paigaldised/${installation}/dokumendid`,
    `${base}/puudused/${deficiency}`,
    `${base}/dokumendid`,
    `${base}/dokumendid/uus`,
    `${base}/dokumendid/${doc}`,
  ];
  await login(page, org.users.admin, base);
  for (const path of pages) {
    await page.goto(path);
    await page.locator("main h1").first().waitFor();
    await expectAccessible(page);
  }
});
