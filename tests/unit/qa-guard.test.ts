import { test } from "node:test";
import assert from "node:assert/strict";
import { assertQaTarget, PRODUCTION_REF } from "../../scripts/qa-guard.mjs";

const local = "http://127.0.0.1:54321";

test("QA guard accepts the local stack", () => {
  assert.doesNotThrow(() =>
    assertQaTarget({ env: { HOME: "/x" }, linkedRef: "gdpzavhkblbcxivoaqax", targetUrl: local }),
  );
});

test("QA guard aborts on the production ref anywhere", () => {
  assert.throws(
    () => assertQaTarget({ env: { NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co` }, targetUrl: local }),
    /ABORT.*NEXT_PUBLIC_SUPABASE_URL/,
  );
  assert.throws(() => assertQaTarget({ env: {}, linkedRef: `${PRODUCTION_REF}\n`, targetUrl: local }), /PRODUCTION/);
  assert.throws(() => assertQaTarget({ env: {}, targetUrl: `https://${PRODUCTION_REF}.supabase.co` }), /PRODUCTION/);
});

test("QA guard refuses hosted projects, including development", () => {
  assert.throws(() => assertQaTarget({ env: {}, targetUrl: "https://gdpzavhkblbcxivoaqax.supabase.co" }), /LOCAL/);
  assert.throws(() => assertQaTarget({ env: {}, targetUrl: "not a url" }), /invalid/);
});
