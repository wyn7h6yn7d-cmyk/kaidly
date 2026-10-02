import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDeploymentTarget, SUPABASE_REFS } from "../../lib/env-guard.ts";

const url = (ref: string) => `https://${ref}.supabase.co`;

test("Production must use the production project", () => {
  assert.deepEqual(checkDeploymentTarget({ VERCEL_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: url(SUPABASE_REFS.production), KAIDLY_SITE_URL: "https://kaidly.ee" }), { errors: [], warnings: [] });
  assert.match(checkDeploymentTarget({ VERCEL_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: url(SUPABASE_REFS.development) }).errors[0], /DEVELOPMENT/);
  // The earlier one-letter typo (msbl instead of msbi) is caught too.
  assert.equal(checkDeploymentTarget({ VERCEL_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: "https://xakpbtmksxvjmsblpwmj.supabase.co" }).errors.length, 1);
  assert.match(checkDeploymentTarget({ VERCEL_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: url(SUPABASE_REFS.production) }).warnings[0], /KAIDLY_SITE_URL/);
});

test("Preview must not use the production project; local only warns", () => {
  assert.equal(checkDeploymentTarget({ VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: url(SUPABASE_REFS.development) }).errors.length, 0);
  assert.match(checkDeploymentTarget({ VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: url(SUPABASE_REFS.production) }).errors[0], /PRODUCTION/);
  assert.match(checkDeploymentTarget({ VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: url(SUPABASE_REFS.development), KAIDLY_SITE_URL: "https://kaidly.ee" }).warnings[0], /Production/);
  const local = checkDeploymentTarget({ NEXT_PUBLIC_SUPABASE_URL: url(SUPABASE_REFS.production) });
  assert.equal(local.errors.length, 0);
  assert.equal(local.warnings.length, 1);
  assert.deepEqual(checkDeploymentTarget({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }), { errors: [], warnings: [] });
});
