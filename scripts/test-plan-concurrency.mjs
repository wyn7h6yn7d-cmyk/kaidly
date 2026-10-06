#!/usr/bin/env node
// Plan limits under real concurrency (LOCAL stack only): two database sessions try to take
// the last free installation slot / user seat at the same time; exactly one may succeed. And
// one user creating two companies at once gets one personal trial with one end date.
// pgTAP runs in a single session and cannot show this. A throw-away company is committed
// for the test and removed again afterwards.
import { spawn, execFileSync } from "node:child_process";

const CONTAINER = "supabase_db_kaidly";
const ORG = "0d000000-0000-4000-8000-0000000c0c0c";
const SITE = "5d000000-0000-4000-8000-0000000c0c0c";
const USER = "d1000000-0000-4000-8000-0000000c0c0c";
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
  psql(`set session_replication_role = replica;
    delete from public.activity_history where organisation_id = '${ORG}';
    delete from public.organisation_invitations where organisation_id = '${ORG}';
    delete from public.electrical_installations where organisation_id = '${ORG}';
    delete from public.sites where organisation_id = '${ORG}';
    delete from public.organisation_members where organisation_id = '${ORG}' or user_id = '${USER}';
    delete from private.organisation_access where organisation_id = '${ORG}'
      or organisation_id in (select id from public.organisations where created_by = '${USER}');
    delete from public.organisations where id = '${ORG}' or created_by = '${USER}';
    delete from private.user_trials where user_id = '${USER}';
    delete from public.profiles where id = '${USER}';
    delete from auth.users where id = '${USER}';`);
}

let ok = true;
cleanup();
try {
  psql(`insert into auth.users (id, email, email_confirmed_at, aud, role)
          values ('${USER}', 'race-owner@example.invalid', now(), 'authenticated', 'authenticated');
        insert into public.organisations (id, name, slug) values ('${ORG}', 'Race OÜ', 'race-ou-concurrency');
        insert into public.organisation_members (organisation_id, user_id, role) values ('${ORG}', '${USER}', 'owner');
        insert into public.sites (id, organisation_id, name) values ('${SITE}', '${ORG}', 'Race site');
        update private.organisation_access set user_limit = 2, installation_limit = 1 where organisation_id = '${ORG}';`);

  // Last installation slot: both sessions insert, hold their transaction for a moment, commit.
  const insert = (name) =>
    session(`begin;
      insert into public.electrical_installations (organisation_id, site_id, name, installation_type)
      values ('${ORG}', '${SITE}', '${name}', 'switchboard');
      select pg_sleep(1);
      commit;`);
  const results = await Promise.all([insert("Race A"), insert("Race B")]);
  const installations = psql(`select count(*) from public.electrical_installations where organisation_id = '${ORG}'`);
  const refusedI = results.filter((r) => r.includes("plan_installation_limit")).length;
  const passI = installations === "1" && refusedI === 1;
  ok &&= passI;
  console.log(`${passI ? "ok" : "not ok"} - concurrent installations at the limit: ${installations} created, ${refusedI} refused`);

  // Last seat (owner + 1): two invitations at once.
  const invite = (email, hash) =>
    session(`begin;
      insert into public.organisation_invitations (organisation_id, email, role, token_hash, invited_by, expires_at)
      values ('${ORG}', '${email}', 'operator', decode('${hash}', 'hex'), '${USER}', now() + interval '7 days');
      select pg_sleep(1);
      commit;`);
  const seats = await Promise.all([invite("race-a@example.invalid", "a".repeat(64)), invite("race-b@example.invalid", "b".repeat(64))]);
  const invitations = psql(`select count(*) from public.organisation_invitations where organisation_id = '${ORG}'`);
  const refusedS = seats.filter((r) => r.includes("plan_user_limit")).length;
  const passS = invitations === "1" && refusedS === 1;
  ok &&= passS;
  console.log(`${passS ? "ok" : "not ok"} - concurrent invitations for the last seat: ${invitations} stored, ${refusedS} refused`);

  // Personal trial: the same user creates two companies at the same moment — one trial,
  // one shared end date (no doubled trial time).
  const create = (name) =>
    session(`begin;
      select set_config('request.jwt.claims', json_build_object('sub', '${USER}', 'role', 'authenticated')::text, true);
      set local role authenticated;
      select public.create_organisation('${name}');
      select pg_sleep(1);
      commit;`);
  await Promise.all([create("Race trial A"), create("Race trial B")]);
  const trials = psql(`select count(*) from private.user_trials where user_id = '${USER}'`);
  const ends = psql(`select count(distinct a.trial_ends_at) || '/' || count(*) from public.organisations o
    join private.organisation_access a on a.organisation_id = o.id where o.created_by = '${USER}'`);
  const passT = trials === "1" && ends === "1/2";
  ok &&= passT;
  console.log(`${passT ? "ok" : "not ok"} - concurrent company creation by one user: ${trials} personal trial, companies with distinct trial ends/total ${ends}`);
} finally {
  cleanup();
}
process.exit(ok ? 0 : 1);
