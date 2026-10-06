#!/usr/bin/env node
// KAIDLY — functional checks after a restore REHEARSAL on the local stack
// (docs/PRODUCTION_BACKUP_RECOVERY.md §5). Signs in as real restored users through the
// normal API (publishable key, RLS) and checks what a customer would rely on:
//   node scripts/verify-restore.mjs --manifest <storage manifest.json> \
//     --user <email> --password <password> --other <email of a user in another company>
// Local stack only. Writes one test log entry (then it is part of the rehearsal database).
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const value = (flag) => args[args.indexOf(flag) + 1];
const manifest = JSON.parse(readFileSync(value("--manifest"), "utf8"));
const [email, password, other] = [value("--user"), value("--password"), value("--other")];
const status = JSON.parse(execFileSync("npx", ["--no-install", "supabase", "status", "-o", "json"], { encoding: "utf8" }).replace(/^[^{]*/, ""));
const sql = (q) =>
  execFileSync("docker", ["exec", "-i", "supabase_db_kaidly", "psql", "-U", "postgres", "-qtA", "-c", q], { encoding: "utf8" }).trim();

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? "ok" : "NOT OK"} - ${label}`);
  if (!ok) failures += 1;
};

// Schema and jobs come from the migrations.
check(Number(sql("select count(*) from supabase_migrations.schema_migrations")) > 0, "migrations recorded");
check(sql("select string_agg(jobname, ',' order by jobname) from cron.job").split(",").includes("kaidly-activity-reminders"), "reminder job exists");
check(sql("select count(*) from vault.secrets where name = 'RESEND_API_KEY'") === "0", "Vault secrets are not in a backup (re-enter RESEND_API_KEY by hand)");

const client = createClient(status.API_URL, status.PUBLISHABLE_KEY ?? status.ANON_KEY, { auth: { persistSession: false } });
const { data: session, error: signInError } = await client.auth.signInWithPassword({ email, password });
check(!signInError && Boolean(session.user), `restored user signs in with the old password (${email})`);
const userId = session.user?.id;

// Sequences continue after the restored rows (otherwise new rows collide).
const behind = sql(`select count(*) from (
  select s.schemaname, s.sequencename, s.last_value,
         (xpath('/row/m/text()', query_to_xml(format('select max(%I) as m from %I.%I', a.attname, n.nspname, c.relname), false, true, '')))[1]::text::bigint as max_id
    from pg_sequences s
    join pg_class sc on sc.relname = s.sequencename
    join pg_namespace sn on sn.oid = sc.relnamespace and sn.nspname = s.schemaname
    join pg_depend d on d.objid = sc.oid and d.deptype in ('a', 'i')
    join pg_class c on c.oid = d.refobjid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum = d.refobjsubid
   where s.schemaname in ('public', 'private', 'auth')) x
 where max_id is not null and coalesce(last_value, 0) < max_id`);
check(behind === "0", "every sequence is past its table's highest id");

// Tenant isolation: only own companies; another company's rows are invisible.
const { data: orgs } = await client.from("organisations").select("id");
const expectedOrgs = sql(`select count(*) from public.organisation_members where user_id = '${userId}'`);
check(orgs?.length === Number(expectedOrgs), `RLS: sees exactly their ${expectedOrgs} companies`);
const foreignOrg = sql(`select organisation_id from public.organisation_members m join auth.users u on u.id = m.user_id
  where u.email = '${other}' and organisation_id not in (select organisation_id from public.organisation_members where user_id = '${userId}') limit 1`);
const { data: foreign } = await client.from("organisations").select("id").eq("id", foreignOrg);
check(foreign?.length === 0, "RLS: another company is not visible");
const { data: foreignLog } = await client.from("log_entries").select("id").eq("organisation_id", foreignOrg).limit(1);
check(foreignLog?.length === 0, "RLS: another company's operating log is not visible");

// Append-only operating log.
const entry = sql(`select l.id from public.log_entries l join public.organisation_members m on m.organisation_id = l.organisation_id
  where m.user_id = '${userId}' order by l.created_at limit 1`);
const before = sql(`select description from public.log_entries where id = '${entry}'`);
await client.from("log_entries").update({ description: "muudetud" }).eq("id", entry);
await client.from("log_entries").delete().eq("id", entry);
check(sql(`select description from public.log_entries where id = '${entry}'`) === before, "operating log stays append-only (no update, no delete)");

// Triggers are active again after the restore session (which ran with them off).
const target = sql(`select l.organisation_id || ',' || l.site_id || ',' || l.electrical_installation_id from public.log_entries l
  join public.organisation_members m on m.organisation_id = l.organisation_id and m.user_id = '${userId}' and m.role in ('owner','admin')
  join private.organisation_access a on a.organisation_id = l.organisation_id limit 1`).split(",");
if (target.length === 3) {
  const { data: added, error } = await client
    .from("log_entries")
    .insert({ organisation_id: target[0], site_id: target[1], electrical_installation_id: target[2], entry_type: "inspection", description: "Taastamise kontroll" })
    .select("id")
    .single();
  check(!error && Boolean(added), "writing works after the restore (new log entry)");
  // Change history (sites, installations, plan, …) is written by triggers again.
  const { data: site } = await client.from("sites").insert({ organisation_id: target[0], name: "Taastamise kontrollobjekt" }).select("id").single();
  if (site) check(sql(`select count(*) from public.activity_history where record_id = '${site.id}'`) === "1", "history trigger fired for a new site");
  else check(false, "a new site could be created");
}

// Files: a document the user may read opens through a signed URL and equals the backup.
const doc = sql(`select d.storage_path from public.documents d join public.organisation_members m on m.organisation_id = d.organisation_id
  where m.user_id = '${userId}' and d.status = 'ready' and exists (select 1 from storage.objects o where o.bucket_id = 'documents' and o.name = d.storage_path) limit 1`);
if (doc) {
  const { data: signed } = await client.storage.from("documents").createSignedUrl(doc, 60);
  const bytes = Buffer.from(await (await fetch(signed.signedUrl)).arrayBuffer());
  const original = manifest.files.find((f) => f.path === `documents/${doc}`);
  check(original && createHash("sha256").update(bytes).digest("hex") === original.sha256, "restored file opens via a signed URL and matches the backup byte for byte");
} else {
  check(false, "no readable document with a file for this user");
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll restore checks passed.");
process.exit(failures ? 1 : 0);
