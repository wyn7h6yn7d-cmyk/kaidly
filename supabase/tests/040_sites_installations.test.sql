-- Phase 3: sites and electrical installations — role matrix, tenant isolation, forged ids,
-- cross-organisation foreign keys, archived sites, history.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql

-- Fixture data, inserted as postgres.
insert into public.sites (id, organisation_id, name, address) values
  ('5a000000-0000-4000-8000-000000000001', pg_temp.org('a'), 'A objekt', 'Tartu mnt 1, Tallinn'),
  ('5a000000-0000-4000-8000-000000000002', pg_temp.org('a'), 'A arhiveeritud', null),
  ('5b000000-0000-4000-8000-000000000001', pg_temp.org('b'), 'B objekt', 'Riia 1, Tartu');
update public.sites set archived_at = now() where id = '5a000000-0000-4000-8000-000000000002';

insert into public.electrical_installations (id, organisation_id, site_id, name, identifier, installation_type) values
  ('1a000000-0000-4000-8000-000000000001', pg_temp.org('a'), '5a000000-0000-4000-8000-000000000001', 'A peakilp', 'PJK-1', 'switchboard'),
  ('1b000000-0000-4000-8000-000000000001', pg_temp.org('b'), '5b000000-0000-4000-8000-000000000001', 'B alajaam', 'AJ-1', 'substation');

create function pg_temp.site(p text) returns uuid language sql immutable as $$
  select case p
    when 'a' then '5a000000-0000-4000-8000-000000000001'::uuid
    when 'a_archived' then '5a000000-0000-4000-8000-000000000002'::uuid
    when 'b' then '5b000000-0000-4000-8000-000000000001'::uuid end $$;
create function pg_temp.inst(p text) returns uuid language sql immutable as $$
  select case p
    when 'a' then '1a000000-0000-4000-8000-000000000001'::uuid
    when 'b' then '1b000000-0000-4000-8000-000000000001'::uuid end $$;
grant execute on function pg_temp.site(text), pg_temp.inst(text) to authenticated, anon;

select plan(54);

-- ===========================================================================
-- Reading: tenant isolation
-- ===========================================================================

select pg_temp.login('a_viewer');
select results_eq(
  'select id from public.sites order by name',
  $$ values (pg_temp.site('a_archived')), (pg_temp.site('a')) $$,
  'a viewer sees their organisation''s sites, archived included'
);
select is_empty(
  $$ select 1 from public.sites where id = pg_temp.site('b') $$,
  'tenant A cannot read tenant B''s site by id (URL guessing)'
);
select is_empty(
  $$ select 1 from public.electrical_installations where id = pg_temp.inst('b') $$,
  'tenant A cannot read tenant B''s installation by id (URL guessing)'
);
select is_empty(
  $$ select 1 from public.sites where organisation_id = pg_temp.org('b') $$,
  'filtering by B''s organisation id returns nothing'
);
select is_empty(
  $$ select 1 from public.electrical_installations where site_id = pg_temp.site('b') $$,
  'filtering installations by B''s site id returns nothing'
);
select is_empty(
  $$ select i.name, s.name, o.name
       from public.electrical_installations i
       join public.sites s on s.id = i.site_id
       join public.organisations o on o.id = s.organisation_id
      where o.id = pg_temp.org('b') or s.id = pg_temp.site('b') or i.id = pg_temp.inst('b') $$,
  'joins across installations, sites and organisations reveal nothing about B'
);
select is(
  (select count(*)::int from public.sites s
     right join public.electrical_installations i on i.site_id = s.id),
  1,
  'outer joins only ever see the caller''s own rows'
);
select throws_ok(
  $$ select 1 from public.sites where id = 'not-a-uuid' $$,
  '22P02', null,
  'an invalid id is rejected by the database, not interpreted'
);

select pg_temp.login('outsider');
select is_empty('select 1 from public.sites', 'an outsider sees no sites');
select is_empty('select 1 from public.electrical_installations', 'an outsider sees no installations');

select pg_temp.login('multi');
select is(
  (select count(*)::int from public.electrical_installations),
  2,
  'a user in both organisations sees installations of both'
);

select pg_temp.logout();
select throws_ok('select 1 from public.sites', '42501', null, 'anon cannot read sites');
select throws_ok('select 1 from public.electrical_installations', '42501', null, 'anon cannot read installations');

-- ===========================================================================
-- Sites: who may write
-- ===========================================================================

select pg_temp.login('a_owner');
select lives_ok(
  $$ insert into public.sites (organisation_id, name) values (pg_temp.org('a'), 'Owner objekt') $$,
  'an owner can create a site'
);

select pg_temp.login('a_admin');
select lives_ok(
  $$ insert into public.sites (organisation_id, name, address, description, responsible_person)
     values (pg_temp.org('a'), 'Admin objekt', 'Pärnu mnt 2', 'Kirjeldus', 'Mari Maasikas') $$,
  'an admin can create a site'
);
select is(
  (select created_by from public.sites where name = 'Admin objekt'),
  pg_temp.uid('a_admin'),
  'created_by is set from the session, not the client'
);
select throws_ok(
  $$ insert into public.sites (organisation_id, name, created_by)
     values (pg_temp.org('a'), 'Forged creator', pg_temp.uid('a_owner')) $$,
  '42501', null,
  'created_by cannot be forged'
);
select throws_ok(
  $$ insert into public.sites (organisation_id, name) values (pg_temp.org('b'), 'Into B') $$,
  '42501', null,
  'tenant A admin cannot create a site in organisation B'
);
select throws_ok(
  $$ insert into public.sites (organisation_id, name) values (gen_random_uuid(), 'Forged org') $$,
  '42501', null,
  'a forged organisation id is rejected'
);
with u as (
  update public.sites set name = 'Hijacked' where id = pg_temp.site('b') returning 1
)
select is(count(*)::int, 0, 'tenant A admin cannot update B''s site') from u;
with u as (
  update public.sites set name = 'A objekt (muudetud)' where id = pg_temp.site('a') returning 1
)
select is(count(*)::int, 1, 'an admin can edit a site') from u;
with u as (
  update public.sites set archived_at = now() where id = pg_temp.site('a') returning 1
)
select is(count(*)::int, 1, 'an admin can archive a site') from u;
with u as (
  update public.sites set archived_at = null where id = pg_temp.site('a') returning 1
)
select is(count(*)::int, 1, 'an admin can restore a site') from u;
select throws_ok(
  $$ update public.sites set organisation_id = pg_temp.org('b') where id = pg_temp.site('a') $$,
  '42501', null,
  'a site cannot be moved to another organisation'
);
select throws_ok(
  $$ delete from public.sites where id = pg_temp.site('a') $$,
  '42501', null,
  'sites cannot be deleted (archive instead)'
);

select pg_temp.login('a_operator');
select throws_ok(
  $$ insert into public.sites (organisation_id, name) values (pg_temp.org('a'), 'Operator objekt') $$,
  '42501', null,
  'an operator cannot create sites'
);
with u as (
  update public.sites set name = 'Operator edit' where id = pg_temp.site('a') returning 1
)
select is(count(*)::int, 0, 'an operator cannot edit sites') from u;
with u as (
  update public.sites set archived_at = now() where id = pg_temp.site('a') returning 1
)
select is(count(*)::int, 0, 'an operator cannot archive sites') from u;

select pg_temp.login('a_viewer');
select throws_ok(
  $$ insert into public.sites (organisation_id, name) values (pg_temp.org('a'), 'Viewer objekt') $$,
  '42501', null,
  'a viewer cannot create sites'
);
with u as (
  update public.sites set name = 'Viewer edit' where id = pg_temp.site('a') returning 1
)
select is(count(*)::int, 0, 'a viewer cannot edit sites') from u;

select pg_temp.login('multi');
select throws_ok(
  $$ insert into public.sites (organisation_id, name) values (pg_temp.org('b'), 'Multi in B') $$,
  '42501', null,
  'a role in one organisation grants nothing in another'
);

-- ===========================================================================
-- Installations: who may write, cross-organisation foreign keys
-- ===========================================================================

select pg_temp.login('a_admin');
select lives_ok(
  $$ insert into public.electrical_installations
       (organisation_id, site_id, name, identifier, installation_type, location, commissioned_on, status)
     values (pg_temp.org('a'), pg_temp.site('a'), 'Päikesejaam', 'PV-1', 'solar', 'Katus', '2024-05-01', 'in_service') $$,
  'an admin can create an installation'
);
select throws_ok(
  $$ insert into public.electrical_installations (organisation_id, site_id, name, installation_type)
     values (pg_temp.org('a'), pg_temp.site('b'), 'Into B site', 'other') $$,
  '23503', null,
  'an installation cannot be attached to another organisation''s site'
);
select throws_ok(
  $$ insert into public.electrical_installations (organisation_id, site_id, name, installation_type)
     values (pg_temp.org('b'), pg_temp.site('b'), 'Into B', 'other') $$,
  '42501', null,
  'tenant A admin cannot create installations in organisation B'
);
select throws_ok(
  $$ insert into public.electrical_installations (organisation_id, site_id, name, installation_type)
     values (pg_temp.org('a'), gen_random_uuid(), 'Forged site', 'other') $$,
  '23503', null,
  'a forged site id is rejected'
);
select throws_ok(
  $$ update public.electrical_installations set site_id = pg_temp.site('b') where id = pg_temp.inst('a') $$,
  '23503', null,
  'an installation cannot be moved to another organisation''s site'
);
select throws_ok(
  $$ insert into public.electrical_installations (organisation_id, site_id, name, installation_type)
     values (pg_temp.org('a'), pg_temp.site('a_archived'), 'Into archived', 'other') $$,
  'P0001', 'site_archived',
  'installations cannot be added to an archived site'
);
select throws_ok(
  $$ update public.electrical_installations set site_id = pg_temp.site('a_archived') where id = pg_temp.inst('a') $$,
  'P0001', 'site_archived',
  'installations cannot be moved onto an archived site'
);
with u as (
  update public.electrical_installations
     set status = 'out_of_service', notes = 'Remondis' where id = pg_temp.inst('a') returning 1
)
select is(count(*)::int, 1, 'an admin can edit an installation') from u;
with u as (
  update public.electrical_installations set name = 'Hijacked' where id = pg_temp.inst('b') returning 1
)
select is(count(*)::int, 0, 'tenant A admin cannot update B''s installation') from u;
with u as (
  update public.electrical_installations set archived_at = now() where id = pg_temp.inst('a') returning 1
)
select is(count(*)::int, 1, 'an admin can archive an installation') from u;
select throws_ok(
  $$ update public.electrical_installations set organisation_id = pg_temp.org('b') where id = pg_temp.inst('a') $$,
  '42501', null,
  'an installation cannot be moved to another organisation'
);
select throws_ok(
  $$ delete from public.electrical_installations where id = pg_temp.inst('a') $$,
  '42501', null,
  'installations cannot be deleted (archive instead)'
);
select throws_ok(
  $$ insert into public.electrical_installations (organisation_id, site_id, name, installation_type, commissioned_on)
     values (pg_temp.org('a'), pg_temp.site('a'), 'Old', 'other', '1800-01-01') $$,
  '23514', null,
  'implausible commissioning dates are rejected'
);

select pg_temp.login('a_operator');
select throws_ok(
  $$ insert into public.electrical_installations (organisation_id, site_id, name, installation_type)
     values (pg_temp.org('a'), pg_temp.site('a'), 'Operator paigaldis', 'other') $$,
  '42501', null,
  'an operator cannot create installations'
);
with u as (
  update public.electrical_installations set name = 'Operator edit' where id = pg_temp.inst('a') returning 1
)
select is(count(*)::int, 0, 'an operator cannot edit installation master data') from u;
with u as (
  update public.electrical_installations set archived_at = null where id = pg_temp.inst('a') returning 1
)
select is(count(*)::int, 0, 'an operator cannot archive or restore installations') from u;

select pg_temp.login('a_viewer');
with u as (
  update public.electrical_installations set status = 'in_service' where id = pg_temp.inst('a') returning 1
)
select is(count(*)::int, 0, 'a viewer cannot edit installations') from u;
select isnt_empty(
  $$ select 1 from public.electrical_installations where id = pg_temp.inst('a') and archived_at is not null $$,
  'archived installations remain readable to members'
);

-- ===========================================================================
-- History
-- ===========================================================================

select pg_temp.login('a_admin');
select ok(
  exists (select 1 from public.activity_history
           where table_name = 'electrical_installations' and action = 'update'
             and record_id = pg_temp.inst('a') and actor_id = pg_temp.uid('a_admin')),
  'installation changes are recorded with the acting user'
);
select ok(
  exists (select 1 from public.activity_history
           where table_name = 'sites' and action = 'insert' and actor_id = pg_temp.uid('a_admin')),
  'site creation is recorded'
);
select pg_temp.login('b_admin');
select is_empty(
  $$ select 1 from public.activity_history
      where record_id in (pg_temp.site('a'), pg_temp.inst('a')) $$,
  'B cannot read A''s site or installation history'
);

-- ===========================================================================
-- Storage (Phase 7 guard): nothing is reachable yet
-- ===========================================================================

select pg_temp.login('a_admin');
select is_empty('select 1 from storage.objects', 'no storage objects are readable');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('documents', pg_temp.org('b')::text || '/x/file.pdf') $$,
  '42501', null,
  'storage objects cannot be written under any organisation path yet'
);

select * from finish();
rollback;
