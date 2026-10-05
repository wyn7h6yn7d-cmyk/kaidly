import { test } from "node:test";
import assert from "node:assert/strict";
import { checkFile, MAX_FILE_BYTES, sanitizeFilename, titleFromFilename } from "../../lib/documents/rules.ts";

const file = (name: string, type: string, size = 1000) => ({ name, type, size });

test("allowed types with a matching extension pass", () => {
  assert.equal(checkFile(file("skeem.pdf", "application/pdf")), null);
  assert.equal(checkFile(file("FOTO.JPG", "image/jpeg")), null);
  assert.equal(checkFile(file("foto.jpeg", "image/jpeg")), null);
  assert.equal(checkFile(file("a.png", "image/png")), null);
  assert.equal(checkFile(file("a.webp", "image/webp")), null);
  assert.equal(
    checkFile(file("akt.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")),
    null,
  );
  assert.equal(
    checkFile(file("tabel.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")),
    null,
  );
});

test("SVG, HTML, executables and unknown types are refused", () => {
  assert.equal(checkFile(file("x.svg", "image/svg+xml")), "type");
  assert.equal(checkFile(file("x.html", "text/html")), "type");
  assert.equal(checkFile(file("x.exe", "application/octet-stream")), "type");
  assert.equal(checkFile(file("x.heic", "image/heic")), "type");
  assert.equal(checkFile(file("x", "")), "type");
});

test("type and extension must agree", () => {
  assert.equal(checkFile(file("x.svg", "image/png")), "type");
  assert.equal(checkFile(file("x.pdf.html", "application/pdf")), "type");
  assert.equal(checkFile(file("x.png", "application/pdf")), "type");
  assert.equal(checkFile(file("pdf", "application/pdf")), "type");
});

test("size limits", () => {
  assert.equal(checkFile(file("a.pdf", "application/pdf", MAX_FILE_BYTES)), null);
  assert.equal(checkFile(file("a.pdf", "application/pdf", MAX_FILE_BYTES + 1)), "size");
  assert.equal(checkFile(file("a.pdf", "application/pdf", 0)), "empty");
});

test("filenames are display names without paths or control characters", () => {
  assert.equal(sanitizeFilename("../../etc/passwd"), "passwd");
  assert.equal(sanitizeFilename("C:\\Users\\x\\skeem.pdf"), "skeem.pdf");
  assert.equal(sanitizeFilename("a\u0000b\nc.pdf"), "abc.pdf");
  assert.equal(sanitizeFilename("  mõõte   protokoll.pdf "), "mõõte protokoll.pdf");
  assert.equal(sanitizeFilename(".."), "file");
  const long = sanitizeFilename(`${"a".repeat(300)}.pdf`);
  assert.equal(long.length, 255);
  assert.ok(long.endsWith(".pdf"));
});

test("titles come from the filename without the extension", () => {
  assert.equal(titleFromFilename("PJK-1_mõõteprotokoll.pdf"), "PJK-1 mõõteprotokoll");
  assert.equal(titleFromFilename("foto.jpg"), "foto");
});

test("title suggestion never ends in a space after the 200-character cap", () => {
  const name = `${"a".repeat(199)} b.pdf`;
  const title = titleFromFilename(name);
  assert.ok(title.length <= 200);
  assert.equal(title, title.trim());
});
