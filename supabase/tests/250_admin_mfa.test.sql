-- Two-step sign-in for platform admins (migration admin_mfa): without an aal2 session an
-- admin is not an admin for the database (console RPCs answer not_found), the status RPC
-- tells the app to ask for the second step, and the per-admin switch is the recovery path.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql

create function pg_temp.login_aal(p_name text, p_aal text) returns void language plpgsql as $$
declare v test_users%rowtype;
begin
  select * into strict v from test_users where name = p_name;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v.id, 'role', 'authenticated', 'email', v.email, 'aal', p_aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
grant execute on function pg_temp.login_aal(text, text) to authenticated;

insert into private.platform_admins (user_id) values (pg_temp.uid('outsider'));

select plan(19);

select is((select mfa_required from private.platform_admins where user_id = pg_temp.uid('outsider')), true,
  'new platform admins need the second step by default');

select pg_temp.login_aal('outsider', 'aal1');
select is(public.am_platform_admin(), false, 'password only (aal1): not an admin for the database');
select is(public.my_admin_mfa_status(), 'required', 'the app is told to ask for the second step');
select throws_ok($$ select public.admin_overview() $$, 'P0002', 'not_found', 'admin RPCs refuse an aal1 session');
select throws_ok($$ select * from public.admin_companies(null, 10, 0) $$, 'P0002', 'not_found', 'admin lists refuse an aal1 session');

select pg_temp.login_aal('outsider', 'aal2');
select is(public.am_platform_admin(), true, 'after the second step (aal2): admin');
select is(public.my_admin_mfa_status(), 'ok', 'status ok');
select lives_ok($$ select public.admin_overview() $$, 'admin RPCs work with aal2');

-- A missing claim is never treated as verified.
select pg_temp.login('outsider');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid('outsider'), 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
select is(public.am_platform_admin(), false, 'no aal claim: not an admin');

select pg_temp.login_aal('a_owner', 'aal1');
select is(public.my_admin_mfa_status(), 'none', 'a non-admin is simply none');
select pg_temp.login_aal('a_owner', 'aal2');
select is(public.my_admin_mfa_status(), 'none', 'a non-admin stays none with aal2');

-- Recovery: the database owner switches the requirement off for one admin.
reset role;
update private.platform_admins set mfa_required = false where user_id = pg_temp.uid('outsider');
select pg_temp.login_aal('outsider', 'aal1');
select is(public.am_platform_admin(), true, 'with the requirement off, aal1 is enough (recovery)');

-- Nobody can change the switch through the API.
select pg_temp.login_aal('outsider', 'aal2');
select throws_ok($$ update private.platform_admins set mfa_required = false $$, '42501', null, 'the switch is not reachable through the API');
select throws_ok($$ select * from private.platform_admins $$, '42501', null, 'the admin table is not readable');

-- Any user with a verified authenticator: password alone (aal1) opens no company data.
reset role;
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
values (gen_random_uuid(), pg_temp.uid('a_operator'), 'KAIDLY test', 'totp', 'verified', now(), now(), 'JBSWY3DPEHPK3PXP');
select pg_temp.login_aal('a_operator', 'aal1');
select is(public.my_mfa_pending(), true, 'the app is told to ask for the code');
select is((select count(*)::int from public.organisations), 0, 'aal1 with a verified authenticator: no company rows');
select throws_ok($$ insert into public.sites (organisation_id, name) values (pg_temp.org('a'), 'X') $$, '42501', null, 'and no writes');
select pg_temp.login_aal('a_operator', 'aal2');
select is((select count(*)::int from public.organisations where id = pg_temp.org('a')), 1, 'aal2: the company is back');
select pg_temp.login_aal('a_admin', 'aal1');
select is((select count(*)::int from public.organisations where id = pg_temp.org('a')), 1, 'users without an authenticator are unaffected');

select * from finish();
rollback;
