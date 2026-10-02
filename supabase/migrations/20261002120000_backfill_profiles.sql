-- KAIDLY: give every existing auth user a profile.
--
-- Profiles are created by the on_auth_user_created trigger, which only fires for users
-- created after the foundation migration. A database that already had users when the
-- migrations were applied (e.g. the hosted development project) would leave them without
-- a profile — and memberships, invitations and records reference profiles, so their first
-- organisation would fail to create. Idempotent: only users without a profile are added.

insert into public.profiles (id, email, full_name)
select u.id, u.email, nullif(left(btrim(u.raw_user_meta_data ->> 'full_name'), 200), '')
  from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id);
