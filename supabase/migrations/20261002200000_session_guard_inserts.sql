-- Revoked sessions / disabled accounts: the two write paths that don't go through
-- private.org_ids() — creating a company (create_organisation) and joining one
-- (accept_invitation) — also require a live session now. Everything else already does
-- (release_hardening). Maintenance without a session is unaffected.

create function private.require_live_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not private.session_active() then
    raise exception 'session_required' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.require_live_session() from public, anon, authenticated;

create trigger a_require_live_session
  before insert on public.organisations
  for each row execute function private.require_live_session();

create trigger a_require_live_session
  before insert on public.organisation_members
  for each row execute function private.require_live_session();
