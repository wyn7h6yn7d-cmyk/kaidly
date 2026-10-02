#!/usr/bin/env node
// LOCAL ONLY: loads fictional QA companies (supabase/qa/qa_fixtures.sql) into the local
// Supabase stack; `--perf` also loads the large performance company (qa_perf.sql).
// Hard guard (scripts/qa-guard.mjs): aborts when the production ref appears anywhere in the
// environment or the CLI link, or when the target isn't localhost. Rows are written as the
// local postgres user inside the local DB container — never through a hosted project.
//
//   npm run db:reset && npm run qa:fixtures [-- --perf]
//   Remove / reset: npm run db:reset (rebuilds the local database from migrations + seed)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { localSupabaseEnv } from "./local-supabase.mjs";
import { assertQaTarget } from "./qa-guard.mjs";

let linkedRef = "";
try {
  linkedRef = readFileSync(new URL("../supabase/.temp/project-ref", import.meta.url), "utf8");
} catch {
  // not linked
}
assertQaTarget({ env: process.env, linkedRef, targetUrl: "http://127.0.0.1" });
const env = localSupabaseEnv(); // refuses anything that isn't localhost
assertQaTarget({ env: process.env, linkedRef, targetUrl: env.API_URL });

const files = ["qa_fixtures.sql", ...(process.argv.includes("--perf") ? ["qa_perf.sql"] : [])];
for (const file of files) {
  const sql = readFileSync(new URL(`../supabase/qa/${file}`, import.meta.url), "utf8");
  const started = Date.now();
  const out = execFileSync(
    "docker",
    ["exec", "-i", "supabase_db_kaidly", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "--single-transaction", "-q"],
    { input: sql, encoding: "utf8" },
  );
  console.log(`${file}: loaded in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  console.log(out.trim());
}
console.log("QA accounts: see supabase/qa/qa_fixtures.sql (password kaidly-qa-parool).");
