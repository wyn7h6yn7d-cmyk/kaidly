import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_AFTER_LOGIN, safeRedirectPath } from "../../lib/auth/redirect.ts";

const ORIGIN = "https://kaidly.ee";

test("allows known internal application paths", () => {
  for (const path of [
    "/o",
    "/o/kinnisvara-ou",
    "/o/kinnisvara-ou/paigaldised/9b2f4c1e-0d6a-4f7e-8a51-2c3d4e5f6a7b",
    "/konto",
    "/auth/update-password",
    "/invite/AbC123_-xyz",
  ]) {
    assert.equal(safeRedirectPath(path, ORIGIN), path, path);
  }
});

test("falls back to the default for missing values", () => {
  assert.equal(safeRedirectPath(null, ORIGIN), DEFAULT_AFTER_LOGIN);
  assert.equal(safeRedirectPath(undefined, ORIGIN), DEFAULT_AFTER_LOGIN);
  assert.equal(safeRedirectPath("", ORIGIN), DEFAULT_AFTER_LOGIN);
});

test("rejects open-redirect attempts", () => {
  for (const attack of [
    "https://evil.example/o",
    "http://evil.example",
    "//evil.example/o",
    "/\\evil.example",
    "\\\\evil.example",
    "/o/../../evil",
    "/o//evil.example",
    "javascript:alert(1)",
    "/o?next=https://evil.example",
    "/o#https://evil.example",
    "/o/%2F%2Fevil.example",
    "o",
    " /o",
    "/o\n",
    "https://kaidly.ee.evil.example/o",
  ]) {
    assert.equal(safeRedirectPath(attack, ORIGIN), DEFAULT_AFTER_LOGIN, JSON.stringify(attack));
  }
});

test("rejects internal paths that are not on the allowlist", () => {
  for (const path of ["/", "/auth/login", "/auth/confirm", "/protected", "/api/anything"]) {
    assert.equal(safeRedirectPath(path, ORIGIN), DEFAULT_AFTER_LOGIN, path);
  }
});

test("reduces a same-origin absolute URL to its allowed path", () => {
  assert.equal(safeRedirectPath(`${ORIGIN}/o`, ORIGIN), "/o");
  assert.equal(safeRedirectPath(`${ORIGIN}/konto`, ORIGIN), "/konto");
});

test("rejects same-origin URLs with query or fragment, and other origins", () => {
  assert.equal(safeRedirectPath(`${ORIGIN}/o?x=1`, ORIGIN), DEFAULT_AFTER_LOGIN);
  assert.equal(safeRedirectPath(`${ORIGIN}/o#x`, ORIGIN), DEFAULT_AFTER_LOGIN);
  assert.equal(safeRedirectPath("https://other.ee/o", ORIGIN), DEFAULT_AFTER_LOGIN);
});

test("absolute URLs are rejected when no origin is given", () => {
  assert.equal(safeRedirectPath(`${ORIGIN}/o`), DEFAULT_AFTER_LOGIN);
});

test("rejects overly long values", () => {
  assert.equal(safeRedirectPath(`/o/${"a".repeat(300)}`, ORIGIN), DEFAULT_AFTER_LOGIN);
});
