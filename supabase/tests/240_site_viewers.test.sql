-- Objekti vaataja (migration site_viewers): invitations (owner/admin only, own sites only,
-- members refused), acceptance (same confirmed e-mail, once), read-only access to exactly
-- the granted site — nothing of other sites, the company or another tenant; every write
-- refused; revocation effective immediately; no access while the company is unpaid or
-- deactivated; seats only when configured.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

-- Content in sites a1, a2 and b1 (as postgres).
insert into public.log_entries (id, organisation_id, site_id, electrical_installation_id, entry_type, description, created_by) values
  ('e2400000-0000-4000-8000-0000000000a1', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'A1 kanne', pg_temp.uid('a_operator')),
  ('e2400000-0000-4000-8000-0000000000a2', pg_temp.org('a'), pg_temp.site('a2'), pg_temp.inst('a2'), 'inspection', 'A2 kanne', pg_temp.uid('a_operator')),
  ('e2400000-0000-4000-8000-0000000000b1', pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'inspection', 'B1 kanne', pg_temp.uid('b_operator'));
insert into public.deficiencies (id, organisation_id, site_id, electrical_installation_id, title, description, severity, created_by) values
  ('df240000-0000-4000-8000-0000000000a1', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'A1 puudus', 'x', 'high', pg_temp.uid('a_operator')),
  ('df240000-0000-4000-8000-0000000000a2', pg_temp.org('a'), pg_temp.site('a2'), pg_temp.inst('a2'), 'A2 puudus', 'x', 'low', pg_temp.uid('a_operator'));
insert into public.scheduled_activities (id, organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on) values
  ('5c240000-0000-4000-8000-0000000000a1', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'A1 kontroll', 'once', current_date + 30),
  ('5c240000-0000-4000-8000-0000000000a2', pg_temp.org('a'), pg_temp.site('a2'), pg_temp.inst('a2'), 'A2 kontroll', 'once', current_date + 30);
insert into public.documents (id, organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes, status, ready_at, uploaded_by, external_url, archived_at) values
  ('d2400000-0000-4000-8000-0000000000a1', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'single_line_diagram', 'A1 skeem', 'a1', 'application/pdf', 1, 'ready', now(), pg_temp.uid('a_admin'), 'https://drive.example.com/a1', null),
  ('d2400000-0000-4000-8000-0000000000a3', pg_temp.org('a'), pg_temp.site('a1'), null, 'other', 'A1 arhiivis', 'a3', 'application/pdf', 1, 'ready', now(), pg_temp.uid('a_admin'), 'https://drive.example.com/a3', now()),
  ('d2400000-0000-4000-8000-0000000000a2', pg_temp.org('a'), pg_temp.site('a2'), null, 'other', 'A2 dokument', 'a2', 'application/pdf', 1, 'ready', now(), pg_temp.uid('a_admin'), 'https://drive.example.com/a2', null),
  ('d2400000-0000-4000-8000-0000000000a0', pg_temp.org('a'), null, null, 'other', 'A üldine', 'a0', 'application/pdf', 1, 'ready', now(), pg_temp.uid('a_admin'), 'https://drive.example.com/a0', null),
  ('d2400000-0000-4000-8000-0000000000b1', pg_temp.org('b'), pg_temp.site('b1'), null, 'other', 'B dokument', 'b1', 'application/pdf', 1, 'ready', now(), pg_temp.uid('b_admin'), 'https://drive.example.com/b1', null);

create temporary table tokens (k text primary key, token text);
grant select, insert on tokens to authenticated;
create function pg_temp.tok(p text) returns text language sql stable as $$ select token from tokens where k = p $$;
grant execute on function pg_temp.tok(text) to authenticated;

-- True when a statement is refused: an error, or no row changed.
create function pg_temp.blocked(p_sql text) returns boolean language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n = 0;
exception when others then
  return true;
end $$;
grant execute on function pg_temp.blocked(text) to authenticated;

select plan(68);

-- ===========================================================================
-- Inviting
-- ===========================================================================

select pg_temp.login('a_operator');
select throws_ok($$ select * from public.create_site_viewer_invitation(pg_temp.org('a'), 'outsider@example.ee', array[pg_temp.site('a1')]) $$,
  '42501', 'forbidden', 'an operator cannot invite viewers');
select pg_temp.login('a_viewer');
select throws_ok($$ select * from public.create_site_viewer_invitation(pg_temp.org('a'), 'outsider@example.ee', array[pg_temp.site('a1')]) $$,
  '42501', 'forbidden', 'a company viewer cannot invite viewers');
select pg_temp.login('b_admin');
select throws_ok($$ select * from public.create_site_viewer_invitation(pg_temp.org('a'), 'outsider@example.ee', array[pg_temp.site('a1')]) $$,
  '42501', 'forbidden', 'an admin of another company cannot invite to A');

select pg_temp.login('a_admin');
select throws_ok($$ select * from public.create_site_viewer_invitation(pg_temp.org('a'), 'outsider@example.ee', array[pg_temp.site('b1')]) $$,
  '22023', 'invalid_sites', 'only the company''s own sites');
select throws_ok($$ select * from public.create_site_viewer_invitation(pg_temp.org('a'), 'outsider@example.ee', array[]::uuid[]) $$,
  '22023', 'invalid_sites', 'at least one site');
select throws_ok($$ select * from public.create_site_viewer_invitation(pg_temp.org('a'), 'a.operator@example.ee', array[pg_temp.site('a1')]) $$,
  'P0001', 'already_member', 'members are not invited as viewers');
select throws_ok($$ select * from public.create_site_viewer_invitation(pg_temp.org('a'), 'pole e-post', array[pg_temp.site('a1')]) $$,
  '22023', 'invalid_email', 'a valid e-mail address is required');
select lives_ok($$ insert into tokens select 'old', token from public.create_site_viewer_invitation(pg_temp.org('a'), 'outsider@example.ee', array[pg_temp.site('a2')]) $$,
  'an admin invites a viewer');
select pg_temp.login('a_owner');
select lives_ok($$ insert into tokens select 'v', token from public.create_site_viewer_invitation(pg_temp.org('a'), ' Outsider@Example.ee ', array[pg_temp.site('a1')]) $$,
  'the owner invites the same person again (to site a1 only)');
select is((select count(*)::int from public.site_viewer_invitations where organisation_id = pg_temp.org('a') and accepted_at is null and revoked_at is null),
  1, 'the new invitation replaced the earlier one');
select throws_ok($$ select token_hash from public.site_viewer_invitations $$, '42501', null, 'token hashes are not readable');

-- ===========================================================================
-- Accepting
-- ===========================================================================

select pg_temp.login('outsider');
select is(public.site_viewer_invitation_preview(pg_temp.tok('old')) ->> 'status', 'revoked', 'the replaced link is dead');
select is(public.site_viewer_invitation_preview(pg_temp.tok('v')) ->> 'status', 'valid', 'the live link previews');
select is(public.site_viewer_invitation_preview(pg_temp.tok('v')) -> 'sites', '["A objekt 1"]'::jsonb, 'it names only the invited site');
select pg_temp.login('b_owner');
select throws_ok($$ select public.accept_site_viewer_invitation(pg_temp.tok('v')) $$, 'P0001', 'invitation_email_mismatch',
  'someone else cannot use the link');
select pg_temp.login('outsider');
select is(public.accept_site_viewer_invitation(pg_temp.tok('v')), pg_temp.site('a1'), 'the invited person accepts');
select throws_ok($$ select public.accept_site_viewer_invitation(pg_temp.tok('v')) $$, 'P0001', 'invitation_used', 'a link works once');
select throws_ok($$ select public.accept_site_viewer_invitation('x') $$, 'P0001', 'invitation_invalid', 'a made-up token is invalid');

-- ===========================================================================
-- Reading: exactly site a1
-- ===========================================================================

select results_eq($$ select id from public.sites order by id $$, $$ values (pg_temp.site('a1')) $$, 'sites: only a1');
select results_eq($$ select id from public.electrical_installations order by id $$, $$ values (pg_temp.inst('a1')) $$, 'installations: only a1');
select results_eq($$ select description from public.log_entries order by 1 $$, $$ values ('A1 kanne') $$, 'operating log: only a1');
select results_eq($$ select title from public.deficiencies order by 1 $$, $$ values ('A1 puudus') $$, 'deficiencies: only a1');
select results_eq($$ select title from public.scheduled_activities order by 1 $$, $$ values ('A1 kontroll') $$, 'operating plan: only a1');
select results_eq($$ select title from public.documents order by 1 $$, $$ values ('A1 skeem') $$,
  'documents: only the live links of a1 (no other site, no company documents, nothing archived)');
select is((select count(*)::int from public.sites where id = pg_temp.site('a2')), 0, 'direct id of another site in the same company: nothing');
select is((select count(*)::int from public.log_entries where id = 'e2400000-0000-4000-8000-0000000000b1'), 0, 'direct id in another company: nothing');
select is((select count(*)::int from public.organisations), 0, 'no company rows');
select is((select count(*)::int from public.organisation_members), 0, 'no members');
select is((select count(*)::int from public.organisation_invitations), 0, 'no member invitations');
select is((select count(*)::int from public.site_viewer_invitations), 0, 'no viewer invitations');
select is((select count(*)::int from public.profiles where id <> pg_temp.uid('outsider')), 0, 'no other people''s profiles');
select is((select count(*)::int from public.activity_history), 0, 'no change history');
select is((select count(*)::int from public.site_viewers), 1, 'only their own grant');
select results_eq($$ select organisation_name, site_name from public.my_site_access() $$, $$ values ('Organisatsioon A'::text, 'A objekt 1'::text) $$,
  'my_site_access: company and site names only');
select throws_ok($$ select public.site_viewers_overview(pg_temp.site('a1')) $$, 'P0002', 'not_found', 'a viewer cannot list viewers');

-- ===========================================================================
-- Writing: everything refused
-- ===========================================================================

select ok(pg_temp.blocked($$ insert into public.sites (organisation_id, name) values (pg_temp.org('a'), 'Uus') $$), 'no new site');
select ok(pg_temp.blocked($$ update public.sites set name = 'Muudetud' where id = pg_temp.site('a1') $$), 'no site change');
select ok(pg_temp.blocked($$ delete from public.sites where id = pg_temp.site('a1') $$), 'no site deletion');
select ok(pg_temp.blocked($$ insert into public.electrical_installations (organisation_id, site_id, name, installation_type) values (pg_temp.org('a'), pg_temp.site('a1'), 'Uus', 'switchboard') $$), 'no new installation');
select ok(pg_temp.blocked($$ update public.electrical_installations set name = 'X' where id = pg_temp.inst('a1') $$), 'no installation change');
select ok(pg_temp.blocked($$ delete from public.electrical_installations where id = pg_temp.inst('a1') $$), 'no installation deletion');
select ok(pg_temp.blocked($$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description) values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'Vaataja kanne') $$), 'no log entry');
select ok(pg_temp.blocked($$ update public.log_entries set description = 'X' where site_id = pg_temp.site('a1') $$), 'no log change');
select ok(pg_temp.blocked($$ delete from public.log_entries where site_id = pg_temp.site('a1') $$), 'no log deletion');
select ok(pg_temp.blocked($$ insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity) values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'X', 'X', 'low') $$), 'no new deficiency');
select ok(pg_temp.blocked($$ update public.deficiencies set title = 'X' where site_id = pg_temp.site('a1') $$), 'no deficiency change');
select ok(pg_temp.blocked($$ insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on) values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'X', 'once', current_date + 1) $$), 'no new activity');
select ok(pg_temp.blocked($$ update public.scheduled_activities set title = 'X' where site_id = pg_temp.site('a1') $$), 'no activity change');
select ok(pg_temp.blocked($$ delete from public.scheduled_activities where site_id = pg_temp.site('a1') $$), 'no activity deletion');
select ok(pg_temp.blocked($$ insert into public.documents (organisation_id, site_id, category, title, original_filename, mime_type, size_bytes, external_url) values (pg_temp.org('a'), pg_temp.site('a1'), 'other', 'X', 'x', 'application/pdf', 1, 'https://example.com/x') $$), 'no new document');
select ok(pg_temp.blocked($$ update public.documents set title = 'X' where site_id = pg_temp.site('a1') $$), 'no document change');
select ok(pg_temp.blocked($$ delete from public.documents where site_id = pg_temp.site('a1') $$), 'no document deletion');
select ok(pg_temp.blocked($$ update public.site_viewers set revoked_at = null $$), 'no change to grants');
select ok(pg_temp.blocked($$ insert into public.site_viewers (organisation_id, site_id, user_id) values (pg_temp.org('a'), pg_temp.site('a2'), pg_temp.uid('outsider')) $$), 'cannot grant themselves another site');
select ok(pg_temp.blocked($$ select public.complete_scheduled_activity('5c240000-0000-4000-8000-0000000000a1', current_date, 'inspection', now(), 'Tehtud') $$), 'cannot complete an activity');
select ok(pg_temp.blocked($$ select public.resolve_deficiency('df240000-0000-4000-8000-0000000000a1', 'Lahendatud', 'repair', now()) $$), 'cannot resolve a deficiency');
select ok(pg_temp.blocked($$ select * from public.create_invitation(pg_temp.org('a'), 'x@example.ee', 'viewer') $$), 'cannot invite members');
select ok(pg_temp.blocked($$ select * from public.create_site_viewer_invitation(pg_temp.org('a'), 'x@example.ee', array[pg_temp.site('a1')]) $$), 'cannot invite viewers');

-- ===========================================================================
-- Unpaid or deactivated company: viewers see nothing
-- ===========================================================================

reset role;
update private.organisation_access set trial_started_at = now() - interval '30 days', trial_ends_at = now() - interval '16 days',
  full_access_from = null, full_access_until = null where organisation_id = pg_temp.org('a');
select pg_temp.login('outsider');
select is((select count(*)::int from public.sites), 0, 'unpaid (expired) company: the viewer sees nothing');
reset role;
update private.organisation_access set trial_started_at = now(), trial_ends_at = now() + interval '14 days' where organisation_id = pg_temp.org('a');
update public.organisations set deactivated_at = now() where id = pg_temp.org('a');
select pg_temp.login('outsider');
select is((select count(*)::int from public.log_entries), 0, 'deactivated company: the viewer sees nothing');
reset role;
update public.organisations set deactivated_at = null where id = pg_temp.org('a');
select pg_temp.login('outsider');
select is((select count(*)::int from public.sites), 1, 'active again: the site is back');

-- ===========================================================================
-- Seats (configuration) and revoking
-- ===========================================================================

reset role;
select is(private.seats_used(pg_temp.org('a')), 5, 'viewers do not count as users by default (A has 5 members)');
update private.plan_settings set site_viewers_count_as_users = true;
select is(private.seats_used(pg_temp.org('a')), 6, 'with the setting on, the viewer counts');
update private.plan_settings set site_viewers_count_as_users = false;

select pg_temp.login('a_admin');
select is(jsonb_array_length(public.site_viewers_overview(pg_temp.site('a1')) -> 'viewers'), 1, 'the admin sees the viewer on the site');
select pg_temp.login('b_admin');
select throws_ok($$ select public.revoke_site_viewer((select id from public.site_viewers limit 1)) $$, 'P0002', 'not_found',
  'another company cannot revoke (and sees no grant id)');
reset role;
create temporary table grant_id as select id from public.site_viewers where user_id = pg_temp.uid('outsider');
grant select on grant_id to authenticated;
select pg_temp.login('a_operator');
select throws_ok($$ select public.revoke_site_viewer((select id from grant_id)) $$, 'P0002', 'not_found', 'an operator cannot revoke');
select pg_temp.login('a_admin');
select lives_ok($$ select public.revoke_site_viewer((select id from grant_id)) $$, 'the admin revokes');
select pg_temp.login('outsider');
select is((select count(*)::int from public.sites) + (select count(*)::int from public.log_entries) + (select count(*)::int from public.documents),
  0, 'access is gone at once (same session, next query)');

select * from finish();
rollback;
