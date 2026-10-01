-- Phase 4: operating log — append-only, corrections, role matrix, tenant isolation,
-- database-enforced organisation/site/installation consistency.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

-- One entry per tenant, written as postgres (seed-style, explicit author).
insert into public.log_entries
  (id, organisation_id, site_id, electrical_installation_id, entry_type, description, created_by, occurred_at)
values
  ('e1000000-0000-4000-8000-0000000000a1', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'),
   'inspection', 'Visuaalne kontroll, korras', pg_temp.uid('a_operator'), now() - interval '2 days'),
  ('e1000000-0000-4000-8000-0000000000b1', pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'),
   'maintenance', 'B hooldus', pg_temp.uid('b_operator'), now() - interval '1 day');

create function pg_temp.entry(p text) returns uuid language sql immutable as $$
  select case p when 'a' then 'e1000000-0000-4000-8000-0000000000a1'::uuid
                when 'b' then 'e1000000-0000-4000-8000-0000000000b1'::uuid end $$;
grant execute on function pg_temp.entry(text) to authenticated, anon;

-- Snapshot of the original A entry, to prove it never changes.
create temporary table original_a as select * from public.log_entries where id = pg_temp.entry('a');
grant select on original_a to authenticated;

select plan(44);

-- ===========================================================================
-- Reading
-- ===========================================================================

select pg_temp.login('a_viewer');
select results_eq(
  'select id from public.log_entries',
  $$ select pg_temp.entry('a') $$,
  'a viewer reads their organisation''s log only'
);
select is_empty(
  $$ select 1 from public.log_entries where id = pg_temp.entry('b') or organisation_id = pg_temp.org('b') $$,
  'tenant A cannot read tenant B''s entries by id or organisation'
);
select is_empty(
  $$ select 1 from public.log_entry_current where electrical_installation_id = pg_temp.inst('b1') $$,
  'the current-state view applies RLS (security_invoker)'
);
select is_empty(
  $$ select 1 from public.log_entries l
       join public.electrical_installations i on i.id = l.electrical_installation_id
       join public.sites s on s.id = l.site_id
      where l.organisation_id = pg_temp.org('b') or i.id = pg_temp.inst('b1') or s.id = pg_temp.site('b1') $$,
  'joins reveal nothing about B''s log'
);

select pg_temp.login('outsider');
select is_empty('select 1 from public.log_entries', 'an outsider reads no entries');

select pg_temp.logout();
select throws_ok('select 1 from public.log_entries', '42501', null, 'anon cannot read the log');
select throws_ok('select 1 from public.log_entry_current', '42501', null, 'anon cannot read the view');

-- ===========================================================================
-- Creating: role matrix
-- ===========================================================================

select pg_temp.login('a_operator');
select lives_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, result, performed_by_name)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'measurement',
             'Isolatsioonitakistuse mõõtmine', '> 500 MΩ', 'Kati Käitaja') $$,
  'an operator can create an entry'
);
select results_eq(
  $$ select created_by, created_by_name from public.log_entries where entry_type = 'measurement' $$,
  $$ values (pg_temp.uid('a_operator'), 'A Operator'::text) $$,
  'the recorder and their name come from the session'
);

select pg_temp.login('a_admin');
select lives_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'switching', 'Lülitus') $$,
  'an admin can create an entry'
);
select pg_temp.login('a_owner');
select lives_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'Märkus') $$,
  'an owner can create an entry'
);

select pg_temp.login('a_viewer');
select throws_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'Viewer') $$,
  '42501', null,
  'a viewer cannot create entries'
);

select pg_temp.login('multi');
select throws_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description)
     values (pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'other', 'Viewer in B') $$,
  '42501', null,
  'operator rights in A give nothing in B (viewer there)'
);

-- ===========================================================================
-- Creating: forged and mismatched ids
-- ===========================================================================

select pg_temp.login('a_operator');
select throws_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description)
     values (pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'other', 'Into B') $$,
  '42501', null,
  'tenant A cannot write into tenant B''s log'
);
select throws_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('b1'), 'other', 'B installation') $$,
  '23503', null,
  'own organisation + B''s installation is rejected'
);
select throws_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description)
     values (pg_temp.org('a'), pg_temp.site('b1'), pg_temp.inst('a1'), 'other', 'B site') $$,
  '23503', null,
  'own organisation + B''s site is rejected'
);
select throws_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description)
     values (pg_temp.org('a'), pg_temp.site('a2'), pg_temp.inst('a1'), 'other', 'Wrong site') $$,
  '23503', null,
  'an installation filed under the wrong site of the same organisation is rejected'
);
select throws_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description)
     values (gen_random_uuid(), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'Forged org') $$,
  '42501', null,
  'a forged organisation id is rejected'
);
select throws_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description)
     values (pg_temp.org('a'), pg_temp.site('a1'), gen_random_uuid(), 'other', 'Forged installation') $$,
  '23503', null,
  'a forged installation id is rejected'
);
select throws_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'Spoof', pg_temp.uid('a_owner')) $$,
  '42501', null,
  'the recorder cannot be supplied by the client'
);
select throws_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, occurred_at)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'Future', now() + interval '1 day') $$,
  '23514', 'occurred_in_future',
  'entries cannot be dated in the future'
);
select throws_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', '   ') $$,
  '23514', null,
  'an empty description is rejected'
);

-- ===========================================================================
-- Append-only
-- ===========================================================================

select pg_temp.login('a_owner');
select throws_ok(
  $$ update public.log_entries set description = 'Rewritten' where id = pg_temp.entry('a') $$,
  '42501', null,
  'an owner cannot update an entry'
);
select throws_ok(
  $$ delete from public.log_entries where id = pg_temp.entry('a') $$,
  '42501', null,
  'an owner cannot delete an entry'
);
select pg_temp.login('a_operator');
select throws_ok(
  $$ update public.log_entries set result = 'x' where id = pg_temp.entry('a') $$,
  '42501', null,
  'an operator cannot update an entry'
);
reset role;
select throws_ok(
  $$ update public.log_entries set description = 'Rewritten' where id = pg_temp.entry('a') $$,
  'P0001', 'log_entries_append_only',
  'even the table owner cannot update an entry'
);
select throws_ok(
  $$ delete from public.log_entries where id = pg_temp.entry('a') $$,
  'P0001', 'log_entries_append_only',
  'even the table owner cannot delete an entry'
);
select throws_ok(
  'truncate public.log_entries cascade',
  'P0001', 'log_entries_append_only',
  'the log cannot be truncated'
);
select throws_ok(
  $$ delete from public.electrical_installations where id = pg_temp.inst('a1') $$,
  '23503', null,
  'an installation with log entries cannot be deleted'
);
select throws_ok(
  $$ update public.electrical_installations set site_id = pg_temp.site('a2') where id = pg_temp.inst('a1') $$,
  '23503', null,
  'an installation with log entries cannot be moved to another site'
);

-- ===========================================================================
-- Corrections
-- ===========================================================================

select pg_temp.login('a_operator');
select lives_ok(
  $$ insert into public.log_entries
       (organisation_id, site_id, electrical_installation_id, entry_type, description, correction_of_id, correction_reason, occurred_at)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection',
             'Visuaalne kontroll, leitud lahtine klemm', pg_temp.entry('a'), 'Tähelepanek jäi kirja panemata',
             now() - interval '2 days') $$,
  'an operator can correct an entry'
);
select results_eq(
  $$ select created_by, correction_reason from public.log_entries where correction_of_id = pg_temp.entry('a') $$,
  $$ values (pg_temp.uid('a_operator'), 'Tähelepanek jäi kirja panemata'::text) $$,
  'the correction records who corrected it and why'
);
select ok(
  (select c.created_at is not null and c.created_at >= o.created_at
     from public.log_entries c, original_a o where c.correction_of_id = o.id),
  'the correction records when'
);
select results_eq(
  $$ select row(l.*)::text from public.log_entries l where l.id = pg_temp.entry('a') $$,
  $$ select row(o.*)::text from original_a o $$,
  'the original entry is unchanged'
);
select results_eq(
  $$ select description, is_corrected, correction_count, correction_reason
       from public.log_entry_current where id = pg_temp.entry('a') $$,
  $$ values ('Visuaalne kontroll, leitud lahtine klemm'::text, true, 1, 'Tähelepanek jäi kirja panemata'::text) $$,
  'the current-state view shows the corrected values'
);
select is(
  (select count(*)::int from public.log_entry_current where electrical_installation_id = pg_temp.inst('a1')),
  (select count(*)::int from public.log_entries where electrical_installation_id = pg_temp.inst('a1') and correction_of_id is null),
  'corrections do not appear as separate entries in the current view'
);
select throws_ok(
  $$ insert into public.log_entries
       (organisation_id, site_id, electrical_installation_id, entry_type, description, correction_of_id)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'No reason', pg_temp.entry('a')) $$,
  '23514', null,
  'a correction requires a reason'
);
select throws_ok(
  format($$ insert into public.log_entries
       (organisation_id, site_id, electrical_installation_id, entry_type, description, correction_of_id, correction_reason)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'Chain', %L, 'Chain') $$,
     (select id from public.log_entries where correction_of_id = pg_temp.entry('a'))),
  'P0001', 'correction_target_invalid',
  'a correction cannot correct another correction (no chains)'
);
select throws_ok(
  $$ insert into public.log_entries
       (organisation_id, site_id, electrical_installation_id, entry_type, description, correction_of_id, correction_reason)
     values (pg_temp.org('a'), pg_temp.site('a2'), pg_temp.inst('a2'), 'inspection', 'Other installation', pg_temp.entry('a'), 'x') $$,
  '23503', null,
  'a correction stays within the same installation'
);
select throws_ok(
  $$ insert into public.log_entries
       (organisation_id, site_id, electrical_installation_id, entry_type, description, correction_of_id, correction_reason)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'Correct B', pg_temp.entry('b'), 'x') $$,
  '23503', null,
  'tenant A cannot correct tenant B''s entry'
);
select lives_ok(
  $$ insert into public.log_entries
       (organisation_id, site_id, electrical_installation_id, entry_type, description, correction_of_id, correction_reason)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'Teine parandus', pg_temp.entry('a'), 'Täpsustus') $$,
  'an original can be corrected again (flat list, newest wins)'
);
select is(
  (select description from public.log_entry_current where id = pg_temp.entry('a')),
  'Teine parandus',
  'the newest correction is the current state'
);

select pg_temp.login('a_viewer');
select throws_ok(
  $$ insert into public.log_entries
       (organisation_id, site_id, electrical_installation_id, entry_type, description, correction_of_id, correction_reason)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'Viewer fix', pg_temp.entry('a'), 'x') $$,
  '42501', null,
  'a viewer cannot correct entries'
);

-- ===========================================================================
-- Archived installations
-- ===========================================================================

reset role;
update public.electrical_installations set archived_at = now() where id = pg_temp.inst('a2');
select pg_temp.login('a_operator');
select throws_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description)
     values (pg_temp.org('a'), pg_temp.site('a2'), pg_temp.inst('a2'), 'other', 'Archived') $$,
  'P0001', 'installation_archived',
  'archived installations take no new entries'
);

select * from finish();
rollback;
