import { chromium } from "@playwright/test";
const [,, base, outDir, tag] = process.argv;
const O = "/o/naidis-elektritood-demo";
const pub = ["/", "/auth/login", "/auth/sign-up"];
const app = [O, `${O}/objektid`, `${O}/objektid/d0000000-0000-4000-8000-0000000000b1`,
  `${O}/paigaldised/d0000000-0000-4000-8000-0000000000c1`, `${O}/paevik`, `${O}/kaidukava`, `${O}/puudused`, `${O}/dokumendid`, `${O}/seaded`, "/o?vali=1"];
const widths = (process.env.WIDTHS ?? "375,768,1280,1440,1920").split(",").map(Number);
const browser = await chromium.launch();
async function audit(page, p, w) {
  await page.goto(base + p); await page.waitForLoadState("networkidle");
  const r = await page.evaluate(() => {
    const vw = window.innerWidth; const issues = [];
    if (document.documentElement.scrollWidth > vw + 1) issues.push(`OVERFLOW ${document.documentElement.scrollWidth}>${vw}`);
    for (const el of document.querySelectorAll("main *, header *, footer *")) {
      const b = el.getBoundingClientRect(); if (!b.width || !b.height) continue;
      const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.position === "fixed") continue;
      const interactive = el.matches("a,button,input,select,textarea,label");
      if (interactive && (b.left < 12 || b.right > vw - 12) && b.width < vw - 30) issues.push(`EDGE ${el.tagName} ${(el.textContent||"").trim().slice(0,30)} L${Math.round(b.left)} R${Math.round(vw-b.right)}`);
      if (b.right > vw + 1) issues.push(`OUT ${el.tagName}.${(el.className||"").toString().slice(0,40)} right=${Math.round(b.right)}`);
    }
    return [...new Set(issues)].slice(0, 8);
  });
  const name = (p.replace(/[^a-z0-9]+/gi, "_") || "root").slice(-60);
  await page.screenshot({ path: `${outDir}/${tag}${name}_${w}.png`, fullPage: true });
  console.log(w, p, r.length ? r.join(" | ") : "ok");
}
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: "et-EE", timezoneId: "Europe/Tallinn" });
  const page = await ctx.newPage();
  for (const p of pub) await audit(page, p, w);
  await page.goto(`${base}/auth/login`);
  await page.locator('input[name="email"]:visible').fill("admin@kaidly.test");
  await page.locator('input[name="password"]:visible').fill("kaidly-demo-parool");
  await page.getByRole("button", { name: /Logi sisse|Sign in|Войти/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth/login"));
  for (const p of app) await audit(page, p, w);
  await ctx.close();
}
await browser.close();
