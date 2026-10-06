#!/usr/bin/env node
// Two real database sessions against the LOCAL stack: while one e-mail processor runs
// (simulated by holding its lock), a second one must not process anything.
// pgTAP runs in a single session and cannot show this. Writes nothing; sends nothing.
import { spawn, execFileSync } from "node:child_process";

const CONTAINER = "supabase_db_kaidly";
const LOCK = "select pg_advisory_xact_lock(hashtext('kaidly-email-outbox'))";
const psql = (sql) =>
  execFileSync("docker", ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-qtA", "-v", "ON_ERROR_STOP=1"], {
    input: sql,
    encoding: "utf8",
  }).trim();

const holder = spawn("docker", ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-qtA", "-v", "ON_ERROR_STOP=1"]);
holder.stdin.end(`begin; ${LOCK}; select 'locked'; select pg_sleep(4); rollback;`);
await new Promise((resolve, reject) => {
  holder.stdout.on("data", (chunk) => String(chunk).includes("locked") && resolve());
  holder.on("exit", () => reject(new Error("lock holder exited early")));
});

const second = psql("begin; select private.process_email_outbox(); rollback;");
await new Promise((resolve) => holder.on("exit", resolve));
const after = psql("begin; select private.process_email_outbox() ->> 'skipped'; rollback;");

const ok = second.includes('"skipped": "locked"') && after === "";
console.log(ok ? "ok - a concurrent e-mail processor backs off; it runs once the first one is done" : `not ok - concurrent run returned ${second} / ${after}`);
process.exit(ok ? 0 : 1);
