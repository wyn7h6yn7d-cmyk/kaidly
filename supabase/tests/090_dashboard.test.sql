-- Phase 8: dashboard view site_attention — correct counts, tenant isolation for every role,
-- a member of two organisations sees each organisation's own numbers, anon sees nothing.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

create function pg_temp.today() returns date language sql stable as $$
  select (now() at time zone 'Europe/Tallinn')::date $$;
grant execute on function pg_temp.today() to authenticated, anon;

insert into public.scheduled_activities
  (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on, archived_at, created_by)
values
  -- site a1: 2 overdue (+1 archived overdue, not counted), 1 due soon, 1 later
  (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Üle 1', 'once', pg_temp.today() - 10, null, pg_temp.uid('a_admin')),
  (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Üle 2', 'once', pg_temp.today() - 1, null, pg_temp.uid('a_admin')),
  (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Arhiivis', 'once', pg_temp.today() - 5, now(), pg_temp.uid('a_admin')),
  (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Varsti', 'once', pg_temp.today() + 14, null, pg_temp.uid('a_admin')),
  (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Hiljem', 'once', pg_temp.today() + 15, null, pg_temp.uid('a_admin')),
  -- site b1: 1 overdue
  (pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'B üle', 'once', pg_temp.today() - 3, null, pg_temp.uid('b_admin'));

insert into public.deficiencies
  (organisation_id, site_id, electrical_installation_id, title, description, severity, status, created_by)
values
  (pg_temp.org('a'), pg_temp.site('a2'), pg_temp.inst('a2'), 'Kriitiline', 'x', 'critical', 'open', pg_temp.uid('a_operator')),
  (pg_temp.org('a'), pg_temp.site('a2'), pg_temp.inst('a2'), 'Kõrge', 'x', 'high', 'in_progress', pg_temp.uid('a_operator')),
  (pg_temp.org('a'), pg_temp.site('a2'), pg_temp.inst('a2'), 'Madal', 'x', 'low', 'open', pg_temp.uid('a_operator')),
  (pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'B kõrge', 'x', 'high', 'open', pg_temp.uid('b_operator'));

select plan(12);

select pg_temp.login('a_viewer');
select results_eq(
  $$ select name, overdue_activities, due_soon_activities, open_deficiencies, serious_deficiencies
       from public.site_attention order by name $$,
  $$ values ('A objekt 1'::text, 2, 1, 0, 0), ('A objekt 2'::text, 0, 0, 3, 2) $$,
  'a viewer gets the right counts for their organisation''s sites only'
);

select pg_temp.login('a_operator');
select is((select count(*)::int from public.site_attention where organisation_id = pg_temp.org('b')), 0,
  'filtering by another organisation''s id returns nothing (operator)');
select pg_temp.login('a_admin');
select is((select count(*)::int from public.site_attention where site_id = pg_temp.site('b1')), 0,
  'another organisation''s site is invisible (admin)');
select pg_temp.login('a_owner');
select is((select count(*)::int from public.site_attention), 2, 'an owner sees exactly their own sites');

select pg_temp.login('b_viewer');
select results_eq(
  $$ select name, overdue_activities, open_deficiencies, serious_deficiencies from public.site_attention $$,
  $$ values ('B objekt 1'::text, 1, 1, 1) $$,
  'organisation B sees only its own numbers'
);

-- A member of both organisations: each organisation's rows carry their own counts.
select pg_temp.login('multi');
select is((select count(*)::int from public.site_attention), 3, 'a member of two organisations sees both');
select is(
  (select sum(overdue_activities)::int from public.site_attention where organisation_id = pg_temp.org('a')), 2,
  'counts for A do not include B''s activities');
select is(
  (select sum(serious_deficiencies)::int from public.site_attention where organisation_id = pg_temp.org('b')), 1,
  'counts for B do not include A''s deficiencies');

-- Hidden underlying rows are not counted even if the site were visible: the subqueries run
-- with the caller's RLS (security_invoker).
select ok(
  (select 'security_invoker=true' = any (reloptions) from pg_class where oid = 'public.site_attention'::regclass),
  'the view runs with the caller''s rights');

select pg_temp.login('outsider');
select is_empty('select 1 from public.site_attention', 'a user without membership sees nothing');

-- Archived sites drop out; resolving a deficiency lowers the count.
reset role;
update public.sites set archived_at = now() where id = pg_temp.site('a1');
select pg_temp.login('a_viewer');
select is((select count(*)::int from public.site_attention), 1, 'archived sites are not listed');

select pg_temp.logout();
select throws_ok('select 1 from public.site_attention', '42501', null, 'anon cannot read the view');

select * from finish();
rollback;
