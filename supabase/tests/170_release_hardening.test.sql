-- Upload abuse limits (database-enforced, failed/abandoned attempts count, configurable)
-- and immediate loss of data access for revoked sessions and disabled accounts.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

select plan(18);

-- Small limits for the test (the live values are in private.upload_limits).
update private.upload_limits set per_user_hour = 3, per_user_day = 5, bytes_per_user_day = 1000, pending_per_user = 10, per_org_day = 6, bytes_per_org_day = 100000;

create function pg_temp.register(p_size int) returns void language sql as $$
  insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes)
  values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'photo', 'Foto', 'foto.jpg', 'image/jpeg', p_size)
$$;
grant execute on function pg_temp.register(int) to authenticated;

select pg_temp.login('a_operator');
select lives_ok($$ select pg_temp.register(10) $$, 'normal upload registration works');
select lives_ok($$ select pg_temp.register(10) $$, 'second');
select lives_ok($$ select pg_temp.register(10) $$, 'third (the hourly limit)');
select throws_ok($$ select pg_temp.register(10) $$, 'P0001', 'upload_rate_limited', 'the fourth within an hour is refused');

-- Deleting the pending rows does not reset the counter.
delete from public.documents where uploaded_by = auth.uid() and status = 'pending';
select throws_ok($$ select pg_temp.register(10) $$, 'P0001', 'upload_rate_limited', 'removing abandoned uploads does not reset the limit');

-- Another user of the same company has their own hourly allowance.
select pg_temp.login('a_admin');
select lives_ok($$ select pg_temp.register(10) $$, 'another user is not affected by the first user''s limit');
select throws_ok($$ select pg_temp.register(5000) $$, 'P0001', 'upload_rate_limited', 'daily byte limit per user');

-- Company-level daily limit (3 + 1 already registered; limit 6).
select pg_temp.login('a_owner');
select lives_ok($$ select pg_temp.register(10) $$, 'company still under its daily limit');
select lives_ok($$ select pg_temp.register(10) $$, 'company reaches its daily limit');
select throws_ok($$ select pg_temp.register(10) $$, 'P0001', 'upload_rate_limited', 'company daily limit applies across users');

-- Limits are configuration: raising them takes effect at once.
select pg_temp.logout();
reset role;
update private.upload_limits set per_org_day = 100;
select pg_temp.login('a_owner');
select lives_ok($$ select pg_temp.register(10) $$, 'raised limits apply without a deploy');
select throws_ok($$ select * from private.upload_limits $$, '42501', null, 'users cannot read or change the limits');

-- ===========================================================================
-- Sessions
-- ===========================================================================

select pg_temp.logout();
reset role;
insert into auth.sessions (id, user_id) values ('5e000000-0000-4000-8000-000000000001', pg_temp.uid('a_operator'));

create function pg_temp.login_session(p_name text, p_session uuid) returns void language plpgsql as $$
begin
  perform pg_temp.login(p_name);
  perform set_config('request.jwt.claims',
    (current_setting('request.jwt.claims')::jsonb || jsonb_build_object('session_id', p_session))::text, true);
end;
$$;
grant execute on function pg_temp.login_session(text, uuid) to authenticated;

select pg_temp.login_session('a_operator', '5e000000-0000-4000-8000-000000000001');
select ok((select count(*) from public.sites) > 0, 'a live session reads its company');
select lives_ok($$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description)
                   values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'Elus seanss') $$, 'and writes');

select pg_temp.logout();
reset role;
delete from auth.sessions where id = '5e000000-0000-4000-8000-000000000001';
select pg_temp.login_session('a_operator', '5e000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.sites), 0, 'a revoked session reads nothing, even with a still-valid token');
select throws_ok($$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description)
                   values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'Pärast tühistamist') $$,
  '42501', null, 'and cannot write');

select pg_temp.logout();
reset role;
insert into auth.sessions (id, user_id) values ('5e000000-0000-4000-8000-000000000002', pg_temp.uid('a_operator'));
update auth.users set banned_until = now() + interval '100 years' where id = pg_temp.uid('a_operator');
select pg_temp.login_session('a_operator', '5e000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.sites), 0, 'a disabled account reads nothing, even with a live session');
select pg_temp.logout();
reset role;
select is((select count(*)::int from private.upload_events where created_at < now() - interval '3 days'), 0, 'old upload counters are cleaned up daily')
  from cron.job where jobname = 'kaidly-upload-events-cleanup';

select * from finish();
rollback;
