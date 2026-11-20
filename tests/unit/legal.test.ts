import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { LEGAL_CONTENT } from "../../lib/legal/content.ts";
import { LEGAL } from "../../lib/legal/operator.ts";
import { COMPANY } from "../../lib/company.ts";

const LOCALES = ["et", "en", "ru"] as const;
const DOCS = ["privacy", "terms", "dpa"] as const;

test("every legal page and the content file carry the lawyer-review marker", () => {
  for (const file of ["lib/legal/content.ts", "app/privaatsus/page.tsx", "app/kasutustingimused/page.tsx", "app/andmetootlusleping/page.tsx"]) {
    const text = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    assert.match(text.split("\n")[0], /JURISTI ÜLEVAATUS VAJALIK/, file);
  }
});

test("the data processing agreement covers the GDPR Art. 28 points (Estonian source)", () => {
  const headings = LEGAL_CONTENT.et.dpa.sections.map((s) => s.heading);
  for (const required of [
    "Töötlemise ese, laad, eesmärk ja kestus",
    "Isikuandmete liigid",
    "Andmesubjektid",
    "Volitatud töötleja kohustused",
    "Alamtöötlejad",
    "Turvameetmed",
    "Isikuandmetega seotud rikkumisest teavitamine",
    "Andmete tagastamine ja kustutamine",
    "Auditiõigus",
  ]) {
    assert.ok(headings.includes(required), required);
  }
  // Site viewers are a data-subject group.
  assert.match(JSON.stringify(LEGAL_CONTENT.et.dpa), /objekti vaataja/i);
});

test("same structure in et, en and ru", () => {
  for (const doc of DOCS) {
    const shape = (l: (typeof LOCALES)[number]) => LEGAL_CONTENT[l][doc].sections.map((s) => s.body.length);
    assert.deepEqual(shape("en"), shape("et"), `${doc} en`);
    assert.deepEqual(shape("ru"), shape("et"), `${doc} ru`);
  }
});

test("no certification or standards claims, no stored-file claims", () => {
  for (const l of LOCALES) {
    const text = JSON.stringify(LEGAL_CONTENT[l]);
    assert.doesNotMatch(text, /ISO|27001|SOC ?2|sertifi|certif|сертифик/i, l);
    assert.doesNotMatch(text, /failide massiline|mass file uploads|массово загружать/i, l);
  }
});

test("sub-processors are exactly the services the code uses; terms link to the agreement", () => {
  const sub = LEGAL_CONTENT.et.privacy.sections.find((s) => s.heading === "Alamtöötlejad ja andmete asukoht")!;
  const names = sub.body.map((p) => p.split(" — ")[0]).filter((n) => !n.startsWith("KAIDLY"));
  assert.deepEqual(names, ["Supabase", "Vercel", "Resend"]);
  assert.match(JSON.stringify(LEGAL_CONTENT.et.terms), /\[andmetöötluslepingus\]\(\/andmetootlusleping\)/);
  for (const l of LOCALES) {
    for (const [, path] of JSON.stringify(LEGAL_CONTENT[l]).matchAll(/\]\((\/[a-z-]+)\)/g)) {
      assert.ok(existsSync(new URL(`../../app${path}/page.tsx`, import.meta.url)), `${l}: ${path} exists`);
    }
  }
});

test("operator facts come from the company configuration; unknown regions stay empty", () => {
  assert.equal(LEGAL.contactEmail, COMPANY.email);
  assert.equal(LEGAL.appRegion, null);
  assert.equal(LEGAL.emailRegion, null);
  assert.equal(LEGAL.approved, false);
});
