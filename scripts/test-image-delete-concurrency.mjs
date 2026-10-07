#!/usr/bin/env node
// Deleting an image under real concurrency (LOCAL stack only): two members press
// "Kustuta pilt" on the same image at the same moment. Both requests must succeed (the
// second one gets the path again, so its Storage removal is a harmless repeat), the image
// is marked deleted exactly once with one deleter, and the change history has one deletion.
// pgTAP runs in a single session and cannot show this. A throw-away company is committed
// for the test and removed again afterwards.
import { spawn, execFileSync } from "node:child_process";

const CONTAINER = "supabase_db_kaidly";
const ORG = "0d000000-0000-4000-8000-0000000d0d0d";
const SITE = "5d000000-0000-4000-8000-0000000d0d0d";
const INST = "1d000000-0000-4000-8000-0000000d0d0d";
const DEF = "df000000-0000-4000-8000-0000000d0d0d";
const DOC = "dc000000-0000-4000-8000-0000000d0d0d";
const USERS = ["d1000000-0000-4000-8000-0000000d0d01", "d1000000-0000-4000-8000-0000000d0d02"];
const args = ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-qtA", "-v", "ON_ERROR_STOP=1"];
const psql = (sql) => execFileSync("docker", args, { input: sql, encoding: "utf8" }).trim();

function session(sql) {
  return new Promise((resolve) => {
    const child = spawn("docker", args.filter((a) => a !== "ON_ERROR_STOP=1" && a !== "-v"));
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("exit", () => resolve(out));
    child.stdin.end(sql);
  });
}

function cleanup() {
  const users = USERS.map((u) => `'${u}'`).join(", ");
  psql(`set session_replication_role = replica;
    select set_config('storage.allow_delete_query', 'true', false);
    delete from storage.objects where bucket_id = 'documents' and name like '${ORG}/%';
    delete from public.activity_history where organisation_id = '${ORG}';
    delete from public.documents where organisation_id = '${ORG}';
    delete from public.deficiencies where organisation_id = '${ORG}';
    delete from public.electrical_installations where organisation_id = '${ORG}';
    delete from public.sites where organisation_id = '${ORG}';
    delete from public.organisation_members where organisation_id = '${ORG}';
    delete from private.organisation_access where organisation_id = '${ORG}';
    delete from public.organisations where id = '${ORG}';
    delete from public.profiles where id in (${users});
    delete from auth.users where id in (${users});`);
}

let ok = true;
cleanup();
try {
  psql(`insert into auth.users (id, email, email_confirmed_at, aud, role) values
          ('${USERS[0]}', 'race-image-a@example.invalid', now(), 'authenticated', 'authenticated'),
          ('${USERS[1]}', 'race-image-b@example.invalid', now(), 'authenticated', 'authenticated');
        insert into public.organisations (id, name, slug) values ('${ORG}', 'Pildi OÜ', 'pildi-ou-concurrency');
        insert into public.organisation_members (organisation_id, user_id, role) values
          ('${ORG}', '${USERS[0]}', 'owner'), ('${ORG}', '${USERS[1]}', 'operator');
        insert into public.sites (id, organisation_id, name) values ('${SITE}', '${ORG}', 'Objekt');
        insert into public.electrical_installations (id, organisation_id, site_id, name, installation_type)
          values ('${INST}', '${ORG}', '${SITE}', 'Kilp', 'switchboard');
        insert into public.deficiencies (id, organisation_id, site_id, electrical_installation_id, title, description, severity, created_by)
          values ('${DEF}', '${ORG}', '${SITE}', '${INST}', 'Puudus', 'Kirjeldus', 'low', '${USERS[1]}');
        insert into public.documents (id, organisation_id, site_id, electrical_installation_id, deficiency_id, category, title,
                                      original_filename, mime_type, size_bytes, status, ready_at, uploaded_by)
          values ('${DOC}', '${ORG}', '${SITE}', '${INST}', '${DEF}', 'photo', 'Foto', 'foto.jpg', 'image/jpeg', 10, 'ready', now(), '${USERS[1]}');
        insert into storage.objects (bucket_id, name, metadata)
          select 'documents', storage_path, '{"size": 10, "mimetype": "image/jpeg"}' from public.documents where id = '${DOC}';`);

  const remove = (user) =>
    session(`begin;
      select set_config('request.jwt.claims', json_build_object('sub', '${user}', 'role', 'authenticated')::text, true);
      set local role authenticated;
      select 'path:' || public.delete_document_image('${DOC}');
      select pg_sleep(1);
      commit;`);
  const results = await Promise.all(USERS.map(remove));
  const path = psql(`select storage_path from public.documents where id = '${DOC}'`);
  const bothGotPath = results.every((r) => r.includes(`path:${path}`));
  const state = psql(`select (deleted_at is not null)::text || '/' || (deleted_by::text in ('${USERS[0]}', '${USERS[1]}'))::text
    from public.documents where id = '${DOC}'`);
  const deletions = psql(`select count(*) from public.activity_history where table_name = 'documents' and record_id = '${DOC}'
    and action = 'update' and old_data ->> 'deleted_at' is null and new_data ->> 'deleted_at' is not null`);
  const pass = bothGotPath && state === "true/true" && deletions === "1";
  ok &&= pass;
  console.log(
    `${pass ? "ok" : "not ok"} - concurrent image deletes: both succeed (${bothGotPath}), deleted once by one member (${state}), ${deletions} deletion in history`,
  );
} finally {
  cleanup();
}
process.exit(ok ? 0 : 1);
