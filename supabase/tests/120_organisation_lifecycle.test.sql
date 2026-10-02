-- Organisation lifecycle: owners delete empty organisations; organisations with operational
-- history can only be deactivated (no writes, data kept) and reactivated. Typed-name
-- confirmation, roles, isolation and the direct-API paths are enforced in the database.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

-- Organisation C (empty of history): site, installation, plan activity, invitation; the
-- organisation-A users hold every role, multi is an operator.
insert into public.organisations (id, name, slug) values ('0c000000-0000-4000-8000-00000000000c', 'Tühi Firma OÜ', 'tuhi-firma');
insert into public.organisation_members (organisation_id, user_id, role) values
  ('0c000000-0000-4000-8000-00000000000c', pg_temp.uid('a_owner'), 'owner'),
  ('0c000000-0000-4000-8000-00000000000c', pg_temp.uid('a_admin'), 'admin'),
  ('0c000000-0000-4000-8000-00000000000c', pg_temp.uid('a_operator'), 'operator'),
  ('0c000000-0000-4000-8000-00000000000c', pg_temp.uid('a_viewer'), 'viewer');
insert into public.sites (id, organisation_id, name) values ('5c000000-0000-4000-8000-0000000000c1', '0c000000-0000-4000-8000-00000000000c', 'C objekt');
insert into public.electrical_installations (id, organisation_id, site_id, name, installation_type)
values ('1c000000-0000-4000-8000-0000000000c1', '0c000000-0000-4000-8000-00000000000c', '5c000000-0000-4000-8000-0000000000c1', 'C kilp', 'switchboard');
insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on, created_by)
values ('0c000000-0000-4000-8000-00000000000c', '5c000000-0000-4000-8000-0000000000c1', '1c000000-0000-4000-8000-0000000000c1', 'Ülevaatus', 'once', current_date + 30, pg_temp.uid('a_owner'));
insert into public.organisation_invitations (organisation_id, email, role, token_hash, invited_by, expires_at)
values ('0c000000-0000-4000-8000-00000000000c', 'uus@example.ee', 'viewer', extensions.digest('c-invite', 'sha256'), pg_temp.uid('a_owner'), now() + interval '7 days');

-- Organisation A gets operational history: one operating-log entry.
insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'Ülevaatus', pg_temp.uid('a_operator'));
insert into public.scheduled_activities (id, organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on, created_by)
values ('ac000000-0000-4000-8000-0000000000a9', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Mõõtmine', 'once', current_date + 5, pg_temp.uid('a_admin'));

-- Organisation D: nothing but one general document (no log, no deficiencies).
insert into public.organisations (id, name, slug) values ('0d000000-0000-4000-8000-00000000000d', 'Dokumendiga OÜ', 'dokumendiga');
insert into public.organisation_members (organisation_id, user_id, role) values ('0d000000-0000-4000-8000-00000000000d', pg_temp.uid('b_owner'), 'owner');
insert into public.documents (organisation_id, category, title, original_filename, mime_type, size_bytes, status, ready_at, uploaded_by)
values ('0d000000-0000-4000-8000-00000000000d', 'manual', 'Juhend', 'juhend.pdf', 'application/pdf', 10, 'ready', now(), pg_temp.uid('b_owner'));

create function pg_temp.c() returns uuid language sql immutable as $$ select '0c000000-0000-4000-8000-00000000000c'::uuid $$;
grant execute on function pg_temp.c() to authenticated, anon;

select plan(31);

-- ===========================================================================
-- Deleting an empty organisation
-- ===========================================================================

select pg_temp.login('a_admin');
select throws_ok($$ select public.delete_organisation(pg_temp.c(), 'Tühi Firma OÜ') $$, 'P0002', 'not_found', 'an admin cannot delete an organisation');
select pg_temp.login('a_operator');
select throws_ok($$ select public.delete_organisation(pg_temp.c(), 'Tühi Firma OÜ') $$, 'P0002', 'not_found', 'an operator cannot delete an organisation');
select pg_temp.login('a_viewer');
select throws_ok($$ select public.delete_organisation(pg_temp.c(), 'Tühi Firma OÜ') $$, 'P0002', 'not_found', 'a viewer cannot delete an organisation');
select pg_temp.login('b_owner');
select throws_ok($$ select public.delete_organisation(pg_temp.c(), 'Tühi Firma OÜ') $$, 'P0002', 'not_found', 'another organisation''s owner cannot delete it (same error as unknown)');

select pg_temp.login('a_owner');
select throws_ok($$ delete from public.organisations where id = pg_temp.c() $$, '42501', null,
  'there is no direct delete path for organisations (no privilege)');
select throws_ok($$ update public.organisations set deactivated_at = now() where id = pg_temp.c() $$, '42501', null,
  'deactivation can''t be set directly (only through the RPC)');
select throws_ok($$ select public.delete_organisation(pg_temp.c(), 'Tühi firma OÜ') $$, 'P0001', 'confirmation_mismatch',
  'the typed name must match exactly');
select lives_ok($$ select public.delete_organisation(pg_temp.c(), 'Tühi Firma OÜ') $$, 'the owner deletes an empty organisation');
reset role;
select is((select count(*)::int from public.organisations where id = pg_temp.c()), 0, 'the organisation is gone');
select is(
  (select count(*)::int from public.sites where organisation_id = pg_temp.c())
  + (select count(*)::int from public.electrical_installations where organisation_id = pg_temp.c())
  + (select count(*)::int from public.scheduled_activities where organisation_id = pg_temp.c())
  + (select count(*)::int from public.organisation_members where organisation_id = pg_temp.c())
  + (select count(*)::int from public.organisation_invitations where organisation_id = pg_temp.c())
  + (select count(*)::int from public.activity_history where organisation_id = pg_temp.c()),
  0, 'its sites, installations, plan, members, invitations and change history are gone');
select is((select count(*)::int from public.profiles where id in (pg_temp.uid('a_owner'), pg_temp.uid('a_viewer'))), 2,
  'user accounts survive the deletion');
select is((select count(*)::int from public.organisation_members where user_id = pg_temp.uid('a_owner')), 1,
  'the owner keeps their other memberships');
select is((select count(*)::int from public.sites where organisation_id = pg_temp.org('b')), 1,
  'another organisation is untouched');

-- ===========================================================================
-- Organisations with operational history
-- ===========================================================================

select pg_temp.login('a_owner');
select throws_ok($$ select public.delete_organisation(pg_temp.org('a'), 'Organisatsioon A') $$, 'P0001', 'organisation_has_history',
  'an organisation with operating-log entries can''t be deleted');
select pg_temp.logout(); -- clear claims: maintenance insert, not a session
reset role;
insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, created_by)
values (pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'B puudus', 'x', 'low', pg_temp.uid('b_operator'));
select pg_temp.login('b_owner');
select throws_ok($$ select public.delete_organisation(pg_temp.org('b'), 'Organisatsioon B') $$, 'P0001', 'organisation_has_history',
  'an organisation with deficiencies can''t be deleted');
select throws_ok($$ select public.delete_organisation('0d000000-0000-4000-8000-00000000000d', 'Dokumendiga OÜ') $$, 'P0001',
  'organisation_has_history', 'an organisation with documents can''t be deleted');
select is((select count(*)::int from public.log_entries where organisation_id = pg_temp.org('a')), 0,
  'history stays out of reach of other tenants (B sees none of A''s entries)');

-- ===========================================================================
-- Deactivation
-- ===========================================================================

select pg_temp.login('a_admin');
select throws_ok($$ select public.deactivate_organisation(pg_temp.org('a'), 'Organisatsioon A') $$, 'P0002', 'not_found',
  'an admin cannot deactivate');
select pg_temp.login('a_owner');
select throws_ok($$ select public.deactivate_organisation(pg_temp.org('a'), 'organisatsioon a') $$, 'P0001', 'confirmation_mismatch',
  'deactivation needs the exact name');
select lives_ok($$ select public.deactivate_organisation(pg_temp.org('a'), 'Organisatsioon A') $$, 'the owner deactivates');

select pg_temp.login('a_operator');
select throws_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'x') $$,
  '42501', null, 'a deactivated organisation takes no new operating-log entries');
select throws_ok(
  $$ select public.complete_scheduled_activity('ac000000-0000-4000-8000-0000000000a9', current_date + 5, 'inspection', now(), 'x', null, null) $$,
  null, null, 'activities can''t be completed in a deactivated organisation');
select pg_temp.login('a_admin');
select throws_ok($$ insert into public.sites (organisation_id, name) values (pg_temp.org('a'), 'Uus') $$, '42501', null,
  'no new sites in a deactivated organisation');
select pg_temp.login('a_owner');
with u as (update public.organisations set name = 'Uus nimi' where id = pg_temp.org('a') returning 1)
select is(count(*)::int, 0, 'even the owner can''t edit a deactivated organisation') from u;
select pg_temp.login('a_viewer');
select is((select count(*)::int from public.log_entries where organisation_id = pg_temp.org('a')), 1,
  'members can still read the preserved history');
select pg_temp.logout();
reset role;
select throws_ok(
  $$ insert into public.organisation_members (organisation_id, user_id, role) values (pg_temp.org('a'), pg_temp.uid('outsider'), 'viewer') $$,
  'P0001', 'organisation_deactivated', 'nobody joins a deactivated organisation');
select pg_temp.login('b_operator');
select lives_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description)
     values (pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'other', 'B töötab') $$,
  'other organisations keep working');

select pg_temp.login('a_admin');
select throws_ok($$ select public.reactivate_organisation(pg_temp.org('a')) $$, 'P0002', 'not_found', 'an admin cannot reactivate');
select pg_temp.login('a_owner');
select lives_ok($$ select public.reactivate_organisation(pg_temp.org('a')) $$, 'the owner reactivates');
select pg_temp.login('a_operator');
select lives_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'Tagasi töös') $$,
  'after reactivation, writes work again');
select pg_temp.logout();
select throws_ok($$ select public.delete_organisation(pg_temp.org('b'), 'Organisatsioon B') $$, '42501', null,
  'anon cannot call the lifecycle functions');

select * from finish();
rollback;
