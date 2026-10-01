import { test } from "node:test";
import assert from "node:assert/strict";
import { assignableRoles, canManageMember, hasRole, isRole } from "../../lib/auth/roles.ts";

test("role order is owner > admin > operator > viewer", () => {
  assert.ok(hasRole("owner", "admin"));
  assert.ok(hasRole("admin", "operator"));
  assert.ok(hasRole("operator", "viewer"));
  assert.ok(!hasRole("operator", "admin"));
  assert.ok(!hasRole("viewer", "operator"));
});

test("only admins and owners manage members; only owners manage owners", () => {
  assert.ok(canManageMember("owner", "owner"));
  assert.ok(canManageMember("admin", "operator"));
  assert.ok(!canManageMember("admin", "owner"));
  assert.ok(!canManageMember("operator", "viewer"));
  assert.ok(!canManageMember("viewer", "viewer"));
});

test("admins cannot assign the owner role", () => {
  assert.deepEqual(assignableRoles("owner"), ["owner", "admin", "operator", "viewer"]);
  assert.deepEqual(assignableRoles("admin"), ["admin", "operator", "viewer"]);
  assert.deepEqual(assignableRoles("operator"), []);
});

test("isRole rejects anything else", () => {
  assert.ok(isRole("viewer"));
  assert.ok(!isRole("superuser"));
  assert.ok(!isRole(undefined));
});
