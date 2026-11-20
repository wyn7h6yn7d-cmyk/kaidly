-- Objekti vaataja (site viewer) — owner decision 2026-11-20, docs/SITE_VIEWERS.md.
--
-- A read-only person (e.g. the owner of a site or the board of an apartment association)
-- invited by a company owner/admin to one or more specific SITES. Not a company member:
-- no organisation_members row, no access to other sites, company settings, members,
-- invitations, notifications or company-level documents.
--
-- * public.site_viewers                 active/revoked grants (user × site); rows are never
--                                       deleted, revoking keeps a trace.
-- * public.site_viewer_invitations      link invitations (token hash only), 7 days.
-- * public.site_viewer_invitation_sites the sites one invitation covers.
-- * private.plan_settings               site_viewers_count_as_users (default false) —
--                                       mirrored in lib/plans.ts, kept equal by a unit test.
-- * private.viewer_site_ids()           the caller's sites: active grant, live session,
--                                       company not deactivated AND commercially active
--                                       (trial/paid) — an unpaid or inactive company shows
--                                       its viewers nothing (owner decision).
-- * SELECT-only RLS policies on sites, installations, plan, log, deficiencies and the
--   site's document LINKS. No insert/update/delete policy for viewers anywhere; every
--   write RPC requires company membership.

-- ---------------------------------------------------------------------------
-- Configuration
-- ---------------------------------------------------------------------------

create table private.plan_settings (
  id boolean primary key default true check (id),
  site_viewers_count_as_users boolean not null default false
);
revoke all on table private.plan_settings from public, anon, authenticated;
insert into private.plan_settings (id, site_viewers_count_as_users) values (true, false);

comment on table private.plan_settings is
  'Plan rules that are configuration, not per company. Mirrored in lib/plans.ts (unit test).';

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.site_viewers (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete restrict,
  site_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  foreign key (site_id, organisation_id) references public.sites (id, organisation_id) on delete restrict
);
alter table public.site_viewers enable row level security;

create unique index site_viewers_active_idx on public.site_viewers (site_id, user_id) where revoked_at is null;
create index site_viewers_user_idx on public.site_viewers (user_id) where revoked_at is null;
create index site_viewers_org_idx on public.site_viewers (organisation_id, site_id);
create index site_viewers_invited_by_idx on public.site_viewers (invited_by);
create index site_viewers_revoked_by_idx on public.site_viewers (revoked_by);

create table public.site_viewer_invitations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  email text not null
    check (
      email = lower(btrim(email))
      and char_length(email) <= 254
      and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    ),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  invited_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (not (accepted_at is not null and revoked_at is not null)),
  check (expires_at > created_at)
);
alter table public.site_viewer_invitations enable row level security;

create unique index site_viewer_invitations_live_idx
  on public.site_viewer_invitations (organisation_id, email)
  where accepted_at is null and revoked_at is null;
create index site_viewer_invitations_invited_by_idx on public.site_viewer_invitations (invited_by);
create index site_viewer_invitations_accepted_by_idx on public.site_viewer_invitations (accepted_by);
create index site_viewer_invitations_revoked_by_idx on public.site_viewer_invitations (revoked_by);

create table public.site_viewer_invitation_sites (
  invitation_id uuid not null references public.site_viewer_invitations (id) on delete cascade,
  organisation_id uuid not null,
  site_id uuid not null,
  primary key (invitation_id, site_id),
  foreign key (site_id, organisation_id) references public.sites (id, organisation_id) on delete restrict
);
alter table public.site_viewer_invitation_sites enable row level security;
create index site_viewer_invitation_sites_site_idx on public.site_viewer_invitation_sites (site_id, organisation_id);

-- Company and site never change on these rows.
create trigger prevent_organisation_change
  before update on public.site_viewers
  for each row execute function private.prevent_organisation_change();
create trigger prevent_organisation_change
  before update on public.site_viewer_invitations
  for each row execute function private.prevent_organisation_change();

-- ---------------------------------------------------------------------------
-- Access helper
-- ---------------------------------------------------------------------------

create function private.viewer_site_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select v.site_id
    from public.site_viewers v
    join public.organisations o on o.id = v.organisation_id
   where v.user_id = (select auth.uid())
     and v.revoked_at is null
     and (select private.session_active())
     and o.deactivated_at is null
     and private.can_company_write(o.id)
$$;
revoke all on function private.viewer_site_ids() from public, anon;
grant execute on function private.viewer_site_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: read-only access for viewers (no write policies for them anywhere)
-- ---------------------------------------------------------------------------

create policy "site viewers read their sites" on public.sites
  for select to authenticated
  using (id in (select private.viewer_site_ids()));

create policy "site viewers read installations" on public.electrical_installations
  for select to authenticated
  using (site_id in (select private.viewer_site_ids()));

create policy "site viewers read the operating plan" on public.scheduled_activities
  for select to authenticated
  using (site_id in (select private.viewer_site_ids()));

create policy "site viewers read the operating log" on public.log_entries
  for select to authenticated
  using (site_id in (select private.viewer_site_ids()));

create policy "site viewers read deficiencies" on public.deficiencies
  for select to authenticated
  using (site_id in (select private.viewer_site_ids()));

-- Only document LINKS of the site and its installations (no company-level documents, no
-- stored files, nothing archived).
create policy "site viewers read document links" on public.documents
  for select to authenticated
  using (
    site_id in (select private.viewer_site_ids())
    and external_url is not null
    and archived_at is null
  );

-- Grants and invitations: company owners/admins see them (also while read-only); a viewer
-- sees only their own grants. All changes go through the RPCs below.
create policy "admins and the viewer read grants" on public.site_viewers
  for select to authenticated
  using (
    organisation_id in (select private.org_ids_readable('admin'))
    or user_id = (select auth.uid())
  );

create policy "admins read viewer invitations" on public.site_viewer_invitations
  for select to authenticated
  using (organisation_id in (select private.org_ids_readable('admin')));

create policy "admins read viewer invitation sites" on public.site_viewer_invitation_sites
  for select to authenticated
  using (organisation_id in (select private.org_ids_readable('admin')));

grant select (id, organisation_id, site_id, user_id, invited_by, created_at, revoked_at, revoked_by)
  on table public.site_viewers to authenticated;
grant select (id, organisation_id, email, invited_by, expires_at, accepted_at, revoked_at, created_at)
  on table public.site_viewer_invitations to authenticated;
grant select (invitation_id, organisation_id, site_id) on table public.site_viewer_invitation_sites to authenticated;

-- ---------------------------------------------------------------------------
-- Seats: viewers count only when the configuration says so
-- ---------------------------------------------------------------------------

create or replace function private.seats_used(p_org uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from public.organisation_members m where m.organisation_id = p_org)::integer
       + (select count(*) from public.organisation_invitations i
           where i.organisation_id = p_org and i.accepted_at is null and i.revoked_at is null and i.expires_at > now())::integer
       + case when (select s.site_viewers_count_as_users from private.plan_settings s) then
           (select count(distinct v.user_id) from public.site_viewers v
             where v.organisation_id = p_org and v.revoked_at is null
               and not exists (select 1 from public.organisation_members m
                                where m.organisation_id = p_org and m.user_id = v.user_id))::integer
           + (select count(*) from public.site_viewer_invitations i
               where i.organisation_id = p_org and i.accepted_at is null and i.revoked_at is null and i.expires_at > now())::integer
         else 0 end
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Owner/admin of a writable company invites one e-mail address to 1–50 of its sites.
-- Returns the plaintext token once (the link); only its hash is stored.
create function public.create_site_viewer_invitation(p_organisation_id uuid, p_email text, p_site_ids uuid[])
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_sites uuid[] := array(select distinct s from unnest(coalesce(p_site_ids, '{}'::uuid[])) s where s is not null);
  v_token text;
  v_id uuid;
  v_expires timestamptz;
  v_access private.organisation_access;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not private.has_org_role(p_organisation_id, 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v_email) > 254 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if cardinality(v_sites) = 0 or cardinality(v_sites) > 50
     or (select count(*) from public.sites s where s.organisation_id = p_organisation_id and s.id = any (v_sites)) <> cardinality(v_sites) then
    raise exception 'invalid_sites' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.organisation_members m join public.profiles p on p.id = m.user_id
     where m.organisation_id = p_organisation_id and lower(p.email) = v_email
  ) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  -- A new invitation replaces any live one for the same person in this company.
  update public.site_viewer_invitations i
     set revoked_at = now(), revoked_by = v_user
   where i.organisation_id = p_organisation_id and i.email = v_email
     and i.accepted_at is null and i.revoked_at is null;

  if (select s.site_viewers_count_as_users from private.plan_settings s) then
    v_access := private.lock_company_limits(p_organisation_id);
    if v_access.user_limit is not null and private.seats_used(p_organisation_id) + 1 > v_access.user_limit then
      raise exception 'plan_user_limit' using errcode = 'P0001';
    end if;
  end if;

  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), E'+/=\n', '-_');
  insert into public.site_viewer_invitations (organisation_id, email, token_hash, invited_by, expires_at)
  values (p_organisation_id, v_email, private.invitation_token_hash(v_token), v_user, now() + interval '7 days')
  returning id, site_viewer_invitations.expires_at into v_id, v_expires;

  insert into public.site_viewer_invitation_sites (invitation_id, organisation_id, site_id)
  select v_id, p_organisation_id, s from unnest(v_sites) s;

  return query select v_id, v_token, v_expires;
end;
$$;

-- What the acceptance page may show: details only for a live invitation.
create function public.site_viewer_invitation_preview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_inv public.site_viewer_invitations%rowtype;
  v_email text;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_inv from public.site_viewer_invitations where token_hash = private.invitation_token_hash(p_token);
  if not found then
    return jsonb_build_object('status', 'invalid');
  elsif v_inv.revoked_at is not null then
    return jsonb_build_object('status', 'revoked');
  elsif v_inv.accepted_at is not null then
    return jsonb_build_object('status', 'used');
  elsif v_inv.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_user;
  return jsonb_build_object(
    'status', 'valid',
    'organisation_name', (select o.name from public.organisations o where o.id = v_inv.organisation_id),
    'sites', (select coalesce(jsonb_agg(s.name order by s.name, s.id), '[]'::jsonb)
                from public.site_viewer_invitation_sites x join public.sites s on s.id = x.site_id
               where x.invitation_id = v_inv.id),
    'expires_at', v_inv.expires_at,
    'email_matches', v_email = v_inv.email
  );
end;
$$;

-- The invited person (same confirmed e-mail, live session) accepts: one grant per site.
create function public.accept_site_viewer_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_inv public.site_viewer_invitations%rowtype;
  v_email text;
  v_confirmed timestamptz;
  v_first uuid;
begin
  if v_user is null or not private.session_active() then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_inv from public.site_viewer_invitations
   where token_hash = private.invitation_token_hash(p_token) for update;
  if not found then
    raise exception 'invitation_invalid' using errcode = 'P0001';
  elsif v_inv.revoked_at is not null then
    raise exception 'invitation_revoked' using errcode = 'P0001';
  elsif v_inv.accepted_at is not null then
    raise exception 'invitation_used' using errcode = 'P0001';
  elsif v_inv.expires_at <= now() then
    raise exception 'invitation_expired' using errcode = 'P0001';
  end if;
  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = v_user;
  if v_confirmed is null then
    raise exception 'email_not_confirmed' using errcode = 'P0001';
  end if;
  if v_email is distinct from v_inv.email then
    raise exception 'invitation_email_mismatch' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.organisations o where o.id = v_inv.organisation_id and o.deactivated_at is not null) then
    raise exception 'organisation_deactivated' using errcode = 'P0001';
  end if;

  insert into public.site_viewers (organisation_id, site_id, user_id, invited_by)
  select x.organisation_id, x.site_id, v_user, v_inv.invited_by
    from public.site_viewer_invitation_sites x
   where x.invitation_id = v_inv.id
     and not exists (select 1 from public.site_viewers v
                      where v.site_id = x.site_id and v.user_id = v_user and v.revoked_at is null);

  update public.site_viewer_invitations set accepted_at = now(), accepted_by = v_user where id = v_inv.id;

  select x.site_id into v_first from public.site_viewer_invitation_sites x
    join public.sites s on s.id = x.site_id
   where x.invitation_id = v_inv.id order by s.name, s.id limit 1;
  return v_first;
end;
$$;

-- Owner/admin removes a viewer's access to a site; effective immediately (RLS rechecks
-- every query). The row stays as a trace.
create function public.revoke_site_viewer(p_viewer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  update public.site_viewers v
     set revoked_at = now(), revoked_by = v_user
   where v.id = p_viewer_id
     and v.revoked_at is null
     and private.has_org_role(v.organisation_id, 'admin');
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.revoke_site_viewer_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  update public.site_viewer_invitations i
     set revoked_at = now(), revoked_by = v_user
   where i.id = p_invitation_id
     and i.accepted_at is null and i.revoked_at is null
     and private.has_org_role(i.organisation_id, 'admin');
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- For owners/admins on a site page: active viewers (name, e-mail) and live invitations of
-- that site. Viewers are not company members, so their profiles are not readable directly.
create function public.site_viewers_overview(p_site_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select s.organisation_id into v_org from public.sites s where s.id = p_site_id;
  if v_org is null or v_org not in (select private.org_ids_readable('admin')) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'viewers', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', v.id, 'name', p.full_name, 'email', p.email, 'since', v.created_at
                 ) order by lower(coalesce(p.full_name, p.email)), v.id), '[]'::jsonb)
                  from public.site_viewers v join public.profiles p on p.id = v.user_id
                 where v.site_id = p_site_id and v.revoked_at is null),
    'invitations', (select coalesce(jsonb_agg(jsonb_build_object(
                       'id', i.id, 'email', i.email, 'expires_at', i.expires_at
                     ) order by i.created_at, i.id), '[]'::jsonb)
                      from public.site_viewer_invitations i
                      join public.site_viewer_invitation_sites x on x.invitation_id = i.id
                     where x.site_id = p_site_id and i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
  );
end;
$$;

-- For the viewer: their companies and sites (only names and ids).
create function public.my_site_access()
returns table (organisation_id uuid, organisation_name text, site_id uuid, site_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.name, s.id, s.name
    from public.sites s
    join public.organisations o on o.id = s.organisation_id
   where s.id in (select private.viewer_site_ids())
   order by o.name, o.id, s.name, s.id
$$;

revoke all on function public.create_site_viewer_invitation(uuid, text, uuid[]), public.site_viewer_invitation_preview(text),
  public.accept_site_viewer_invitation(text), public.revoke_site_viewer(uuid), public.revoke_site_viewer_invitation(uuid),
  public.site_viewers_overview(uuid), public.my_site_access() from public, anon;
grant execute on function public.create_site_viewer_invitation(uuid, text, uuid[]), public.site_viewer_invitation_preview(text),
  public.accept_site_viewer_invitation(text), public.revoke_site_viewer(uuid), public.revoke_site_viewer_invitation(uuid),
  public.site_viewers_overview(uuid), public.my_site_access() to authenticated;
