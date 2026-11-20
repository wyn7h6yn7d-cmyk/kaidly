import { test } from "node:test";
import assert from "node:assert/strict";
import { en } from "../../lib/i18n/en.ts";
import { et } from "../../lib/i18n/et.ts";
import { ru } from "../../lib/i18n/ru.ts";
import { OFFICIAL_LINKS } from "../../lib/legal-links.ts";

// Owner-provided wording (2026-11-20): legal statements stay exactly as given.
test("'Kes vajab käidukorraldajat?' is the owner's exact Estonian text", () => {
  const w = et.landing.whoNeeds;
  assert.equal(w.title, "Kes vajab käidukorraldajat?");
  assert.equal(
    w.intro,
    "Elektripaigaldise omanik peab määrama käidukorraldaja ja korraldama paigaldise käitu käidukava järgi, kui tegemist on näiteks:",
  );
  assert.deepEqual(w.items, [
    "madalpingepaigaldisega, mille peakaitse on üle 100 A;",
    "kõrgepingepaigaldisega, sh alajaamad ning keskpingel liitunud päikese- ja akupargid;",
    "plahvatusohtliku keskkonna paigaldisega või teatud meditsiiniruumidega.",
  ]);
  assert.equal(w.note, "Täpsed nõuded on seadmete ohutuse seaduses ja selle alusel antud määrustes.");
  assert.equal(w.lawLink, "Seadmete ohutuse seadus");
  assert.equal(w.ttjaLink, "TTJA");
});

test("'Valmis korraliseks auditiks' is the owner's exact Estonian text, without product extras", () => {
  const a = et.landing.auditReady;
  assert.equal(a.title, "Valmis korraliseks auditiks");
  assert.equal(
    a.body,
    "TTJA auditi juhendmaterjali järgi ei saa korraline audit olla positiivne, kui paigaldisel puudub käidukorraldaja või käidukava. KAIDLY hoiab käidukava, käidupäeviku, puudused ja dokumendid ühes kohas, nii et audiitorile on kõik korraga näidata.",
  );
  assert.equal(a.guideLink, "TTJA auditi juhendmaterjal");
  // The audit package comes later (owner): no such claim in any language yet.
  for (const m of [et, en, ru]) assert.doesNotMatch(JSON.stringify(m.landing.auditReady), /auditipakett|audit package|пакет/i);
});

test("official links are the owner-provided addresses", () => {
  assert.deepEqual(OFFICIAL_LINKS, {
    equipmentSafetyAct: "https://www.riigiteataja.ee/et/akt/SeOS",
    ttja: "https://ttja.ee",
    ttjaAuditGuide: "https://ttja.ee/sites/default/files/documents/2024-01/Elektripaigaldiste%20auditi%20juhendmaterjal%2012.1.pdf",
  });
});

test("the existing 'Excel ei ole käiduraamat.' message stays", () => {
  assert.equal(et.landing.excel.title, "Excel ei ole käiduraamat.");
});

test("English and Russian have the same three conditions", () => {
  for (const m of [en, ru]) assert.equal(m.landing.whoNeeds.items.length, 3);
});
