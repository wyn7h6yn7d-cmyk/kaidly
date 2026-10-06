-- The 14-day trial is personal (docs/SUBSCRIPTIONS.md): one per user, started by creating
-- their first company; later companies share its end (remaining time only, or none);
-- deleting a company never resets it; invitations never start it; ownership changes never
-- touch it; a paid plan overrides it. Plus: managing data at a plan limit — editing,
-- archiving, removing, deactivating and deleting — is never blocked by the limit.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

select plan(44);

insert into test_users (name, id, email) values ('platform', 'c0000000-0000-4000-8000-0000000000ad', 'platvorm@example.ee');
insert into auth.users (id, email, email_confirmed_at, aud, role)
values ('c0000000-0000-4000-8000-0000000000ad', 'platvorm@example.ee', now(), 'authenticated', 'authenticated');
select private.bootstrap_platform_admin('platvorm@example.ee');

create function pg_temp.root() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end $$;
grant execute on function pg_temp.root() to authenticated, anon;

-- Creates a company as a user (the app's only path) and returns its id.
create function pg_temp.create_as(p_user text, p_name text) returns uuid language plpgsql as $$
declare v_slug text; v_id uuid;
begin
  perform pg_temp.login(p_user);
  v_slug := public.create_organisation(p_name);
  perform pg_temp.root();
  select id into v_id from public.organisations where slug = v_slug;
  return v_id;
end $$;
create function pg_temp.access(p_org uuid) returns private.organisation_access language sql as $$
  select * from private.organisation_access where organisation_id = p_org $$;
create function pg_temp.status(p_org uuid) returns text language sql as $$
  select status from private.organisation_access_state(p_org) $$;
create function pg_temp.trial(p_user text) returns private.user_trials language sql as $$
  select * from private.user_trials where user_id = pg_temp.uid(p_user) $$;

-- ===========================================================================
-- Invitations and existing companies
-- ===========================================================================

select is((select count(*)::int from private.user_trials where user_id in (select id from test_users)), 0,
  'being a member of other companies starts no personal trial');
select ok((pg_temp.access(pg_temp.org('a'))).user_limit is null and pg_temp.status(pg_temp.org('a')) = 'trial',
  'existing companies keep their access and have no limits');

-- ===========================================================================
-- First company starts the personal trial
-- ===========================================================================

create temporary table orgs (n text primary key, id uuid);
insert into orgs values ('first', pg_temp.create_as('outsider', 'Esimene OÜ'));
create function pg_temp.o(p text) returns uuid language sql stable as $$ select id from orgs where n = p $$;
grant select on orgs to authenticated;
grant execute on function pg_temp.o(text) to authenticated;

select ok((pg_temp.trial('outsider')).user_id is not null, 'creating the first company starts the personal trial');
select is((pg_temp.trial('outsider')).ends_at - (pg_temp.trial('outsider')).started_at, interval '14 days', 'personal trial: 14 days');
select is((pg_temp.trial('outsider')).first_organisation_id, pg_temp.o('first'), 'it records the first company');
select is((pg_temp.access(pg_temp.o('first'))).trial_ends_at, (pg_temp.trial('outsider')).ends_at, 'the company trial ends with the personal trial');
select is(array[(pg_temp.access(pg_temp.o('first'))).user_limit, (pg_temp.access(pg_temp.o('first'))).installation_limit], array[1, 5],
  'trial limits: 1 user, 5 active installations');
select is(pg_temp.status(pg_temp.o('first')), 'trial', 'the company is on trial');

-- The client cannot see or forge it.
select pg_temp.login('outsider');
select throws_ok($$ select * from private.user_trials $$, '42501', null, 'users cannot read the trial table');
select throws_ok($$ update private.user_trials set ends_at = now() + interval '1 year' $$, '42501', null, 'users cannot change their trial');
select is((public.my_trial() ->> 'active')::boolean, true, 'my_trial shows the own trial');
select pg_temp.login('a_owner');
select is(public.my_trial(), null, 'a user without a trial gets nothing');
select pg_temp.root();

-- ===========================================================================
-- Delete and re-create: only the remaining time
-- ===========================================================================

select pg_temp.login('outsider');
select lives_ok($$ select public.delete_organisation(pg_temp.o('first'), 'Esimene OÜ') $$, 'the owner deletes the (empty) company');
select pg_temp.root();
select is((select count(*)::int from public.organisations where id = pg_temp.o('first')), 0, 'the company is gone');
select ok((pg_temp.trial('outsider')).user_id is not null and (pg_temp.trial('outsider')).first_organisation_id is null,
  'the personal trial survives the deletion');

-- Five days later.
update private.user_trials set started_at = now() - interval '5 days', ends_at = now() + interval '9 days' where user_id = pg_temp.uid('outsider');
insert into orgs values ('second', pg_temp.create_as('outsider', 'Teine OÜ'));
select is((pg_temp.access(pg_temp.o('second'))).trial_ends_at, (pg_temp.trial('outsider')).ends_at,
  're-created after 5 days: only the remaining 9 days');
select ok((pg_temp.access(pg_temp.o('second'))).trial_ends_at < now() + interval '10 days', 'not a new 14 days');
select is((select count(*)::int from private.user_trials where user_id = pg_temp.uid('outsider')), 1, 'still one personal trial');

-- Several companies at once: all share the same end.
insert into orgs values ('third', pg_temp.create_as('outsider', 'Kolmas OÜ'));
select is((pg_temp.access(pg_temp.o('third'))).trial_ends_at, (pg_temp.access(pg_temp.o('second'))).trial_ends_at,
  'a further company cannot extend the trial');

-- After the personal trial has ended: no new trial, read-only until a paid plan.
update private.user_trials set started_at = now() - interval '20 days', ends_at = now() - interval '6 days' where user_id = pg_temp.uid('outsider');
insert into orgs values ('late', pg_temp.create_as('outsider', 'Hiline OÜ'));
select is(pg_temp.status(pg_temp.o('late')), 'expired', 'after the personal trial: a new company has no trial');
select is((select count(*)::int from public.organisation_members where organisation_id = pg_temp.o('late')), 1, 'the creator is its owner');
select pg_temp.login('outsider');
select throws_ok($$ insert into public.sites (organisation_id, name) values (pg_temp.o('late'), 'X') $$, '42501', null,
  'and it is read-only (never silently unlimited)');
select pg_temp.root();

-- A paid plan overrides the personal trial.
select pg_temp.login('platform');
select public.admin_set_subscription(pg_temp.o('late'), 'pro', null, null, null, null, 1, null, null);
select pg_temp.root();
select is(pg_temp.status(pg_temp.o('late')), 'active', 'a paid plan activates the company');
select pg_temp.login('outsider');
select lives_ok($$ insert into public.sites (organisation_id, name) values (pg_temp.o('late'), 'Makstud objekt') $$,
  'and restores write access despite the used trial');
select pg_temp.root();

-- ===========================================================================
-- Invited users keep their own trial; ownership changes do not touch trials
-- ===========================================================================

insert into orgs values ('viewer_own', pg_temp.create_as('a_viewer', 'Vaataja oma OÜ'));
select is((pg_temp.trial('a_viewer')).ends_at - (pg_temp.trial('a_viewer')).started_at, interval '14 days',
  'a long-time invited member still gets their own first 14-day trial');
select ok((pg_temp.access(pg_temp.o('viewer_own'))).trial_ends_at > now() + interval '13 days', 'starting now');

-- Ownership transfer of a trial company: the trial end stays; the new owner's trial is not used.
update private.user_trials set started_at = now() - interval '2 days', ends_at = now() + interval '12 days' where user_id = pg_temp.uid('outsider');
insert into orgs values ('transfer', pg_temp.create_as('outsider', 'Üleantav OÜ'));
create temporary table transfer_before as select trial_ends_at from private.organisation_access where organisation_id = (select id from orgs where n = 'transfer');
select pg_temp.login('platform');
select public.admin_set_subscription(pg_temp.o('transfer'), 'team', null, null, null, null, null, null, null); -- seats for a second owner
select pg_temp.root();
insert into public.organisation_members (organisation_id, user_id, role) values (pg_temp.o('transfer'), pg_temp.uid('b_admin'), 'owner');
update public.organisation_members set role = 'admin' where organisation_id = pg_temp.o('transfer') and user_id = pg_temp.uid('outsider');
select is((pg_temp.access(pg_temp.o('transfer'))).trial_ends_at, (select trial_ends_at from transfer_before),
  'ownership transfer keeps the trial end');
select is((select count(*)::int from private.user_trials where user_id = pg_temp.uid('b_admin')), 0,
  'the new owner''s personal trial is not started or used');
select is(pg_temp.status(pg_temp.o('transfer')), 'trial', 'still on its trial');

-- ===========================================================================
-- Managing data at a limit is never blocked by the limit
-- ===========================================================================

insert into orgs values ('full', pg_temp.create_as('a_operator', 'Täis OÜ'));
-- Set-up as the database owner (sites with known ids); the limit triggers apply all the same.
insert into public.sites (id, organisation_id, name) values ('5f000000-0000-4000-8000-0000000000f1', pg_temp.o('full'), 'Täis objekt');
insert into public.sites (id, organisation_id, name) values ('5f000000-0000-4000-8000-0000000000f2', pg_temp.o('full'), 'Teine objekt');
insert into public.electrical_installations (organisation_id, site_id, name, installation_type)
select pg_temp.o('full'), '5f000000-0000-4000-8000-0000000000f1', 'Kilp ' || g, 'switchboard' from generate_series(1, 5) g;
select is(private.installations_active(pg_temp.o('full')), 5, 'at the installation limit (5 / 5)');
select is(private.seats_used(pg_temp.o('full')), 1, 'and the user limit (1 / 1)');
select pg_temp.login('a_operator');
select lives_ok($$ update public.organisations set name = 'Täis OÜ (uus nimi)', contact_email = 'info@example.ee' where id = pg_temp.o('full') $$,
  'company details stay editable');
select lives_ok($$ update public.sites set name = 'Täis objekt (muudetud)' where id = '5f000000-0000-4000-8000-0000000000f1' $$,
  'sites stay editable');
select lives_ok($$ update public.electrical_installations set name = name || ' (muudetud)', identifier = 'X-1', responsible_person = 'Uus vastutaja'
                    where organisation_id = pg_temp.o('full') and name = 'Kilp 1' $$, 'installations stay editable at the limit');
select lives_ok($$ update public.electrical_installations set site_id = '5f000000-0000-4000-8000-0000000000f2' where organisation_id = pg_temp.o('full') and name like 'Kilp 2%' $$,
  'moving an installation to another site uses no slot');
select pg_temp.root();
select is(private.installations_active(pg_temp.o('full')), 5, 'still 5 / 5 after the edits');
select pg_temp.login('a_operator');
select lives_ok($$ update public.electrical_installations set archived_at = now() where organisation_id = pg_temp.o('full') and name like 'Kilp 3%' $$,
  'archiving at the limit works');
select lives_ok($$ insert into public.electrical_installations (organisation_id, site_id, name, installation_type)
                   values (pg_temp.o('full'), '5f000000-0000-4000-8000-0000000000f1', 'Uus kilp', 'switchboard') $$, 'the freed slot can be used');
select throws_ok($$ update public.electrical_installations set archived_at = null where organisation_id = pg_temp.o('full') and name like 'Kilp 3%' $$,
  'P0001', 'plan_installation_limit', 'restoring above the limit is refused');
select pg_temp.root();

-- Roles that may not deactivate/delete still cannot; the owner can, at the limit.
select pg_temp.login('b_admin');
select throws_ok($$ select public.deactivate_organisation(pg_temp.o('full'), 'Täis OÜ (uus nimi)') $$, 'P0002', 'not_found',
  'a non-owner cannot deactivate');
select pg_temp.login('a_operator');
select throws_ok($$ select public.deactivate_organisation(pg_temp.o('full'), 'vale nimi') $$, 'P0001', 'confirmation_mismatch',
  'deactivation needs the exact name');
select lives_ok($$ select public.deactivate_organisation(pg_temp.o('full'), 'Täis OÜ (uus nimi)') $$,
  'the owner deactivates the company at its plan limit');
select pg_temp.root();
select ok((select deactivated_at is not null from public.organisations where id = pg_temp.o('full')), 'deactivated');
select is(pg_temp.status(pg_temp.org('a')), 'trial', 'no other company was affected');

select * from finish();
rollback;
