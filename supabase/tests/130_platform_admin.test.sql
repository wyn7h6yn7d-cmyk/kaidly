-- KAIDLY platform administration: a separate, database-backed capability. Organisation
-- roles never grant it; it never makes the admin a company member; every admin function
-- answers 'not_found' to everyone else; mutations are audited; reads return metadata,
-- never customer content; the deadline view never shows archived or resolved items.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

select plan(57);

-- The platform admin is a plain account with no company membership.
insert into test_users (name, id, email) values ('platform', 'c0000000-0000-4000-8000-0000000000ad', 'platvorm@example.ee');
insert into auth.users (id, email, email_confirmed_at, aud, role)
values ('c0000000-0000-4000-8000-0000000000ad', 'platvorm@example.ee', now(), 'authenticated', 'authenticated');
insert into auth.users (id, email, aud, role)
values ('c0000000-0000-4000-8000-0000000000ae', 'kinnitamata@example.ee', 'authenticated', 'authenticated');

-- Customer data, including content that must never reach the admin console.
insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'SALAJANE-SISU mõõteprotokoll', pg_temp.uid('a_operator'));
insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on, created_by, archived_at)
values
  (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'T-üle', 'once', current_date - 3, pg_temp.uid('a_admin'), null),
  (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'T-peagi', 'once', current_date + 7, pg_temp.uid('a_admin'), null),
  (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'T-arhiivis', 'once', current_date - 3, pg_temp.uid('a_admin'), now()),
  (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'T-kauge', 'once', current_date + 90, pg_temp.uid('a_admin'), null);
insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, due_on, created_by,
                                 status, resolved_at, resolution, resolved_by, resolved_by_name)
values
  (pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'T-kriitiline', 'Kirjeldus', 'critical', current_date - 1, pg_temp.uid('b_operator'), 'open', null, null, null, null),
  (pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'T-oluline', 'Kirjeldus', 'high', null, pg_temp.uid('b_operator'), 'open', null, null, null, null),
  (pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'T-lahendatud', 'Kirjeldus', 'critical', current_date - 9, pg_temp.uid('b_operator'), 'resolved', now(), 'Parandatud', pg_temp.uid('b_operator'), 'B Operator'),
  (pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'T-keskmine', 'Kirjeldus', 'medium', current_date - 9, pg_temp.uid('b_operator'), 'open', null, null, null, null);
insert into auth.sessions (id, user_id) values
  (gen_random_uuid(), pg_temp.uid('outsider')), (gen_random_uuid(), pg_temp.uid('a_owner'));

create temporary table expected as
select (select count(*) from public.organisations)::int as companies, (select count(*) from auth.users)::int as users;
grant select on expected to authenticated;

create function pg_temp.deadline_titles(p jsonb) returns text language sql immutable as $$
  select coalesce(string_agg(r->>'item', ',' order by r->>'item'), '')
    from jsonb_array_elements(p->'rows') r where r->>'item' like 'T-%'
$$;
grant execute on function pg_temp.deadline_titles(jsonb) to authenticated;

-- ===========================================================================
-- Nobody but a platform admin
-- ===========================================================================

select ok(not has_function_privilege('anon', 'public.admin_overview()', 'execute'), 'anon cannot call admin functions');
select ok(not has_function_privilege('authenticated', 'private.bootstrap_platform_admin(text)', 'execute'),
  'signed-in users cannot run the bootstrap');
select ok(not has_table_privilege('authenticated', 'private.platform_admins', 'select')
          and not has_table_privilege('authenticated', 'private.platform_admins', 'insert')
          and not has_table_privilege('authenticated', 'private.admin_audit_log', 'select')
          and not has_table_privilege('authenticated', 'private.admin_audit_log', 'insert'),
  'the admin tables are not reachable through the API');

select pg_temp.login('a_owner');
select is(public.am_platform_admin(), false, 'a company owner is not a platform admin');
select throws_ok($$ select public.admin_overview() $$, 'P0002', 'not_found', 'an owner gets not_found from the admin overview');
select throws_ok($$ select public.admin_users() $$, 'P0002', 'not_found', 'an owner cannot list users');
select throws_ok($$ select public.admin_company(pg_temp.org('a')) $$, 'P0002', 'not_found', 'an owner cannot use the admin view of their own company');
select throws_ok($$ select public.admin_deadlines() $$, 'P0002', 'not_found', 'an owner cannot see platform-wide deadlines');
select throws_ok($$ select public.admin_audit_entries() $$, 'P0002', 'not_found', 'an owner cannot read the admin log');
select throws_ok($$ select public.admin_set_member_role((select id from public.organisation_members where user_id = pg_temp.uid('a_viewer') and organisation_id = pg_temp.org('a')), 'owner') $$,
  'P0002', 'not_found', 'an owner cannot use the admin role change');
select throws_ok($$ select public.admin_set_user_disabled(pg_temp.uid('b_owner'), true) $$, 'P0002', 'not_found', 'an owner cannot disable accounts');
select throws_ok($$ select public.admin_revoke_sessions(pg_temp.uid('outsider')) $$, 'P0002', 'not_found', 'an owner cannot revoke sessions');
select throws_ok($$ select public.admin_password_reset_target(pg_temp.uid('outsider')) $$, 'P0002', 'not_found', 'an owner cannot request resets');
select throws_ok($$ select * from private.platform_admins $$, '42501', null, 'an owner cannot read the admin list');
select throws_ok($$ insert into private.platform_admins (user_id) values (auth.uid()) $$, '42501', null, 'an owner cannot make themselves admin');

select pg_temp.login('platform');
select is(public.am_platform_admin(), false, 'nobody is an admin before the bootstrap');
select throws_ok($$ select public.admin_overview() $$, 'P0002', 'not_found', 'the future admin is refused before the bootstrap');

-- ===========================================================================
-- Bootstrap (database owner only)
-- ===========================================================================

select pg_temp.logout();
reset role;
select throws_ok($$ select private.bootstrap_platform_admin('pole@example.ee') $$, 'P0001', 'no confirmed account with this email',
  'the bootstrap refuses an unknown email');
select throws_ok($$ select private.bootstrap_platform_admin('kinnitamata@example.ee') $$, 'P0001', 'no confirmed account with this email',
  'the bootstrap refuses an unconfirmed account');
select is(private.bootstrap_platform_admin('  PLATVORM@example.ee '), 'c0000000-0000-4000-8000-0000000000ad'::uuid,
  'the bootstrap resolves the exact confirmed account and stores its id');

-- ===========================================================================
-- Reads
-- ===========================================================================

select pg_temp.login('platform');
select is(public.am_platform_admin(), true, 'the platform admin is recognised');
select is((select count(*)::int from public.organisations), 0, 'platform admin sees no customer rows through the normal API (not a member)');
select is((select count(*)::int from public.log_entries), 0, 'platform admin reads no operating log through the normal API');
select is((public.admin_overview()->>'companies')::int, (select companies from expected), 'overview counts every company');
select is((public.admin_overview()->>'users')::int, (select users from expected), 'overview counts every account');
select is((public.admin_users('a_owner@')->>'total')::int, 1, 'the user directory searches by email');
select is(public.admin_users('a_owner@')->'rows'->0->'memberships'->0->>'role', 'owner', 'the directory shows memberships and roles');
select is(public.admin_user(pg_temp.uid('a_owner'))->'memberships'->0->>'company', 'Organisatsioon A', 'user detail lists companies');
select is((public.admin_user(pg_temp.uid('a_operator'))->'usage'->>'log_entries')::int, 1, 'user detail summarises usage');
select ok(public.admin_user(pg_temp.uid('a_operator'))::text not like '%SALAJANE%'
          and public.admin_company(pg_temp.org('a'))::text not like '%SALAJANE%',
  'admin views never contain operating-log content');
select ok(public.admin_user(pg_temp.uid('a_owner'))::text !~* '(encrypted_password|token|"password)',
  'user detail carries no credential fields');
select throws_ok($$ select public.admin_user('c0000000-0000-4000-8000-0000000000ff') $$, 'P0002', 'not_found', 'unknown user is not_found');
select is(jsonb_array_length(public.admin_company(pg_temp.org('a'))->'members'),
          5, 'company detail lists every member');

-- Deadlines: open/overdue activities within 14 days and open high/critical deficiencies only.
select is(pg_temp.deadline_titles(public.admin_deadlines()), 'T-kriitiline,T-oluline,T-peagi,T-üle',
  'deadlines: archived, far-future, resolved and medium items are excluded');
select is(pg_temp.deadline_titles(public.admin_deadlines(p_company => pg_temp.org('a'))), 'T-peagi,T-üle', 'deadlines filter by company');
select is(pg_temp.deadline_titles(public.admin_deadlines(p_site => pg_temp.site('b1'))), 'T-kriitiline,T-oluline', 'deadlines filter by site');
select is(pg_temp.deadline_titles(public.admin_deadlines(p_kind => 'deficiency', p_severity => 'critical')), 'T-kriitiline',
  'deadlines filter by item type and severity');
select is(pg_temp.deadline_titles(public.admin_deadlines(p_state => 'overdue')), 'T-kriitiline,T-üle', 'deadlines filter overdue');
select is(pg_temp.deadline_titles(public.admin_deadlines(p_from => current_date, p_to => current_date + 30)), 'T-peagi',
  'deadlines filter by period');

-- ===========================================================================
-- Mutations
-- ===========================================================================

select pg_temp.logout();
reset role;
create temporary table ids as select
  (select id from public.organisation_members where user_id = pg_temp.uid('a_viewer') and organisation_id = pg_temp.org('a')) as a_viewer,
  (select id from public.organisation_members where user_id = pg_temp.uid('a_owner') and organisation_id = pg_temp.org('a')) as a_owner,
  (select id from public.organisation_members where user_id = pg_temp.uid('multi') and organisation_id = pg_temp.org('b')) as multi_b;
grant select on ids to authenticated;

select pg_temp.login('platform');
select lives_ok($$ select public.admin_set_member_role((select a_viewer from ids), 'operator') $$, 'the admin changes a membership role');
select throws_ok($$ select public.admin_set_member_role((select a_owner from ids), 'viewer') $$, 'P0001', 'last_owner',
  'the last-owner rule still applies to the admin');
select lives_ok($$ select public.admin_remove_member((select multi_b from ids)) $$, 'the admin removes a membership');
select throws_ok($$ select public.admin_set_user_disabled(auth.uid(), true) $$, '42501', 'forbidden', 'the admin cannot disable themselves');
select lives_ok($$ select public.admin_set_user_disabled(pg_temp.uid('outsider'), true) $$, 'the admin disables an account');
select lives_ok($$ select public.admin_revoke_sessions(pg_temp.uid('a_owner')) $$, 'the admin revokes sessions');
select is(public.admin_password_reset_target(pg_temp.uid('outsider')), 'outsider@example.ee', 'a reset goes to the account''s own email');
select is(pg_temp.deadline_titles(public.admin_deadlines()), 'T-kriitiline,T-oluline,T-peagi,T-üle', 'reads are not audited, data unchanged');

select pg_temp.logout();
reset role;
select is((select role::text from public.organisation_members where id = (select a_viewer from ids)), 'operator', 'the role changed');
select is((select count(*)::int from public.organisation_members where id = (select multi_b from ids)), 0, 'the membership is gone');
select ok((select banned_until > now() + interval '99 years' from auth.users where id = pg_temp.uid('outsider')), 'the account is banned in Auth');
select is((select count(*)::int from auth.sessions where user_id in (pg_temp.uid('outsider'), pg_temp.uid('a_owner'))), 0,
  'disabling and revoking remove the Auth sessions');
select results_eq(
  $$ select action from private.admin_audit_log where admin_user_id = 'c0000000-0000-4000-8000-0000000000ad' order by id $$,
  $$ values ('membership_role_changed'), ('membership_removed'), ('account_disabled'), ('sessions_revoked'), ('password_reset_requested') $$,
  'every successful mutation is audited, refused ones are not'
);
select is_empty($$ select id from private.admin_audit_log where summary::text ~* '(@|password|token)' $$,
  'audit summaries hold no emails or credentials');

-- Re-enable, then deactivate company B: its items leave the deadline view unless asked for.
select pg_temp.login('platform');
select lives_ok($$ select public.admin_set_user_disabled(pg_temp.uid('outsider'), false) $$, 'the admin re-enables the account');
select pg_temp.logout();
reset role;
update public.organisations set deactivated_at = now() where id = pg_temp.org('b');
select pg_temp.login('platform');
select is(pg_temp.deadline_titles(public.admin_deadlines()), 'T-peagi,T-üle', 'deactivated companies are left out of deadlines');
select is(pg_temp.deadline_titles(public.admin_deadlines(p_include_deactivated => true)), 'T-kriitiline,T-oluline,T-peagi,T-üle',
  'deactivated companies can be included on request');

-- A deactivated admin row ends the access.
select pg_temp.logout();
reset role;
update private.platform_admins set active = false;
select pg_temp.login('platform');
select throws_ok($$ select public.admin_overview() $$, 'P0002', 'not_found', 'an inactive platform admin is refused');

select * from finish();
rollback;
