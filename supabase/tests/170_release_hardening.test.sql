-- Upload abuse limits (only for stored files — users store none since document_links) and
-- immediate loss of data access for revoked sessions and disabled accounts.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

select plan(12);

-- Small limits for the test (the live values are in private.upload_limits).
update private.upload_limits set per_user_hour = 3, per_user_day = 5, bytes_per_user_day = 1000, pending_per_user = 10, per_org_day = 6, bytes_per_org_day = 100000;

-- Since migration document_links users register no files at all; the limits only ever
-- applied to stored files, so link records are never counted or limited.
create function pg_temp.add_links(p_n int) returns void language plpgsql as $$
begin
  for i in 1..p_n loop
    insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, external_url)
    values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'Juhend ' || i, 'https://example.com/juhend/' || i);
  end loop;
end; $$;
grant execute on function pg_temp.add_links(int) to authenticated;

select pg_temp.login('a_operator');
select throws_ok(
  $$ insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'Juhend', 'juhend.pdf', 'application/pdf', 10) $$,
  'P0001', 'file_uploads_disabled', 'a file can no longer be registered (no uploads at all)');
select lives_ok($$ select pg_temp.add_links(7) $$, 'link documents are not limited like uploads (7 > hourly and company limits)');
reset role;
select is((select count(*)::int from private.upload_events), 0, 'link documents are not counted as uploads');
select pg_temp.login('a_owner');
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
select throws_ok($$ select public.create_organisation('Keelatud OÜ', null) $$, '42501', 'session_required', 'a disabled account cannot create companies');
select pg_temp.logout();
reset role;
update auth.users set banned_until = null where id = pg_temp.uid('a_operator');
delete from auth.sessions where id = '5e000000-0000-4000-8000-000000000002';
select pg_temp.login_session('a_operator', '5e000000-0000-4000-8000-000000000002');
select throws_ok($$ select public.create_organisation('Tühistatud OÜ', null) $$, '42501', 'session_required', 'a revoked session cannot create companies either');
select pg_temp.logout();
reset role;
select is((select count(*)::int from private.upload_events where created_at < now() - interval '3 days'), 0, 'old upload counters are cleaned up daily')
  from cron.job where jobname = 'kaidly-upload-events-cleanup';

select * from finish();
rollback;
