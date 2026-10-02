// Hard guard for QA fixture tooling: it must never run against PRODUCTION. Pure function
// (unit-tested in tests/unit/qa-guard.test.ts); scripts/qa-fixtures.mjs calls it before
// touching any database.
export const PRODUCTION_REF = "xakpbtmksxvjmsbipwmj";

/**
 * Throws when anything in the environment, the CLI link or the target URL points at the
 * production project, or when the target is not a local stack.
 * @param {{ env: Record<string, string | undefined>, linkedRef?: string, targetUrl: string }} input
 */
export function assertQaTarget({ env, linkedRef = "", targetUrl }) {
  const hits = Object.entries(env)
    .filter(([, value]) => typeof value === "string" && value.includes(PRODUCTION_REF))
    .map(([name]) => name);
  if (hits.length > 0) {
    throw new Error(`ABORT: production project ref found in environment (${hits.join(", ")}).`);
  }
  if (linkedRef.trim() === PRODUCTION_REF) {
    throw new Error("ABORT: the Supabase CLI is linked to PRODUCTION. Re-link development first.");
  }
  if (targetUrl.includes(PRODUCTION_REF)) throw new Error("ABORT: target is PRODUCTION.");
  let host = "";
  try {
    host = new URL(targetUrl).hostname;
  } catch {
    throw new Error(`ABORT: invalid target URL.`);
  }
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`ABORT: QA fixtures run only against the LOCAL Supabase stack (got ${host}).`);
  }
}
