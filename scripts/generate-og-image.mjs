#!/usr/bin/env node
// Renders public/og-kaidly.png (1200×630), the social sharing image of kaidly.ee, from the
// existing brand mark (app/icon.svg) and colours. Static file: no tracking, no runtime cost.
//   node scripts/generate-og-image.mjs
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const icon = readFileSync(new URL("../app/icon.svg", import.meta.url), "utf8").replace(/<!--[\s\S]*?-->/g, "");
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: #0F3D32; color: #fff; font-family: "Helvetica Neue", Arial, sans-serif;
         display: flex; flex-direction: column; justify-content: space-between; padding: 72px 80px; position: relative; }
  .bar { position: absolute; left: 0; right: 0; top: 0; height: 14px; background: #22D07A; }
  .brand { display: flex; align-items: center; gap: 22px; }
  .brand svg { width: 76px; height: 76px; }
  .brand span { font-size: 58px; font-weight: 800; letter-spacing: 3px; }
  h1 { font-size: 66px; line-height: 1.08; font-weight: 800; max-width: 980px; }
  p { font-size: 30px; line-height: 1.35; color: rgba(255,255,255,0.82); max-width: 960px; margin-top: 22px; }
  .foot { display: flex; justify-content: space-between; align-items: center; font-size: 28px; color: rgba(255,255,255,0.8); }
  .foot b { color: #22D07A; font-weight: 700; }
</style></head><body>
  <div class="bar"></div>
  <div class="brand">${icon}<span>KAIDLY</span></div>
  <div><h1>Elektripaigaldise digitaalne käidupäevik</h1>
  <p>Käidupäevik, käidukava, puudused ja dokumendid ühes kohas.</p></div>
  <div class="foot"><span>Elektripaigaldise käit. Lihtsalt.</span><b>kaidly.ee</b></div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.screenshot({ path: new URL("../public/og-kaidly.png", import.meta.url).pathname, type: "png" });
await browser.close();
console.log("wrote public/og-kaidly.png");
