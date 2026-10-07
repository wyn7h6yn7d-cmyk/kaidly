import { test } from "node:test";
import assert from "node:assert/strict";
import { DOCUMENT_CATEGORIES, isImageType, LINK_CATEGORIES } from "../../lib/documents/rules.ts";

test("new documents are links: their categories exclude 'Foto' (earlier files only)", () => {
  assert.ok(!(LINK_CATEGORIES as readonly string[]).includes("photo"));
  for (const category of LINK_CATEGORIES) assert.ok(DOCUMENT_CATEGORIES.includes(category));
  assert.equal(LINK_CATEGORIES.length, DOCUMENT_CATEGORIES.length - 1);
});

test("files uploaded earlier: only real image types get a thumbnail", () => {
  assert.equal(isImageType("image/jpeg"), true);
  assert.equal(isImageType("image/png"), true);
  assert.equal(isImageType("image/webp"), true);
  assert.equal(isImageType("image/svg+xml"), false);
  assert.equal(isImageType("application/pdf"), false);
  assert.equal(isImageType(null), false);
});
