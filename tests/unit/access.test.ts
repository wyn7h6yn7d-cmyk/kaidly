import { test } from "node:test";
import assert from "node:assert/strict";
import { contactMailto } from "../../lib/access.ts";
import { onboardingSteps, type OnboardingCounts } from "../../lib/onboarding.ts";
import { et } from "../../lib/i18n/et.ts";

test("contact CTA: a configured address gives a safe mailto with the subject", () => {
  const subject = et.access.mailSubject("Näidis OÜ");
  assert.equal(subject, "KAIDLY täiskasutuse jätkamine (Näidis OÜ)");
  assert.equal(
    contactMailto(" info@example.ee ", subject),
    "mailto:info@example.ee?subject=KAIDLY%20t%C3%A4iskasutuse%20j%C3%A4tkamine%20(N%C3%A4idis%20O%C3%9C)",
  );
});

test("contact CTA: no link without a usable address", () => {
  for (const value of [undefined, "", "   ", "not-an-address", "a@b.ee?cc=evil@x.ee", "a@b.ee\r\nBcc: evil@x.ee", "javascript:alert(1)"]) {
    assert.equal(contactMailto(value, "x"), null, String(value));
  }
});

const counts: OnboardingCounts = { sites: 1, installations: 0, entries: 0, activities: 0, documents: 0 };
const ctx = (role: "owner" | "admin" | "operator" | "viewer", readOnly: "trial" | "access" | null) => ({
  orgSlug: "firma",
  role,
  firstSiteId: "s1",
  firstInstallationId: null,
  readOnly,
});
const byKey = (steps: ReturnType<typeof onboardingSteps>) => Object.fromEntries(steps.map((s) => [s.key, s]));

test("expired company: steps the role allows are blocked by the ended trial, not by role", () => {
  const s = byKey(onboardingSteps(counts, ctx("admin", "trial")));
  assert.equal(s.installation.blockedBy, "trial_ended");
  assert.equal(s.installation.href, null);
  assert.equal(byKey(onboardingSteps(counts, ctx("owner", "access"))).installation.blockedBy, "access_ended");
});

test("a genuine role limit is still explained by role, also while expired", () => {
  assert.equal(byKey(onboardingSteps(counts, ctx("viewer", "trial"))).installation.blockedBy, "role");
  assert.equal(byKey(onboardingSteps(counts, ctx("operator", null))).activity.blockedBy, "role");
  // Writable company: prerequisites and links as before.
  const s = byKey(onboardingSteps(counts, ctx("admin", null)));
  assert.equal(s.installation.blockedBy, null);
  assert.equal(s.installation.href, "/o/firma/paigaldised/uus?objekt=s1");
  assert.equal(s.entry.blockedBy, "installation");
});
