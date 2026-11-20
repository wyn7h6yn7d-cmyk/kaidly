-- Two-step sign-in (TOTP) for KAIDLY platform administrators (owner decision 2026-11-20,
-- docs/MFA.md). Every user may switch TOTP on in their account; for a platform admin it is
-- required: the admin console and every admin_* RPC (all go through
-- private.is_platform_admin()) answer only to a session verified with the second step
-- (JWT claim aal = 'aal2').
--
-- private.platform_admins.mfa_required (default true, existing admins included) can be
-- switched off for one admin by the database owner only — the recovery path if an admin
-- loses their authenticator:
--   update private.platform_admins set mfa_required = false where user_id = '<id>';
-- and back on (true) once they have enrolled again.

alter table private.platform_admins add column mfa_required boolean not null default true;

comment on column private.platform_admins.mfa_required is
  'Admin console only with a two-step (aal2) session. Changed only by the database owner (recovery).';

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.platform_admins
     where user_id = (select auth.uid())
       and active
       and (not mfa_required or coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2')
  )
$$;

-- For the app: is the caller an admin who still has to complete the second step?
-- 'none' (not an admin), 'required' (admin, session not aal2), 'ok'. Only about the caller.
create function public.my_admin_mfa_status()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then 'none'
    when not exists (select 1 from private.platform_admins a where a.user_id = (select auth.uid()) and a.active) then 'none'
    when private.is_platform_admin() then 'ok'
    else 'required'
  end
$$;

revoke all on function public.my_admin_mfa_status() from public, anon;
grant execute on function public.my_admin_mfa_status() to authenticated;

-- ---------------------------------------------------------------------------
-- Everyone who switched two-step sign-in on: password alone opens no company data
-- ---------------------------------------------------------------------------

-- Same as in release_hardening, plus: a user with a verified authenticator counts as
-- signed in only with an aal2 session. private.session_active() is part of org_ids(),
-- org_ids_readable() and viewer_site_ids(), so every RLS policy and write path follows.
create or replace function private.session_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
      coalesce((select auth.jwt() ->> 'session_id'), '') = ''
      or exists (
        select 1 from auth.sessions s
         where s.id = ((select auth.jwt() ->> 'session_id'))::uuid
           and s.user_id = (select auth.uid())
           and (s.not_after is null or s.not_after > now())
      )
    )
    and not exists (select 1 from auth.users u where u.id = (select auth.uid()) and u.banned_until > now())
    and (
      coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified')
    )
$$;

-- For the app: does the caller still have to complete the second step?
create function public.my_mfa_pending()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2'
     and exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified')
$$;

revoke all on function public.my_mfa_pending() from public, anon;
grant execute on function public.my_mfa_pending() to authenticated;
