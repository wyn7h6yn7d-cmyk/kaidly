-- KAIDLY Phase 2: organisations and tenant access.
--
-- * org_role and the role helpers used by every RLS policy (private.org_ids).
-- * organisations, organisation_members, organisation_invitations.
-- * activity_history, written only by triggers.
-- * RPCs: create_organisation, create_invitation, revoke_invitation,
--   invitation_preview, accept_invitation.
--
-- See docs/DATABASE.md. Every table: RLS on, explicit grants, history trigger.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

create type public.org_role as enum ('owner', 'admin', 'operator', 'viewer');

create function private.role_rank(r public.org_role)
returns int
language sql
immutable
set search_path = ''
as $$
  select case r
    when 'owner' then 4
    when 'admin' then 3
    when 'operator' then 2
    when 'viewer' then 1
  end
$$;

-- ---------------------------------------------------------------------------
-- organisations
-- ---------------------------------------------------------------------------

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (char_length(name) between 1 and 200 and name = btrim(name)),
  -- Stable URL identifier: slugified name + random suffix, generated once and never
  -- changed. The random suffix means slugs can't be guessed or used to probe which
  -- organisations exist.
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  registry_code text
    check (char_length(registry_code) between 1 and 30 and registry_code = btrim(registry_code)),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organisations is 'Tenant. Every organisation-specific row belongs to exactly one.';

create trigger set_updated_at
  before update on public.organisations
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- organisation_members
-- ---------------------------------------------------------------------------

create table public.organisation_members (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_role not null,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, user_id)
);

create index organisation_members_user_id_idx on public.organisation_members (user_id);
create index organisation_members_invited_by_idx on public.organisation_members (invited_by);

create trigger set_updated_at
  before update on public.organisation_members
  for each row execute function private.set_updated_at();

create trigger prevent_organisation_change
  before update on public.organisation_members
  for each row execute function private.prevent_organisation_change();

-- ---------------------------------------------------------------------------
-- Role helpers (used by RLS policies)
-- ---------------------------------------------------------------------------

-- Organisations in which the current user has at least `min_role`.
-- security definer: reads organisation_members without recursing into its RLS.
-- Policies use it as `organisation_id in (select private.org_ids('admin'))`, which
-- Postgres evaluates once per statement.
create function private.org_ids(min_role public.org_role default 'viewer')
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organisation_id
    from public.organisation_members m
   where m.user_id = (select auth.uid())
     and private.role_rank(m.role) >= private.role_rank(min_role)
$$;

grant execute on function private.org_ids(public.org_role) to authenticated;

-- For use inside security definer functions.
create function private.has_org_role(org uuid, min_role public.org_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.org_ids(min_role) o where o = org)
$$;

-- Users who share at least one organisation with the current user.
create function private.co_member_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct m.user_id
    from public.organisation_members m
   where m.organisation_id in (select private.org_ids('viewer'))
$$;

grant execute on function private.co_member_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- Last owner protection
-- ---------------------------------------------------------------------------

create function private.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    -- The organisation itself is being deleted (cascade): nothing to protect.
    if not exists (select 1 from public.organisations where id = old.organisation_id) then
      return case when tg_op = 'DELETE' then old else new end;
    end if;

    -- Serialise concurrent ownership changes in the same organisation.
    perform 1 from public.organisations where id = old.organisation_id for update;

    if not exists (
      select 1
        from public.organisation_members
       where organisation_id = old.organisation_id
         and role = 'owner'
         and user_id <> old.user_id
    ) then
      raise exception 'last_owner'
        using errcode = 'P0001',
              detail = 'An organisation must always have at least one owner.';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger protect_last_owner
  before update or delete on public.organisation_members
  for each row execute function private.protect_last_owner();

-- ---------------------------------------------------------------------------
-- organisation_invitations
-- ---------------------------------------------------------------------------

create table public.organisation_invitations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  email text not null
    check (
      email = lower(btrim(email))
      and char_length(email) <= 254
      and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    ),
  role public.org_role not null,
  -- sha256 of the token. The plaintext token is returned once by create_invitation()
  -- and never stored.
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

comment on column public.organisation_invitations.token_hash is
  'sha256(token). The token itself is never stored.';

-- One live invitation per person per organisation; create_invitation() revokes
-- the previous one.
create unique index organisation_invitations_live_idx
  on public.organisation_invitations (organisation_id, email)
  where accepted_at is null and revoked_at is null;

create index organisation_invitations_invited_by_idx on public.organisation_invitations (invited_by);
create index organisation_invitations_accepted_by_idx on public.organisation_invitations (accepted_by);
create index organisation_invitations_revoked_by_idx on public.organisation_invitations (revoked_by);

create trigger prevent_organisation_change
  before update on public.organisation_invitations
  for each row execute function private.prevent_organisation_change();

-- ---------------------------------------------------------------------------
-- activity_history
-- ---------------------------------------------------------------------------

create table public.activity_history (
  id bigint generated always as identity primary key,
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  -- No foreign key: history must outlive deleted accounts.
  actor_id uuid,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index activity_history_org_created_idx
  on public.activity_history (organisation_id, created_at desc);
create index activity_history_record_idx
  on public.activity_history (table_name, record_id);

comment on table public.activity_history is
  'Append-only change history, written only by private.record_history().';

create function private.record_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
begin
  -- Secrets never enter history.
  if tg_op <> 'INSERT' then v_old := to_jsonb(old) - 'token_hash'; end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new) - 'token_hash'; end if;

  if tg_op = 'UPDATE' and (v_old - 'updated_at') = (v_new - 'updated_at') then
    return null;
  end if;

  v_row := coalesce(v_new, v_old);

  insert into public.activity_history
    (organisation_id, actor_id, table_name, record_id, action, old_data, new_data)
  values (
    (case when tg_table_name = 'organisations' then v_row ->> 'id'
          else v_row ->> 'organisation_id' end)::uuid,
    auth.uid(),
    tg_table_name,
    (v_row ->> 'id')::uuid,
    lower(tg_op),
    v_old,
    v_new
  );
  return null;
end;
$$;

create trigger record_history
  after insert or update on public.organisations
  for each row execute function private.record_history();

create trigger record_history
  after insert or update or delete on public.organisation_members
  for each row execute function private.record_history();

create trigger record_history
  after insert or update on public.organisation_invitations
  for each row execute function private.record_history();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.organisations enable row level security;
alter table public.organisation_members enable row level security;
alter table public.organisation_invitations enable row level security;
alter table public.activity_history enable row level security;

-- organisations: members read; only owners change settings. Created via RPC only.
create policy "members read their organisations" on public.organisations
  for select to authenticated
  using (id in (select private.org_ids('viewer')));

create policy "owners update organisation settings" on public.organisations
  for update to authenticated
  using (id in (select private.org_ids('owner')))
  with check (id in (select private.org_ids('owner')));

grant select on table public.organisations to authenticated;
grant update (name, registry_code) on table public.organisations to authenticated;

-- organisation_members: members see who is in their organisations. Admins manage
-- non-owner rows; only owners touch owner rows (using = old row, with check = new row,
-- so an admin can neither demote an owner nor promote anyone to owner).
create policy "members read memberships" on public.organisation_members
  for select to authenticated
  using (organisation_id in (select private.org_ids('viewer')));

create policy "admins change roles" on public.organisation_members
  for update to authenticated
  using (
    organisation_id in (select private.org_ids('admin'))
    and (role <> 'owner' or organisation_id in (select private.org_ids('owner')))
  )
  with check (
    organisation_id in (select private.org_ids('admin'))
    and (role <> 'owner' or organisation_id in (select private.org_ids('owner')))
  );

create policy "admins remove members, anyone leaves" on public.organisation_members
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or (
      organisation_id in (select private.org_ids('admin'))
      and (role <> 'owner' or organisation_id in (select private.org_ids('owner')))
    )
  );

grant select, delete on table public.organisation_members to authenticated;
grant update (role) on table public.organisation_members to authenticated;

-- organisation_invitations: admins see their organisation's invitations, without the
-- token hash. All writes go through RPCs.
create policy "admins read invitations" on public.organisation_invitations
  for select to authenticated
  using (organisation_id in (select private.org_ids('admin')));

grant select (
  id, organisation_id, email, role, invited_by, expires_at,
  accepted_at, accepted_by, revoked_at, revoked_by, created_at
) on table public.organisation_invitations to authenticated;

-- activity_history: admins read. Nobody writes through the API.
create policy "admins read history" on public.activity_history
  for select to authenticated
  using (organisation_id in (select private.org_ids('admin')));

grant select on table public.activity_history to authenticated;

-- profiles: also visible to people who share an organisation.
drop policy "users read own profile" on public.profiles;

create policy "users read own and co-member profiles" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or id in (select private.co_member_ids())
  );

-- ---------------------------------------------------------------------------
-- Slug helpers
-- ---------------------------------------------------------------------------

create function private.slugify(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      left(
        btrim(
          regexp_replace(
            translate(lower(coalesce(input, '')), 'õäöüšžåéèáàíóúñç', 'oaouszaeeaaiouunc'),
            '[^a-z0-9]+', '-', 'g'
          ),
          '-'
        ),
        40
      ),
      ''
    ),
    'org'
  )
$$;

create function private.random_suffix(len int)
returns text
language sql
volatile
set search_path = ''
as $$
  -- Unambiguous lowercase alphabet (no 0/o, 1/l/i).
  select string_agg(
           substr('abcdefghjkmnpqrstuvwxyz23456789', (get_byte(b, i) % 31) + 1, 1),
           '' order by i
         )
    from (select extensions.gen_random_bytes(len) as b) r,
         generate_series(0, len - 1) as i
$$;

-- ---------------------------------------------------------------------------
-- RPC: create_organisation
-- ---------------------------------------------------------------------------

create function public.create_organisation(p_name text, p_registry_code text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_code text := nullif(btrim(coalesce(p_registry_code, '')), '');
  v_slug text;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  for attempt in 1..5 loop
    v_slug := left(private.slugify(v_name), 40) || '-' || private.random_suffix(6);
    begin
      insert into public.organisations (name, slug, registry_code, created_by)
      values (v_name, v_slug, v_code, v_user)
      returning id into v_id;
      exit;
    exception when unique_violation then
      if attempt = 5 then raise; end if;
    end;
  end loop;

  insert into public.organisation_members (organisation_id, user_id, role)
  values (v_id, v_user, 'owner');

  return v_slug;
end;
$$;

grant execute on function public.create_organisation(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: invitations
-- ---------------------------------------------------------------------------

-- Hash used for token lookups. 43-character base64url tokens only; anything else
-- can't be a valid token and hashes to something that matches nothing.
create function private.invitation_token_hash(p_token text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select sha256(convert_to(coalesce(p_token, ''), 'UTF8'))
$$;

create function public.create_invitation(
  p_organisation_id uuid,
  p_email text,
  p_role public.org_role
)
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token text;
  v_id uuid;
  v_expires timestamptz;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Same error whether the organisation doesn't exist or the caller isn't an admin
  -- there, so this can't be used to probe organisation ids.
  if p_role is null
     or not private.has_org_role(p_organisation_id, 'admin')
     or (p_role = 'owner' and not private.has_org_role(p_organisation_id, 'owner')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if exists (
    select 1
      from public.organisation_members m
      join public.profiles p on p.id = m.user_id
     where m.organisation_id = p_organisation_id
       and lower(p.email) = v_email
  ) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  -- A new invitation replaces any live one for the same person.
  update public.organisation_invitations i
     set revoked_at = now(), revoked_by = v_user
   where i.organisation_id = p_organisation_id
     and i.email = v_email
     and i.accepted_at is null
     and i.revoked_at is null;

  -- 32 random bytes → 43-character base64url token.
  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), E'+/=\n', '-_');

  insert into public.organisation_invitations
    (organisation_id, email, role, token_hash, invited_by, expires_at)
  values
    (p_organisation_id, v_email, p_role, private.invitation_token_hash(v_token), v_user,
     now() + interval '7 days')
  returning id, organisation_invitations.expires_at into v_id, v_expires;

  return query select v_id, v_token, v_expires;
end;
$$;

grant execute on function public.create_invitation(uuid, text, public.org_role) to authenticated;

create function public.revoke_invitation(p_invitation_id uuid)
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

  update public.organisation_invitations i
     set revoked_at = now(), revoked_by = v_user
   where i.id = p_invitation_id
     and i.accepted_at is null
     and i.revoked_at is null
     and private.has_org_role(i.organisation_id, 'admin')
     and (i.role <> 'owner' or private.has_org_role(i.organisation_id, 'owner'));

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.revoke_invitation(uuid) to authenticated;

-- What the invite page may show. Organisation details are returned only for a live
-- (unexpired, unused, unrevoked) invitation; other states return just the status.
create function public.invitation_preview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_inv record;
  v_email text;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select i.organisation_id, i.email, i.role, i.expires_at, i.accepted_at, i.revoked_at,
         o.name as organisation_name, o.slug as organisation_slug
    into v_inv
    from public.organisation_invitations i
    join public.organisations o on o.id = i.organisation_id
   where i.token_hash = private.invitation_token_hash(p_token);

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
    'organisation_name', v_inv.organisation_name,
    'role', v_inv.role,
    'expires_at', v_inv.expires_at,
    'email_matches', v_email = v_inv.email,
    'already_member', exists (
      select 1 from public.organisation_members m
       where m.organisation_id = v_inv.organisation_id and m.user_id = v_user
    ),
    'organisation_slug', case
      when exists (
        select 1 from public.organisation_members m
         where m.organisation_id = v_inv.organisation_id and m.user_id = v_user
      ) then v_inv.organisation_slug
    end
  );
end;
$$;

grant execute on function public.invitation_preview(text) to authenticated;

create function public.accept_invitation(p_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_inv public.organisation_invitations%rowtype;
  v_email text;
  v_confirmed timestamptz;
  v_slug text;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Lock the invitation so two concurrent accepts can't both succeed.
  select * into v_inv
    from public.organisation_invitations
   where token_hash = private.invitation_token_hash(p_token)
   for update;

  if not found then
    raise exception 'invitation_invalid' using errcode = 'P0001';
  elsif v_inv.revoked_at is not null then
    raise exception 'invitation_revoked' using errcode = 'P0001';
  elsif v_inv.accepted_at is not null then
    raise exception 'invitation_used' using errcode = 'P0001';
  elsif v_inv.expires_at <= now() then
    raise exception 'invitation_expired' using errcode = 'P0001';
  end if;

  select lower(u.email), u.email_confirmed_at
    into v_email, v_confirmed
    from auth.users u
   where u.id = v_user;

  if v_confirmed is null then
    raise exception 'email_not_confirmed' using errcode = 'P0001';
  end if;

  if v_email is distinct from v_inv.email then
    raise exception 'invitation_email_mismatch' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.organisation_members
     where organisation_id = v_inv.organisation_id and user_id = v_user
  ) then
    raise exception 'invitation_already_member' using errcode = 'P0001';
  end if;

  insert into public.organisation_members (organisation_id, user_id, role, invited_by)
  values (v_inv.organisation_id, v_user, v_inv.role, v_inv.invited_by);

  update public.organisation_invitations
     set accepted_at = now(), accepted_by = v_user
   where id = v_inv.id;

  select slug into v_slug from public.organisations where id = v_inv.organisation_id;
  return v_slug;
end;
$$;

grant execute on function public.accept_invitation(text) to authenticated;
