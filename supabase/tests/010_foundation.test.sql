-- Phase 1 foundation: profiles and shared triggers.

begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

-- ---------------------------------------------------------------------------
-- Fixture: two auth users
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'mari@example.ee',
   '{"full_name": "  Mari Maasikas  "}', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'juhan@example.ee',
   '{}', 'authenticated', 'authenticated');

-- ---------------------------------------------------------------------------
-- Triggers on auth.users
-- ---------------------------------------------------------------------------

select results_eq(
  $$ select email, full_name from public.profiles
      where id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values ('mari@example.ee'::text, 'Mari Maasikas'::text) $$,
  'sign-up creates a profile with email and trimmed full name'
);

select is(
  (select full_name from public.profiles
    where id = '22222222-2222-2222-2222-222222222222'),
  null,
  'missing full name is stored as null'
);

update auth.users set email = 'mari.uus@example.ee'
 where id = '11111111-1111-1111-1111-111111111111';

select is(
  (select email from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  'mari.uus@example.ee',
  'changing the auth email updates the profile'
);

-- ---------------------------------------------------------------------------
-- RLS as user 1
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select results_eq(
  'select id from public.profiles',
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid) $$,
  'a user sees only their own profile'
);

update public.profiles set full_name = 'Mari Mets'
 where id = '11111111-1111-1111-1111-111111111111';

select is(
  (select full_name from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  'Mari Mets',
  'a user can update their own name'
);

-- Updating another user's row silently affects zero rows under RLS.
update public.profiles set full_name = 'Hacked'
 where id = '22222222-2222-2222-2222-222222222222';

select throws_ok(
  $$ update public.profiles set email = 'x@example.ee'
      where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'a user cannot change the email column'
);

select throws_ok(
  $$ insert into public.profiles (id, email)
     values ('33333333-3333-3333-3333-333333333333', 'x@example.ee') $$,
  '42501', null,
  'a user cannot insert profiles'
);

select throws_ok(
  $$ delete from public.profiles $$,
  '42501', null,
  'a user cannot delete profiles'
);

select throws_ok(
  $$ update public.profiles set full_name = repeat('x', 201)
      where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'full name is limited to 200 characters'
);

reset role;

select is(
  (select full_name from public.profiles
    where id = '22222222-2222-2222-2222-222222222222'),
  null,
  'another user''s profile was not changed'
);

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select throws_ok(
  'select * from public.profiles',
  '42501', null,
  'anon cannot read profiles'
);

reset role;

-- ---------------------------------------------------------------------------
-- Shared trigger functions
-- ---------------------------------------------------------------------------

create temporary table probe (
  id int primary key,
  organisation_id uuid not null,
  updated_at timestamptz not null default '2000-01-01'
);
create trigger set_updated_at before update on probe
  for each row execute function private.set_updated_at();
create trigger prevent_organisation_change before update on probe
  for each row execute function private.prevent_organisation_change();

insert into probe (id, organisation_id)
values (1, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

update probe set id = 1 where id = 1;
select ok(
  (select updated_at > '2000-01-01' from probe),
  'set_updated_at refreshes updated_at'
);

select throws_ok(
  $$ update probe set organisation_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
  '23514', 'organisation_id cannot be changed',
  'prevent_organisation_change rejects moving a row to another organisation'
);

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

select has_schema('private', 'private schema exists');
select fk_ok('public', 'profiles', 'id', 'auth', 'users', 'id',
  'profiles.id references auth.users');

-- Deleting the auth user removes the profile.
delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
select is_empty(
  $$ select 1 from public.profiles
      where id = '22222222-2222-2222-2222-222222222222' $$,
  'deleting the auth user deletes the profile'
);

select ok(
  not has_function_privilege('authenticated',
    'private.handle_new_user()', 'execute'),
  'authenticated cannot call the new-user trigger function directly'
);

select * from finish();
rollback;
