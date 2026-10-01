-- KAIDLY foundation (Phase 1)
--
-- * Locks down default privileges: tables created later are not reachable by `anon`,
--   `authenticated` gets only what each migration grants explicitly, and functions are
--   not executable by anyone unless granted explicitly.
-- * `private` schema for helpers that must never be exposed through the API.
-- * Shared trigger functions used by every tenant table from Phase 2 on.
-- * `profiles`, one row per auth user, maintained by triggers on auth.users.
--
-- See docs/DATABASE.md §8.

-- ---------------------------------------------------------------------------
-- Default privileges
-- ---------------------------------------------------------------------------

-- Supabase grants anon full table access by default and relies on RLS alone.
-- KAIDLY has no anonymous data access at all, so anon gets nothing on new objects.
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon;
alter default privileges for role postgres in schema public
  revoke all on functions from anon;

-- This Supabase version grants `authenticated` no data privileges on new tables (each
-- migration grants exactly what a table needs), but does grant TRUNCATE, REFERENCES,
-- TRIGGER and MAINTAIN. TRUNCATE ignores RLS, so remove all four.
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables from authenticated;

-- Postgres lets PUBLIC execute every new function. Remove that, so every function
-- has to be granted to the role that needs it.
alter default privileges for role postgres
  revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- private schema
-- ---------------------------------------------------------------------------

create schema private;

comment on schema private is
  'Internal helpers for RLS and triggers. Not exposed through the Data API.';

-- RLS policies call private helpers as the querying role, so `authenticated`
-- needs to see the schema. Individual functions are still granted one by one.
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Shared trigger functions
-- ---------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function private.set_updated_at() is
  'BEFORE UPDATE trigger: maintains updated_at.';

-- Tenant data never moves between organisations.
create function private.prevent_organisation_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organisation_id is distinct from old.organisation_id then
    raise exception 'organisation_id cannot be changed'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function private.prevent_organisation_change() is
  'BEFORE UPDATE trigger for every tenant table: rejects changes to organisation_id.';

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Copied from auth.users by trigger so organisation members can see each other's
  -- email without access to the auth schema. Nullable only because auth.users.email
  -- is; KAIDLY uses email sign-in exclusively.
  email text,
  full_name text check (char_length(full_name) <= 200),
  phone text check (char_length(phone) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. Created and kept in sync by triggers on auth.users.';

alter table public.profiles enable row level security;

-- Phase 2 widens this to profiles of users who share an organisation.
create policy "users read own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "users update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Rows are created by trigger and removed with the auth user; email is managed by Auth.
-- Users may only change their name and phone.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, phone) on table public.profiles to authenticated;

create trigger set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- auth.users → profiles
-- ---------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(left(btrim(new.raw_user_meta_data ->> 'full_name'), 200), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set email = new.email
   where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.sync_profile_email();
