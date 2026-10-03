import { test } from "node:test";
import assert from "node:assert/strict";
import { safeLogPath } from "../../lib/log-path.ts";

test("error log paths drop query strings and invitation tokens", () => {
  assert.equal(safeLogPath("/invite/abcDEF123secret"), "/invite/[token]");
  assert.equal(safeLogPath("/invite/abcDEF123secret?next=/o"), "/invite/[token]");
  assert.equal(safeLogPath("/auth/confirm?token_hash=xyz&type=recovery"), "/auth/confirm");
  assert.equal(safeLogPath("/o/firma/paevik#x"), "/o/firma/paevik");
});
