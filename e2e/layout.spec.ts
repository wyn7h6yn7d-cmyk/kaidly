import type { Page } from "@playwright/test";
import { createInstallation, createOrg, createSite, expect, login, sql, test } from "./support/fixtures";

// Layout protection: at each width, no horizontal page scroll and no visible control or
// heading crossing the viewport edge (content inside its own scroll strip, like the
// installation tabs, is allowed). Screenshots are attached to the report for review —
// deliberately not pixel-compared, which would be brittle across machines and fonts.
const WIDTHS = [320, 375, 390, 430, 768, 1280, 1440];

async function checkEdges(page: Page) {
  const problems = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    if (document.documentElement.scrollWidth > vw + 1) {
      // Name the element that sticks out furthest, so the cause is obvious.
      let worst: { el: Element; right: number } | null = null;
      for (const el of document.querySelectorAll("body *")) {
        const right = el.getBoundingClientRect().right;
        if (right > vw + 1 && (!worst || right > worst.right)) worst = { el, right };
      }
      if (!worst) {
        // A word wider than its box overflows as text while the box stays in place.
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const range = document.createRange();
          range.selectNodeContents(node);
          const right = range.getBoundingClientRect().right;
          let clipped = false;
          for (let p = node.parentElement; p && !clipped; p = p.parentElement) {
            clipped = getComputedStyle(p).overflowX !== "visible";
          }
          if (!clipped && right > vw + 1 && node.parentElement && (!worst || right > worst.right)) {
            worst = { el: node.parentElement, right };
          }
        }
      }
      const what = worst ? `${worst.el.tagName}.${String(worst.el.className).slice(0, 50)} "${(worst.el.textContent ?? "").trim().slice(0, 30)}"` : "?";
      out.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${vw}) — widest: ${what}`);
    }
    const inScrollStrip = (el: Element) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === "auto" || o === "scroll" || o === "hidden") return true;
      }
      return false;
    };
    for (const el of document.querySelectorAll("a, button, input, select, textarea, h1, h2, h3")) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).visibility === "hidden") continue;
      if ((r.left < -1 || r.right > vw + 1) && !inScrollStrip(el)) {
        out.push(`${el.tagName} "${(el.textContent ?? "").trim().slice(0, 30)}" crosses the edge (${Math.round(r.left)}–${Math.round(r.right)})`);
      }
    }
    return out.slice(0, 5);
  });
  expect(problems, page.url()).toEqual([]);
}

test.describe("Paigutus", () => {
  test("public and app pages hold their layout from 320 to 1440 px", async ({ page }, testInfo) => {
    test.setTimeout(480_000);
    const org = await createOrg();
    const site = await createSite(org, "Väga pika nimega logistika- ja tootmiskeskus Näidisküla tööstuspargis");
    const installation = await createInstallation(org, site, "Peajaotuskilp hoone põhjatiivas", "PJK-1-PÕHJA");
    sql(`insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, created_by)
         values ('${org.id}', '${site}', '${installation}', 'Pikk puuduse pealkiri: lahtine klemm X3 ja ülekuumenemise jäljed isolatsioonil',
                 'Kirjeldus', 'critical', '${org.users.operator.id}');`);
    await page.goto("/");
    const publicPages = ["/", "/auth/login", "/auth/sign-up"];
    const base = `/o/${org.slug}`;
    const appPages = [
      base,
      `${base}/objektid/${site}`,
      `${base}/paigaldised/${installation}`,
      `${base}/paigaldised/${installation}/paevik/uus`,
      `${base}/kaidukava`,
      `${base}/puudused`,
      `${base}/puudused/uus`,
      `${base}/dokumendid`,
      `${base}/sissekanne`,
      `${base}/abi`,
      `${base}/seaded/kustuta`,
      `${base}/seaded`,
      "/konto",
      "/teavitused",
      "/otsing?q=kilp",
      `${base}/aruanded`,
      `${base}/aruanded/log`,
      `${base}/aruanded/installation?paigaldis=${installation}`,
      "/admin",
      "/admin/users",
      `/admin/users/${org.users.viewer.id}`,
      "/admin/companies",
      `/admin/companies/${org.id}`,
      "/admin/deadlines",
      "/admin/system",
      "/admin/audit",
    ];
    sql(`select private.bootstrap_platform_admin('${org.users.owner.email}');`);
    // An empty organisation: checklist and module empty states.
    const empty = await createOrg("Tühi OÜ");
    sql(`insert into public.organisation_members (organisation_id, user_id, role) values ('${empty.id}', '${org.users.owner.id}', 'owner');`);
    appPages.push(`/o/${empty.slug}`, `/o/${empty.slug}/objektid`, `/o/${empty.slug}/paevik`, `/o/${empty.slug}/kaidukava`, `/o/${empty.slug}/paigaldised/uus`);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of publicPages) {
        await page.goto(path);
        await page.locator("h1").first().waitFor();
        await checkEdges(page);
      }
    }
    await login(page, org.users.owner, base);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of appPages) {
        await page.goto(path);
        await page.locator("main h1").first().waitFor();
        await checkEdges(page);
      }
      if (width === 375 || width === 1440) {
        for (const path of [base, `${base}/paigaldised/${installation}/paevik/uus`]) {
          await page.goto(path);
          await page.locator("main h1").first().waitFor();
          await testInfo.attach(`${path.split("/").pop() || "dashboard"}-${width}`, {
            body: await page.screenshot({ fullPage: true }),
            contentType: "image/png",
          });
        }
      }
    }
  });

  test("larger text (125 % and 200 %) does not break pages", async ({ page }) => {
    test.setTimeout(120_000);
    const org = await createOrg();
    const site = await createSite(org, "Objekt");
    const installation = await createInstallation(org, site, "Peajaotuskilp", "PJK-1");
    await login(page, org.users.operator, `/o/${org.slug}`);
    // Browser zoom shrinks the CSS viewport (1280 px at 200 % ≈ 640 px); text-size settings
    // scale the root font. Check both.
    for (const [width, scale] of [
      [1024, "125%"],
      [640, "200%"],
      [375, "200%"],
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/", `/o/${org.slug}`, `/o/${org.slug}/paigaldised/${installation}/paevik/uus`, `/o/${org.slug}/puudused`]) {
        await page.goto(path);
        await page.locator("h1").first().waitFor();
        await page.evaluate((s) => (document.documentElement.style.fontSize = s), scale);
        await checkEdges(page);
        // The primary action stays reachable (not covered by the fixed bottom bar).
        const save = page.getByRole("button", { name: "Salvesta sissekanne" });
        if (await save.count()) {
          await save.scrollIntoViewIfNeeded();
          await expect(save).toBeInViewport();
        }
      }
    }
  });
});
