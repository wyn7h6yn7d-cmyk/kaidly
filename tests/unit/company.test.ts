import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aboutVisible, COMPANY, companyLine } from "../../lib/company.ts";
import { en } from "../../lib/i18n/en.ts";
import { et } from "../../lib/i18n/et.ts";
import { ru } from "../../lib/i18n/ru.ts";
import { LEGAL } from "../../lib/legal/operator.ts";

test("company facts: nothing invented — name, registry code, address and founder are left for Kenneth", () => {
  assert.equal(COMPANY.name, null);
  assert.equal(COMPANY.registryCode, null);
  assert.equal(COMPANY.address, null);
  assert.equal(COMPANY.email, "info@kaidly.ee");
  assert.equal(COMPANY.showAbout, true);
  assert.deepEqual(COMPANY.testimonials, [], "no sample testimonials");
  const source = readFileSync(new URL("../../lib/company.ts", import.meta.url), "utf8");
  for (const field of ["name", "registryCode", "address"]) {
    assert.match(source, new RegExp(`\\n  ${field}: null as string \\| null, // TÄIDAB KENNETH`), field);
  }
});

test("the legal pages read the operator facts from the same configuration", () => {
  assert.equal(LEGAL.operatorName, COMPANY.name);
  assert.equal(LEGAL.registryCode, COMPANY.registryCode);
  assert.equal(LEGAL.address, COMPANY.address);
  const source = readFileSync(new URL("../../lib/legal/operator.ts", import.meta.url), "utf8");
  assert.match(source, /operatorName: COMPANY\.name/);
});

test("footer line shows only the filled fields", () => {
  const label = et.landing.company.registryCode;
  assert.equal(companyLine({ name: null, registryCode: null, address: null }, label), null);
  assert.equal(
    companyLine({ name: "KAIDLY OÜ", registryCode: "12345678", address: "Tallinn" }, label),
    "KAIDLY OÜ, registrikood 12345678, Tallinn",
  );
  assert.equal(companyLine({ name: "KAIDLY OÜ", registryCode: "12345678", address: null }, label), "KAIDLY OÜ, registrikood 12345678");
  assert.equal(companyLine({ name: "KAIDLY OÜ", registryCode: " ", address: null }, label), "KAIDLY OÜ");
  assert.equal(companyLine({ name: null, registryCode: null, address: "Tallinn" }, label), "Tallinn");
  assert.equal(companyLine({ name: "A", registryCode: "1", address: null }, en.landing.company.registryCode), "A, registry code 1");
});

test("'Meist' follows its flag and names no person", () => {
  assert.equal(aboutVisible({ showAbout: false }), false);
  assert.equal(aboutVisible({ showAbout: true }), true);
  assert.equal(aboutVisible(COMPANY), true);
  assert.equal(
    et.landing.about.body,
    "KAIDLY on loonud elektriinsener, kellel on ligi 10 aastat kogemust käidujuhtimises ning suurte energiavarade käidu ja hoolduse korraldamisel. Tööriist sündis vajadusest pidada käidupäevikut nii, et kõik oleks kirjas, mitte kellegi peas.",
  );
  assert.ok(!("founderName" in COMPANY), "no personal name in the configuration");
  for (const m of [et, en, ru]) assert.doesNotMatch(m.landing.about.body, /\[NIMI\]|\$\{|A-klassi|A-class|класса A/);
});

test("'Kellele KAIDLY sobib': the owner's exact text, four audiences", () => {
  const a = et.landing.audiences;
  assert.equal(a.title, "Kellele KAIDLY sobib");
  assert.deepEqual(a.items, {
    operators: {
      title: "Käidukorraldajad ja elektrifirmad",
      body: "Kõik objektid, tähtajad ja sissekanded ühes kohas. Iga tehtud töö on nime ja ajaga kirjas.",
    },
    parks: { title: "Päikese- ja akupargid", body: "Kontrollid, lülitamised ja puudused on kirjas ka keskpingel liitunud pargis." },
    buildings: { title: "Ärihooned ja tootmine", body: "Kilbid, hooldused ja auditi tähtajad ühes kohas, mitte kellegi peas." },
    housing: { title: "Korteriühistud ja haldusfirmad", body: "Käidupäevik, mida saab auditi ajal ja üldkoosolekul näidata." },
  });
  for (const m of [en, ru]) assert.deepEqual(Object.keys(m.landing.audiences.items), Object.keys(a.items));
});

test("landing title and description (et)", () => {
  assert.equal(et.landing.metaTitle, "KAIDLY – digitaalne käidupäevik ja käidukava elektripaigaldistele");
  assert.equal(
    et.landing.metaDescription,
    "Käidupäevik, käidukava, puudused ja dokumendid ühes kohas. Käidukorraldajatele ja elektrifirmadele. Valmis korraliseks auditiks.",
  );
});
