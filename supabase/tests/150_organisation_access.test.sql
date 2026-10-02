-- Company access: 14-day trial from creation, read-only expiry enforced in the database,
-- manual full access by platform admins only, audited; reads, notifications, reminders and
-- the owner's lifecycle actions keep working for an expired company.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

select plan(56);

insert into test_users (name, id, email) values ('platform', 'c0000000-0000-4000-8000-0000000000ad', 'platvorm@example.ee');
insert into auth.users (id, email, email_confirmed_at, aud, role)
values ('c0000000-0000-4000-8000-0000000000ad', 'platvorm@example.ee', now(), 'authenticated', 'authenticated');
select private.bootstrap_platform_admin('platvorm@example.ee');

-- a_owner is also an admin of B: one user, two companies.
insert into public.organisation_members (organisation_id, user_id, role) values (pg_temp.org('b'), pg_temp.uid('a_owner'), 'admin');
insert into public.scheduled_activities (id, organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on, created_by)
values ('af000000-0000-4000-8000-000000000001', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Kontroll', 'once', current_date + 40, pg_temp.uid('a_admin'));
insert into public.deficiencies (id, organisation_id, site_id, electrical_installation_id, title, description, severity, created_by)
values ('df000000-0000-4000-8000-0000000000f1', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Klemm', 'Lahti', 'high', pg_temp.uid('a_operator'));
insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'Enne aegumist', pg_temp.uid('a_operator'));

create function pg_temp.status(p_org uuid) returns text language sql as $$ select status from private.organisation_access_state(p_org) $$;
create function pg_temp.expire(p_org uuid) returns void language sql as $$
  update private.organisation_access set trial_started_at = now() - interval '15 days', trial_ends_at = now() - interval '1 day' where organisation_id = p_org
$$;
create function pg_temp.log_insert(p_desc text) returns void language sql as $$
  insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description)
  values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', p_desc)
$$;
grant execute on function pg_temp.log_insert(text) to authenticated;

-- ===========================================================================
-- Trial
-- ===========================================================================

insert into public.organisations (id, name, slug) values ('0e000000-0000-4000-8000-00000000000e', 'Uus OÜ', 'uus-ou-test');
select is((select trial_ends_at - trial_started_at from private.organisation_access where organisation_id = '0e000000-0000-4000-8000-00000000000e'),
  interval '14 days', 'a new company gets a 14-day trial (exactly 14 × 24 h)');
select is(pg_temp.status('0e000000-0000-4000-8000-00000000000e'), 'trial', 'its status is trial');
select is((select status from private.organisation_access_state(pg_temp.org('a'), (select trial_ends_at from private.organisation_access where organisation_id = pg_temp.org('a')) - interval '1 second')),
  'trial', 'one second before the end: trial');
select is((select status from private.organisation_access_state(pg_temp.org('a'), (select trial_ends_at from private.organisation_access where organisation_id = pg_temp.org('a')))),
  'expired', 'at the exact end timestamp: expired');

select pg_temp.login('a_operator');
select lives_ok($$ select pg_temp.log_insert('Proovi ajal') $$, 'during the trial an operator writes');
select is(public.organisation_access(pg_temp.org('a'))->>'status', 'trial', 'members read their company''s access');
select ok((public.organisation_access(pg_temp.org('a'))->>'writable')::boolean, 'and see that it is writable');
select ok(public.organisation_access(pg_temp.org('a')) ?| array['invoice_reference', 'admin_notes', 'activated_by'] = false,
  'no admin fields are exposed to customers');

-- ===========================================================================
-- Expired: read-only, enforced in the database
-- ===========================================================================

select pg_temp.logout();
reset role;
select pg_temp.expire(pg_temp.org('a'));
select is(pg_temp.status(pg_temp.org('a')), 'expired', 'after the trial end the company is expired');

select pg_temp.login('a_operator');
select throws_ok($$ select pg_temp.log_insert('Pärast aegumist') $$, '42501', null, 'expired: no operating-log entries');
select throws_ok($$ select public.complete_scheduled_activity('af000000-0000-4000-8000-000000000001', current_date + 40, 'inspection', now(), null, null, null) $$,
  null, null, 'expired: activities cannot be completed');
select throws_ok($$ select public.resolve_deficiency('df000000-0000-4000-8000-0000000000f1', 'Parandatud', 'repair', now(), null) $$,
  null, null, 'expired: deficiencies cannot be resolved');
with u as (update public.deficiencies set title = 'Muudetud' where id = 'df000000-0000-4000-8000-0000000000f1' returning 1)
select is(count(*)::int, 0, 'expired: deficiencies cannot be edited') from u;
select throws_ok($$ insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity)
                    values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Uus', 'x', 'low') $$, null, null,
  'expired: no new deficiencies');
select throws_ok($$ insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes)
                    values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'manual', 'D', 'd.pdf', 'application/pdf', 10) $$, null, null,
  'expired: no uploads');

select pg_temp.login('a_admin');
select throws_ok($$ insert into public.sites (organisation_id, name) values (pg_temp.org('a'), 'Uus objekt') $$, '42501', null, 'expired: no new sites');
with u as (update public.sites set name = 'X' where id = pg_temp.site('a1') returning 1)
select is(count(*)::int, 0, 'expired: sites cannot be edited') from u;
with u as (update public.electrical_installations set name = 'X' where id = pg_temp.inst('a1') returning 1)
select is(count(*)::int, 0, 'expired: installations cannot be edited') from u;
with u as (update public.scheduled_activities set reminder_days = '{1}' where id = 'af000000-0000-4000-8000-000000000001' returning 1)
select is(count(*)::int, 0, 'expired: plan and reminder thresholds cannot be changed') from u;
select throws_ok($$ select public.create_invitation(pg_temp.org('a'), 'uus@example.ee', 'viewer') $$, null, null, 'expired: no invitations');
with u as (update public.organisation_members set role = 'operator' where user_id = pg_temp.uid('a_viewer') and organisation_id = pg_temp.org('a') returning 1)
select is(count(*)::int, 0, 'expired: member roles cannot be changed') from u;
with u as (update public.organisations set notes = 'x' where id = pg_temp.org('a') returning 1)
select is(count(*)::int, 0, 'expired: company details cannot be changed') from u;

-- Reads stay.
select is((select count(*)::int from public.log_entries where organisation_id = pg_temp.org('a')), 2, 'expired: the operating log is readable and intact');
select ok((select count(*) from public.activity_history where organisation_id = pg_temp.org('a')) > 0, 'expired: admins still read the change history');
select pg_temp.login('a_viewer');
select is((select count(*)::int from public.deficiencies where organisation_id = pg_temp.org('a')), 1, 'expired: viewers read deficiencies');
select is((select count(*)::int from public.scheduled_activities where organisation_id = pg_temp.org('a')), 1, 'expired: the plan is readable');

-- Multi-company: the same user writes in B (trial) but not in A (expired).
select pg_temp.login('a_owner');
select lives_ok($$ insert into public.sites (organisation_id, name) values (pg_temp.org('b'), 'B uus objekt') $$, 'same user: writes work in the trial company');
select throws_ok($$ insert into public.sites (organisation_id, name) values (pg_temp.org('a'), 'A uus objekt') $$, '42501', null, '…and are refused in the expired one');

-- Customers can't change commercial access.
select throws_ok($$ select * from private.organisation_access $$, '42501', null, 'customers cannot read the access table');
select throws_ok($$ update private.organisation_access set trial_ends_at = now() + interval '1 year' $$, '42501', null, 'customers cannot extend their trial');
select throws_ok($$ select public.admin_extend_trial(pg_temp.org('a'), now() + interval '7 days') $$, 'P0002', 'not_found', 'an owner cannot use the admin extension');
select throws_ok($$ select public.admin_set_full_access(pg_temp.org('a'), null, null, null) $$, 'P0002', 'not_found', 'an owner cannot activate full access');
select throws_ok($$ select private.can_company_write(pg_temp.org('a')) $$, '42501', null, 'the access helpers are not callable');
select pg_temp.login('b_owner');
select throws_ok($$ select public.organisation_access(pg_temp.org('a')) $$, 'P0002', 'not_found', 'another tenant cannot read A''s access');

-- Notifications and reminders keep working; the owner's lifecycle actions too.
select pg_temp.logout();
reset role;
select ok(private.generate_activity_reminders(current_date + 30, 'af000000-0000-4000-8000-000000000001') > 0,
  'reminders are still generated for an expired (not deactivated) company');
select pg_temp.login('a_operator');
with u as (update public.notifications set read_at = now() where user_id = auth.uid() returning 1)
select ok(count(*) > 0, 'expired: users read and mark their notifications') from u;
select pg_temp.login('a_owner');
select lives_ok($$ select public.deactivate_organisation(pg_temp.org('a'), 'Organisatsioon A') $$, 'expired: the owner can still deactivate');
select pg_temp.logout();
reset role;
select is(pg_temp.status(pg_temp.org('a')), 'deactivated', 'lifecycle state takes precedence');
select pg_temp.login('a_owner');
select lives_ok($$ select public.reactivate_organisation(pg_temp.org('a')) $$, 'and reactivate (still commercially expired)');
select pg_temp.logout();
reset role;
select is(pg_temp.status(pg_temp.org('a')), 'expired', 'reactivated, still read-only');

-- ===========================================================================
-- Platform admin
-- ===========================================================================

select pg_temp.login('platform');
select lives_ok($$ select public.admin_extend_trial(pg_temp.org('a'), now() + interval '7 days') $$, 'the platform admin extends the trial');
select throws_ok($$ select public.admin_extend_trial(pg_temp.org('a'), now() + interval '1 day') $$, '22023', null, 'an extension must move the end later');
select pg_temp.login('a_operator');
select lives_ok($$ select pg_temp.log_insert('Pärast pikendust') $$, 'after the extension writes work again');
select pg_temp.logout();
reset role;
select is((select trial_started_at < now() - interval '14 days' from private.organisation_access where organisation_id = pg_temp.org('a')), true,
  'the original trial start is kept');

select pg_temp.login('platform');
select lives_ok($$ select public.admin_set_full_access(pg_temp.org('a'), now() + interval '30 days', 'ARV-2026-001', 'Makstud ülekandega') $$, 'activate full access until a date');
select is(public.admin_company_access(pg_temp.org('a'))->>'status', 'active', 'status active');
select is(public.admin_company_access(pg_temp.org('a'))->>'invoice_reference', 'ARV-2026-001', 'the invoice reference is recorded');
select lives_ok($$ select public.admin_set_full_access(pg_temp.org('a'), null, null, null) $$, 'grant indefinite access');
select is(public.admin_company_access(pg_temp.org('a'))->>'full_access_until', null, 'indefinite: no end date');
select lives_ok($$ select public.admin_expire_access(pg_temp.org('a')) $$, 'expire access manually');
select pg_temp.login('a_operator');
select throws_ok($$ select pg_temp.log_insert('Peale käsitsi aegumist') $$, '42501', null, 'manual expiry blocks writes at once');
select pg_temp.login('platform');
select lives_ok($$ select public.admin_set_full_access(pg_temp.org('a'), null, null, null) $$, 'restore full access');
select pg_temp.logout();
reset role;
select results_eq(
  $$ select action from private.admin_audit_log where target_type = 'company' and target_id = (select pg_temp.org('a'))::text order by id $$,
  $$ values ('trial_extended'), ('full_access_set'), ('full_access_set'), ('access_expired'), ('full_access_set') $$,
  'every access change is audited with before/after state');

-- 90 days after expiry: flagged, nothing deleted.
update private.organisation_access set expired_manually_at = now() - interval '91 days' where organisation_id = pg_temp.org('a');
select pg_temp.login('platform');
select ok((public.admin_company_access(pg_temp.org('a'))->>'expired_90')::boolean, 'expired for 90+ days is flagged for the platform admin');
select ok(public.admin_company_access_list('expired_90') ? (pg_temp.org('a'))::text, 'and appears under the 90+ filter');
select pg_temp.logout();
reset role;
select is((select count(*)::int from public.log_entries where organisation_id = pg_temp.org('a')), 3, 'nothing is deleted automatically');

select * from finish();
rollback;
