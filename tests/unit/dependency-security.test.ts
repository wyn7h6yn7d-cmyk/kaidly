import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Security floor for runtime dependencies (security audit 2026-11-20). Each entry is the
// first version that fixes a known advisory; installing anything older fails this test.
//  - next 16.4.6: GHSA-2464-fhr4-w9xw (RCE, image optimizer + SVG), GHSA-673q-mjm6-r5xr,
//    GHSA-p3m5-59mp-jv5r and the other 16.0.0–16.4.4 advisories
//  - zod 4.6.7: GHSA-mrhx-c7xc-m3w5 (memory exhaustion on oversized collections)
const FLOOR: Record<string, string> = { next: "16.4.6", "eslint-config-next": "16.4.6", zod: "4.6.7" };

const parse = (v: string) => v.split("-")[0].split(".").map(Number);
const atLeast = (actual: string, min: string) => {
  const a = parse(actual);
  const m = parse(min);
  for (let i = 0; i < 3; i++) if (a[i] !== m[i]) return a[i] > m[i];
  return true;
};

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const declared = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;

for (const [name, min] of Object.entries(FLOOR)) {
  test(`${name} is pinned and installed at ${min} or newer`, () => {
    assert.match(declared[name], /^\d+\.\d+\.\d+$/, `${name} must be pinned exactly`);
    assert.ok(atLeast(declared[name], min), `package.json pins ${name}@${declared[name]} < ${min}`);
    const installed = JSON.parse(
      readFileSync(new URL(`../../node_modules/${name}/package.json`, import.meta.url), "utf8"),
    ).version as string;
    assert.ok(atLeast(installed, min), `installed ${name}@${installed} < ${min}`);
  });
}

test("the version comparison rejects older versions", () => {
  assert.equal(atLeast("16.3.8", "16.4.6"), false);
  assert.equal(atLeast("4.6.5", "4.6.7"), false);
  assert.equal(atLeast("16.4.6", "16.4.6"), true);
  assert.equal(atLeast("17.0.0", "16.4.6"), true);
});
