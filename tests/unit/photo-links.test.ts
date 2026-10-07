import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhotosUrl, photosLinkHost } from "../../lib/photo-links.ts";
import { deficiencySchema } from "../../lib/validation/deficiencies.ts";

test("https links to any provider are accepted, trimmed and normalised", () => {
  assert.equal(normalizePhotosUrl("  https://drive.google.com/drive/folders/abc?usp=sharing  "), "https://drive.google.com/drive/folders/abc?usp=sharing");
  assert.equal(normalizePhotosUrl("https://1drv.ms/f/s!abc"), "https://1drv.ms/f/s!abc");
  assert.equal(normalizePhotosUrl("https://www.dropbox.com/scl/fo/x/y?dl=0"), "https://www.dropbox.com/scl/fo/x/y?dl=0");
  assert.equal(normalizePhotosUrl("https://firma.sharepoint.com/sites/kilbid/Shared%20Documents"), "https://firma.sharepoint.com/sites/kilbid/Shared%20Documents");
  assert.equal(normalizePhotosUrl("HTTPS://Example.COM/Fotod"), "https://example.com/Fotod");
  assert.equal(normalizePhotosUrl("https://fotod.example.ee:8443/album"), "https://fotod.example.ee:8443/album");
});

test("empty means no link", () => {
  assert.equal(normalizePhotosUrl(""), null);
  assert.equal(normalizePhotosUrl("   "), null);
  assert.equal(normalizePhotosUrl(undefined), null);
});

test("anything but a plain https link is refused", () => {
  for (const value of [
    "http://example.com/fotod",
    "javascript:alert(1)",
    "data:text/html,<b>x</b>",
    "ftp://example.com/x",
    "example.com/fotod",
    "//example.com/fotod",
    "https://",
    "https://intranet/fotod",
    "https://user:salasona@example.com/x",
    "https://example.com/a b",
    "https:// example.com",
    `https://example.com/${"a".repeat(2000)}`,
  ]) {
    assert.equal(normalizePhotosUrl(value), "invalid", value);
  }
});

test("the saved link is shown by its host", () => {
  assert.equal(photosLinkHost("https://www.dropbox.com/scl/fo/x"), "dropbox.com");
  assert.equal(photosLinkHost("https://drive.google.com/drive/folders/abc"), "drive.google.com");
  assert.equal(photosLinkHost("not a url"), "");
});

test("forms: an invalid link is reported as the url issue, an empty one is optional", () => {
  const base = {
    installationId: "5a000000-0000-4000-8000-000000000001",
    title: "Kilbi uks",
    description: "Ei sulgu",
    severity: "low",
    detectedAt: "2026-10-01T10:00",
  };
  const bad = deficiencySchema.safeParse({ ...base, photosUrl: "http://x.ee" });
  assert.equal(bad.success, false);
  assert.ok(!bad.success && bad.error.issues.some((i) => i.path[0] === "photosUrl" && i.message === "url"));
  const empty = deficiencySchema.parse({ ...base, photosUrl: " " });
  assert.equal(empty.photosUrl, undefined);
  const good = deficiencySchema.parse({ ...base, photosUrl: " https://example.com/f " });
  assert.equal(good.photosUrl, "https://example.com/f");
});
