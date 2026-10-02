import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { emailChangeSchema, passwordChangeSchema } from "../../lib/validation/account.ts";
import { organisationSettingsSchema } from "../../lib/validation/organisations.ts";
import { fmtDays } from "../../lib/admin/format.ts";

const issue = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;

test("password change: confirmation must match, the new password must be long enough and different", () => {
  const ok = { currentPassword: "vana-parool-123", newPassword: "uus-parool-456", confirmPassword: "uus-parool-456" };
  assert.equal(passwordChangeSchema.safeParse(ok).success, true);
  assert.equal(issue(passwordChangeSchema.safeParse({ ...ok, confirmPassword: "uus-parool-457" })), "mismatch");
  assert.equal(issue(passwordChangeSchema.safeParse({ ...ok, newPassword: "lühike", confirmPassword: "lühike" })), "weak");
  assert.equal(
    issue(passwordChangeSchema.safeParse({ ...ok, newPassword: ok.currentPassword, confirmPassword: ok.currentPassword })),
    "same",
  );
  assert.equal(passwordChangeSchema.safeParse({ ...ok, currentPassword: "" }).success, false);
  // Passwords are passed on exactly as typed (no trimming).
  const spaced = { ...ok, newPassword: " uus-parool-456 ", confirmPassword: " uus-parool-456 " };
  assert.equal(passwordChangeSchema.parse(spaced).newPassword, " uus-parool-456 ");
});

test("email change normalises the address and rejects non-addresses", () => {
  assert.equal(emailChangeSchema.parse("  Uus@Firma.EE "), "uus@firma.ee");
  assert.equal(emailChangeSchema.safeParse("pole-e-post").success, false);
});

test("company settings: optional contact fields, validated email, no slug", () => {
  const parsed = organisationSettingsSchema.parse({
    name: " Firma OÜ ",
    registryCode: "",
    contactEmail: " INFO@firma.ee ",
    contactPhone: "",
    address: "Tööstuse 1",
    notes: "",
  });
  assert.deepEqual(parsed, { name: "Firma OÜ", registryCode: undefined, contactEmail: "info@firma.ee", contactPhone: undefined, address: "Tööstuse 1", notes: undefined });
  assert.equal(organisationSettingsSchema.safeParse({ name: "X", contactEmail: "pole" }).success, false);
  assert.equal("slug" in organisationSettingsSchema.shape, false);
});

test("admin countdown wording", () => {
  assert.equal(fmtDays(0), "Tähtaeg täna");
  assert.equal(fmtDays(-3), "3 päeva üle tähtaja");
  assert.equal(fmtDays(1), "1 päev jäänud");
  assert.equal(fmtDays(14), "14 päeva jäänud");
});

// Credentials never travel in URLs or through browser code paths that could log them.
const ROOT = new URL("../../", import.meta.url).pathname;
function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name);
    return statSync(join(ROOT, path)).isDirectory() ? sources(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}
const APP_CODE = ["app", "components", "lib"].flatMap(sources);

test("no service-role key anywhere in application code", () => {
  for (const file of APP_CODE) {
    const text = readFileSync(join(ROOT, file), "utf8");
    assert.doesNotMatch(text, /SERVICE_ROLE|service_role_key|sb_secret_/i, file);
  }
});

test("account and auth forms post passwords in the request body, never in a URL", () => {
  for (const file of APP_CODE.filter((f) => /components\/(account|auth)\//.test(f))) {
    const text = readFileSync(join(ROOT, file), "utf8");
    if (!/type="password"/.test(text)) continue;
    assert.doesNotMatch(text, /method="get"/i, file);
    assert.match(text, /method="post"|action=\{/, file);
    assert.doesNotMatch(text, /console\.(log|info|debug|error)/, file);
  }
  const account = readFileSync(join(ROOT, "lib/actions/account.ts"), "utf8");
  assert.doesNotMatch(account, /console\./);
  assert.doesNotMatch(account, /redirect\([^)]*assword/);
});

test("platform admin access is never decided by an email address in code", () => {
  for (const file of APP_CODE) {
    const text = readFileSync(join(ROOT, file), "utf8");
    assert.doesNotMatch(text, /kennethalto95/i, file);
  }
});
