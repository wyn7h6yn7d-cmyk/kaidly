import { test } from "node:test";
import assert from "node:assert/strict";
import { onboardingComplete, onboardingSteps, type OnboardingCounts } from "../../lib/onboarding.ts";

const none: OnboardingCounts = { sites: 0, installations: 0, entries: 0, activities: 0, documents: 0 };
const ctx = (role: "owner" | "admin" | "operator" | "viewer", extra = {}) => ({
  orgSlug: "firma",
  role,
  firstSiteId: null,
  firstInstallationId: null,
  ...extra,
});
const byKey = (steps: ReturnType<typeof onboardingSteps>) => Object.fromEntries(steps.map((s) => [s.key, s]));

test("a new organisation: only the organisation step is done, the first site is next", () => {
  const s = byKey(onboardingSteps(none, ctx("owner")));
  assert.equal(s.organisation.done, true);
  assert.equal(s.site.done, false);
  assert.equal(s.site.href, "/o/firma/objektid/uus");
  assert.equal(s.installation.blockedBy, "site");
  assert.equal(s.installation.href, null);
  assert.equal(s.entry.blockedBy, "site");
  assert.equal(s.activity.blockedBy, "site");
});

test("with a site but no installation, the installation step links to that site", () => {
  const s = byKey(onboardingSteps({ ...none, sites: 1 }, ctx("admin", { firstSiteId: "s1" })));
  assert.equal(s.site.done, true);
  assert.equal(s.installation.href, "/o/firma/paigaldised/uus?objekt=s1");
  assert.equal(s.entry.blockedBy, "installation");
  assert.equal(s.activity.blockedBy, "installation");
  // Admins can add organisation-level documents without an installation.
  assert.equal(s.document.href, "/o/firma/dokumendid/uus");
});

test("with an installation, entry and activity link to their forms", () => {
  const s = byKey(onboardingSteps({ ...none, sites: 1, installations: 1 }, ctx("owner", { firstInstallationId: "i1" })));
  assert.equal(s.entry.href, "/o/firma/sissekanne");
  assert.equal(s.activity.href, "/o/firma/kaidukava/uus?paigaldis=i1");
});

test("roles: operators can't add sites or plan activities; viewers can't do anything", () => {
  const counts = { ...none, sites: 1, installations: 1 };
  const op = byKey(onboardingSteps(counts, ctx("operator", { firstInstallationId: "i1" })));
  assert.equal(op.activity.blockedBy, "role");
  assert.equal(op.activity.href, null);
  assert.equal(op.entry.href, "/o/firma/sissekanne");
  assert.equal(op.document.href, "/o/firma/dokumendid/uus?paigaldis=i1");
  const viewer = byKey(onboardingSteps(none, ctx("viewer")));
  assert.equal(viewer.site.blockedBy, "role");
  assert.equal(viewer.site.href, null);
});

test("complete when every step has real data; deficiencies are not required", () => {
  const all = { sites: 1, installations: 1, entries: 1, activities: 1, documents: 1 };
  assert.equal(onboardingComplete(onboardingSteps(all, ctx("owner"))), true);
  assert.equal(onboardingComplete(onboardingSteps({ ...all, documents: 0 }, ctx("owner"))), false);
  assert.ok(onboardingSteps(all, ctx("owner")).every((s) => s.href === null && s.blockedBy === null));
});
