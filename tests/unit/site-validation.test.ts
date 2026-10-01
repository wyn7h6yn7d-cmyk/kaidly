import { test } from "node:test";
import assert from "node:assert/strict";
import { installationSchema, isUuid, siteSchema } from "../../lib/validation/sites.ts";

const base = {
  siteId: "5a000000-0000-4000-8000-000000000001",
  name: "Peajaotuskilp",
  installationType: "switchboard",
  status: "in_service",
};

test("site: trims, requires a name, turns empty optionals into undefined", () => {
  const parsed = siteSchema.parse({ name: "  Objekt  ", address: "", description: "  ", responsiblePerson: "Mari" });
  assert.deepEqual(parsed, { name: "Objekt", address: undefined, description: undefined, responsiblePerson: "Mari" });
  assert.equal(siteSchema.safeParse({ name: "   " }).success, false);
  assert.equal(siteSchema.safeParse({ name: "x".repeat(201) }).success, false);
});

test("installation: accepts minimal valid input", () => {
  assert.equal(installationSchema.safeParse(base).success, true);
});

test("installation: rejects unknown type, status and malformed site id", () => {
  assert.equal(installationSchema.safeParse({ ...base, installationType: "nuclear" }).success, false);
  assert.equal(installationSchema.safeParse({ ...base, status: "decommissioned" }).success, false);
  assert.equal(installationSchema.safeParse({ ...base, siteId: "1 or 1=1" }).success, false);
});

test("installation: commissioning date must be a past or present YYYY-MM-DD", () => {
  assert.equal(installationSchema.safeParse({ ...base, commissionedOn: "2019-06-01" }).success, true);
  assert.equal(installationSchema.safeParse({ ...base, commissionedOn: "" }).success, true);
  const future = installationSchema.safeParse({ ...base, commissionedOn: "2999-01-01" });
  assert.equal(future.success, false);
  assert.ok(!future.success && future.error.issues.some((issue) => issue.message === "future"));
  assert.equal(installationSchema.safeParse({ ...base, commissionedOn: "1899-12-31" }).success, false);
  assert.equal(installationSchema.safeParse({ ...base, commissionedOn: "01.06.2019" }).success, false);
});

test("isUuid guards route parameters", () => {
  assert.equal(isUuid("5a000000-0000-4000-8000-000000000001"), true);
  assert.equal(isUuid("not-a-uuid"), false);
  assert.equal(isUuid("../../etc/passwd"), false);
});
