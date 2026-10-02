-- Language preference (profiles.preferred_locale) and the change-history read model:
-- users change only their own language, only to a supported value; history is readable by
-- owners and admins of the same organisation only, never by operators, viewers, outsiders
-- or anon, and never contains invitation token hashes.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

select plan(14);

-- Language preference ---------------------------------------------------------

select pg_temp.login('a_viewer');
with u as (update public.profiles set preferred_locale = 'ru' where id = pg_temp.uid('a_viewer') returning 1)
select is(count(*)::int, 1, 'any user can set their own language (even a viewer)') from u;
select is((select preferred_locale from public.profiles where id = pg_temp.uid('a_viewer')), 'ru',
  'the language is stored on the profile');
select throws_ok($$ update public.profiles set preferred_locale = 'de' where id = pg_temp.uid('a_viewer') $$,
  '23514', null, 'only et, en and ru are accepted');
with u as (update public.profiles set preferred_locale = 'en' where id = pg_temp.uid('a_owner') returning 1)
select is(count(*)::int, 0, 'nobody can change another user''s language (even a co-member)') from u;
select is((select preferred_locale from public.profiles where id = pg_temp.uid('a_owner')), null,
  'the other user''s language is unchanged');
select throws_ok($$ update public.profiles set email = 'x@example.ee' where id = pg_temp.uid('a_viewer') $$,
  '42501', null, 'the language grant does not open other profile columns');
select pg_temp.logout();
select throws_ok($$ update public.profiles set preferred_locale = 'en' $$,
  '42501', null, 'anon cannot change any language');

-- Change history ----------------------------------------------------------------

-- Activity in both organisations (as postgres, so the triggers record it).
reset role;
update public.sites set name = 'A objekt 1 (uus nimi)' where id = pg_temp.site('a1');
update public.sites set name = 'B objekt 1 (uus nimi)' where id = pg_temp.site('b1');
insert into public.organisation_invitations (organisation_id, email, role, token_hash, invited_by, expires_at)
values (pg_temp.org('a'), 'uus@example.ee', 'viewer', extensions.digest('history-test', 'sha256'), pg_temp.uid('a_admin'), now() + interval '7 days');

select pg_temp.login('a_admin');
select isnt_empty($$ select 1 from public.activity_history where table_name = 'sites' and record_id = pg_temp.site('a1') $$,
  'an admin reads their organisation''s history');
select is_empty($$ select 1 from public.activity_history where organisation_id = pg_temp.org('b') or record_id = pg_temp.site('b1') $$,
  'an admin never sees another organisation''s history');
select is_empty($$ select 1 from public.activity_history where (coalesce(new_data, '{}') ? 'token_hash') or (coalesce(old_data, '{}') ? 'token_hash') $$,
  'history never contains invitation token hashes');
select pg_temp.login('a_owner');
select isnt_empty($$ select 1 from public.activity_history where organisation_id = pg_temp.org('a') $$,
  'an owner reads the history');
select pg_temp.login('a_operator');
select is_empty('select 1 from public.activity_history', 'operators cannot read history');
select pg_temp.login('multi'); -- operator in A, viewer in B
select is_empty('select 1 from public.activity_history', 'a member of two organisations without admin role reads none');
select pg_temp.logout();
select throws_ok('select 1 from public.activity_history', '42501', null, 'anon cannot read history');

select * from finish();
rollback;
