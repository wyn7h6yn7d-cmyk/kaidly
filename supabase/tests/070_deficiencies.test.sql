-- Phase 6: deficiencies — role matrix, tenant isolation, forged ids, lifecycle,
-- resolution → operating log, no double resolution, no deletion, history.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

insert into public.deficiencies
  (id, organisation_id, site_id, electrical_installation_id, title, description, severity, created_by)
values
  ('df000000-0000-4000-8000-0000000000a1', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'),
   'Lahtine klemm', 'Peakilbi klemm X3 lahti', 'high', pg_temp.uid('a_operator')),
  ('df000000-0000-4000-8000-0000000000b1', pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'),
   'B puudus', 'B kirjeldus', 'low', pg_temp.uid('b_operator'));

create function pg_temp.def(p text) returns uuid language sql immutable as $$
  select ('df000000-0000-4000-8000-0000000000' || p)::uuid $$;
grant execute on function pg_temp.def(text) to authenticated, anon;

create function pg_temp.resolve(p uuid, p_note text) returns uuid language sql as $$
  select public.resolve_deficiency(p, p_note, 'repair', now(), null) $$;
grant execute on function pg_temp.resolve(uuid, text) to authenticated, anon;

select plan(39);

-- ===========================================================================
-- Reading
-- ===========================================================================

select pg_temp.login('a_viewer');
select results_eq('select id from public.deficiencies', $$ select pg_temp.def('a1') $$,
  'a viewer reads their organisation''s deficiencies');
select is_empty(
  $$ select 1 from public.deficiencies d join public.electrical_installations i on i.id = d.electrical_installation_id
      where d.id = pg_temp.def('b1') or d.organisation_id = pg_temp.org('b') or i.id = pg_temp.inst('b1') $$,
  'tenant A cannot read tenant B''s deficiencies, also through joins');
select pg_temp.login('outsider');
select is_empty('select 1 from public.deficiencies', 'an outsider reads no deficiencies');
select pg_temp.logout();
select throws_ok('select 1 from public.deficiencies', '42501', null, 'anon cannot read deficiencies');

-- ===========================================================================
-- Creating
-- ===========================================================================

select pg_temp.login('a_operator');
select lives_ok(
  $$ insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, due_on)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Puuduv kate', 'Kilbi ukse kate puudub', 'medium', '2030-01-01') $$,
  'an operator can record a deficiency'
);
select results_eq(
  $$ select status::text, created_by, created_by_name from public.deficiencies where title = 'Puuduv kate' $$,
  $$ values ('open'::text, pg_temp.uid('a_operator'), 'A Operator'::text) $$,
  'a new deficiency is open; the recorder comes from the session'
);
select pg_temp.login('a_admin');
select lives_ok(
  $$ insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Admin', 'Kirjeldus', 'critical') $$,
  'an admin can record a deficiency'
);

select pg_temp.login('a_viewer');
select throws_ok(
  $$ insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Viewer', 'x', 'low') $$,
  '42501', null, 'a viewer cannot record deficiencies');

select pg_temp.login('a_operator');
select throws_ok(
  $$ insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity)
     values (pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'Into B', 'x', 'low') $$,
  '42501', null, 'tenant A cannot record deficiencies in tenant B');
select throws_ok(
  $$ insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('b1'), 'B installation', 'x', 'low') $$,
  '23503', null, 'own organisation + B''s installation is rejected');
select throws_ok(
  $$ insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity)
     values (pg_temp.org('a'), pg_temp.site('a2'), pg_temp.inst('a1'), 'Wrong site', 'x', 'low') $$,
  '23503', null, 'organisation/site/installation mismatch is rejected');
select throws_ok(
  $$ insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity)
     values (pg_temp.org('a'), pg_temp.site('a1'), gen_random_uuid(), 'Forged', 'x', 'low') $$,
  '23503', null, 'a forged installation id is rejected');
select throws_ok(
  $$ insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, created_by)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Spoof', 'x', 'low', pg_temp.uid('a_owner')) $$,
  '42501', null, 'the recorder cannot be supplied by the client');
select throws_ok(
  $$ insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, resolution)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Pre-resolved', 'x', 'low', 'done') $$,
  '42501', null, 'resolution fields cannot be written directly');
select throws_ok(
  $$ insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, status)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Resolved', 'x', 'low', 'resolved') $$,
  '23514', null, 'a deficiency cannot be created as resolved');

-- ===========================================================================
-- Progress
-- ===========================================================================

with u as (
  update public.deficiencies set status = 'in_progress', responsible_person_name = 'Mati Meister'
   where id = pg_temp.def('a1') returning status
)
select is((select status::text from u), 'in_progress', 'an operator can move a deficiency to in progress');
with u as (update public.deficiencies set status = 'open' where id = pg_temp.def('a1') returning 1)
select is(count(*)::int, 1, 'and back to open') from u;
select throws_ok(
  $$ update public.deficiencies set status = 'resolved' where id = pg_temp.def('a1') $$,
  'P0001', 'deficiency_resolve_via_rpc', 'resolving by a plain update is refused');
with u as (update public.deficiencies set title = 'Hijacked' where id = pg_temp.def('b1') returning 1)
select is(count(*)::int, 0, 'tenant A cannot update tenant B''s deficiency') from u;
select throws_ok(
  $$ update public.deficiencies set organisation_id = pg_temp.org('b') where id = pg_temp.def('a1') $$,
  '42501', null, 'a deficiency cannot be moved to another organisation');

select pg_temp.login('a_viewer');
with u as (update public.deficiencies set status = 'in_progress' where id = pg_temp.def('a1') returning 1)
select is(count(*)::int, 0, 'a viewer cannot update deficiencies') from u;

-- ===========================================================================
-- No deletion
-- ===========================================================================

select pg_temp.login('a_owner');
select throws_ok($$ delete from public.deficiencies where id = pg_temp.def('a1') $$,
  '42501', null, 'not even an owner can delete a deficiency');
reset role;
select throws_ok($$ delete from public.deficiencies where id = pg_temp.def('a1') $$,
  'P0001', 'deficiencies_are_kept', 'the table owner cannot delete a deficiency either');

-- ===========================================================================
-- Resolution
-- ===========================================================================

select pg_temp.login('a_viewer');
select throws_ok($$ select pg_temp.resolve(pg_temp.def('a1'), 'Pingutatud') $$,
  'P0002', 'not_found', 'a viewer cannot resolve');
select pg_temp.login('b_admin');
select throws_ok($$ select pg_temp.resolve(pg_temp.def('a1'), 'Pingutatud') $$,
  'P0002', 'not_found', 'tenant B cannot resolve tenant A''s deficiency');

select pg_temp.login('a_operator');
select throws_ok($$ select pg_temp.resolve(pg_temp.def('a1'), '   ') $$,
  '23514', 'resolution_required', 'a resolution note is required');
select lives_ok(
  $$ select set_config('test.entry', pg_temp.resolve(pg_temp.def('a1'), 'Klemm pingutatud, kontrollitud termokaameraga')::text, true) $$,
  'an operator can resolve a deficiency');
select results_eq(
  $$ select organisation_id, site_id, electrical_installation_id, deficiency_id, entry_type::text, description, created_by
       from public.log_entries where id = current_setting('test.entry')::uuid $$,
  $$ values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), pg_temp.def('a1'), 'repair'::text,
             'Klemm pingutatud, kontrollitud termokaameraga'::text, pg_temp.uid('a_operator')) $$,
  'resolving writes an operating-log entry for the right organisation, site and installation');
select results_eq(
  $$ select status::text, resolution, resolved_by, resolved_by_name, resolved_at is not null
       from public.deficiencies where id = pg_temp.def('a1') $$,
  $$ values ('resolved'::text, 'Klemm pingutatud, kontrollitud termokaameraga'::text, pg_temp.uid('a_operator'), 'A Operator'::text, true) $$,
  'the deficiency records who resolved it, when and how');
select throws_ok($$ select pg_temp.resolve(pg_temp.def('a1'), 'Again') $$,
  'P0001', 'deficiency_already_resolved', 'a resolved deficiency cannot be resolved twice');
select is((select count(*)::int from public.log_entries where deficiency_id = pg_temp.def('a1')), 1,
  'exactly one resolution entry');
select throws_ok($$ update public.deficiencies set title = 'Changed later' where id = pg_temp.def('a1') $$,
  'P0001', 'deficiency_resolved', 'a resolved deficiency is final');
select throws_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, deficiency_id)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'repair', 'Fake', pg_temp.def('a1')) $$,
  '42501', null, 'a resolution entry cannot be written directly');
select isnt_empty($$ select 1 from public.deficiencies where id = pg_temp.def('a1') $$,
  'the resolved deficiency stays in the list');

-- Archived installation
reset role;
update public.electrical_installations set archived_at = now() where id = pg_temp.inst('a2');
select pg_temp.login('a_operator');
select throws_ok(
  $$ insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity)
     values (pg_temp.org('a'), pg_temp.site('a2'), pg_temp.inst('a2'), 'Archived', 'x', 'low') $$,
  'P0001', 'installation_archived', 'archived installations take no new deficiencies');

-- ===========================================================================
-- History
-- ===========================================================================

select pg_temp.login('a_admin');
select results_eq(
  $$ select new_data ->> 'status', actor_id from public.activity_history
      where table_name = 'deficiencies' and record_id = pg_temp.def('a1') and action = 'update'
      order by id $$,
  $$ values ('in_progress'::text, pg_temp.uid('a_operator')), ('open', pg_temp.uid('a_operator')),
            ('resolved', pg_temp.uid('a_operator')) $$,
  'every status transition is in the history with the acting user');
select is(
  (select old_data ->> 'status' from public.activity_history
    where table_name = 'deficiencies' and record_id = pg_temp.def('a1') and new_data ->> 'status' = 'resolved'),
  'open', 'history keeps the previous state');
select pg_temp.login('b_admin');
select is_empty($$ select 1 from public.activity_history where record_id = pg_temp.def('a1') $$,
  'tenant B cannot read A''s deficiency history');
select pg_temp.login('a_operator');
select is_empty($$ select 1 from public.activity_history where table_name = 'deficiencies' $$,
  'operators cannot read history (admins can)');

select * from finish();
rollback;
