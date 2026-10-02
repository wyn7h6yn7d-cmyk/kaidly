-- KAIDLY company access: 14-day trial, manual full access, read-only expiry.
--
-- Commercial access belongs to the COMPANY (organisation), never to a user account, and is
-- separate from the lifecycle (deactivated_at):
--   trial       full access until trial_ends_at (exactly 14 × 24 h after creation)
--   active      full access granted manually by a KAIDLY platform admin (until a date or
--               indefinitely), e.g. after an invoice was paid outside the app
--   expired     trial/full access ended or expired manually → company is READ-ONLY
--   deactivated the existing lifecycle state (takes precedence)
-- The state is DERIVED from timestamps at query time (database now()), so expiry needs no
-- cron and takes effect at the exact timestamp.
--
-- Enforcement: private.org_ids(min_role) — used by every write policy and, through
-- has_org_role(), by every write RPC and insert trigger — now also requires
-- private.can_company_write() for any role above viewer. Reads are unchanged; the two
-- admin-level READ policies (change history, invitations) move to
-- private.org_ids_readable(), which ignores commercial access.
-- Owner lifecycle RPCs (delete/deactivate/reactivate) use private.is_owner() and stay
-- available, so an expired company can still be deactivated or (if empty) deleted.
-- Nothing is ever deleted automatically; 90 days after expiry a company is only flagged
-- for a platform-admin decision.

create table private.organisation_access (
  organisation_id uuid primary key references public.organisations (id) on delete cascade,
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default now() + interval '14 days',
  full_access_from timestamptz,
  full_access_until timestamptz,            -- null with full_access_from set = indefinite
  expired_manually_at timestamptz,
  activated_by uuid references auth.users (id) on delete set null,
  invoice_reference text check (invoice_reference is null or char_length(invoice_reference) <= 200),
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 2000),
  updated_at timestamptz not null default now(),
  check (trial_ends_at > trial_started_at),
  check (full_access_until is null or full_access_from is not null)
);

revoke all on table private.organisation_access from public, anon, authenticated;

-- Every company gets its access row (and its trial) when it is created.
create function private.organisation_access_on_create()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.organisation_access (organisation_id, trial_started_at, trial_ends_at)
  values (new.id, now(), now() + interval '14 days')
  on conflict (organisation_id) do nothing;
  return null;
end;
$$;

create trigger organisation_access_on_create
  after insert on public.organisations
  for each row execute function private.organisation_access_on_create();

-- Existing companies start a fresh 14-day trial now (nothing becomes read-only by surprise).
insert into private.organisation_access (organisation_id)
select id from public.organisations
on conflict (organisation_id) do nothing;

-- The derived state, in one place.
create function private.organisation_access_state(p_org uuid, p_at timestamptz default now())
returns table (status text, ends_at timestamptz, expired_since timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when o.deactivated_at is not null then 'deactivated'
      when a.organisation_id is null then 'expired'
      when a.expired_manually_at is not null then 'expired'
      when a.full_access_from is not null and a.full_access_from <= p_at
           and (a.full_access_until is null or a.full_access_until > p_at) then 'active'
      when p_at < a.trial_ends_at then 'trial'
      else 'expired'
    end,
    case
      when a.full_access_from is not null and a.expired_manually_at is null
           and (a.full_access_until is null or a.full_access_until > p_at) then a.full_access_until
      else a.trial_ends_at
    end,
    case
      when a.expired_manually_at is not null then a.expired_manually_at
      when a.full_access_from is not null and a.full_access_until is not null and a.full_access_until <= p_at
        then greatest(a.full_access_until, a.trial_ends_at)
      when a.full_access_from is null and a.trial_ends_at <= p_at then a.trial_ends_at
      else null
    end
  from public.organisations o
  left join private.organisation_access a on a.organisation_id = o.id
  where o.id = p_org
$$;

create function private.can_company_write(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select status in ('trial', 'active') from private.organisation_access_state(p_org)), false)
$$;

revoke all on function private.organisation_access_state(uuid, timestamptz), private.can_company_write(uuid),
  private.organisation_access_on_create() from public, anon, authenticated;

-- The central rule: above viewer, a company must be active in its lifecycle AND have
-- commercial write access.
create or replace function private.org_ids(min_role public.org_role default 'viewer')
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organisation_id
    from public.organisation_members m
    join public.organisations o on o.id = m.organisation_id
   where m.user_id = (select auth.uid())
     and private.role_rank(m.role) >= private.role_rank(min_role)
     and (min_role = 'viewer' or (o.deactivated_at is null and private.can_company_write(o.id)))
$$;

-- Role-scoped READS (not writes): commercial expiry never hides data.
create function private.org_ids_readable(min_role public.org_role default 'viewer')
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organisation_id
    from public.organisation_members m
    join public.organisations o on o.id = m.organisation_id
   where m.user_id = (select auth.uid())
     and private.role_rank(m.role) >= private.role_rank(min_role)
     and (min_role = 'viewer' or o.deactivated_at is null)
$$;
grant execute on function private.org_ids_readable(public.org_role) to authenticated;

drop policy "admins read history" on public.activity_history;
create policy "admins read history" on public.activity_history
  for select to authenticated
  using (organisation_id in (select private.org_ids_readable('admin')));

drop policy "admins read invitations" on public.organisation_invitations;
create policy "admins read invitations" on public.organisation_invitations
  for select to authenticated
  using (organisation_id in (select private.org_ids_readable('admin')));

-- For the app: the caller's view of one of their companies' access (no admin fields).
create function public.organisation_access(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not exists (select 1 from private.org_ids('viewer') o where o = p_org) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select jsonb_build_object(
           'status', s.status,
           'writable', s.status in ('trial', 'active'),
           'ends_at', s.ends_at,
           'expired_since', s.expired_since,
           'trial_ends_at', a.trial_ends_at,
           'indefinite', a.full_access_from is not null and a.full_access_until is null and a.expired_manually_at is null,
           'had_full_access', a.full_access_from is not null)
    into v
    from private.organisation_access_state(p_org) s
    left join private.organisation_access a on a.organisation_id = p_org;
  return v;
end;
$$;

revoke all on function public.organisation_access(uuid) from public;
grant execute on function public.organisation_access(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Platform admin
-- ---------------------------------------------------------------------------

create function private.access_snapshot(p_org uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'status', (select status from private.organisation_access_state(p_org)),
    'trial_ends_at', a.trial_ends_at,
    'full_access_from', a.full_access_from,
    'full_access_until', a.full_access_until,
    'expired_manually_at', a.expired_manually_at,
    'invoice_reference', a.invoice_reference)
  from private.organisation_access a where a.organisation_id = p_org
$$;
revoke all on function private.access_snapshot(uuid) from public, anon, authenticated;

create function private.require_access_row(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.organisations where id = p_org) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into private.organisation_access (organisation_id) values (p_org) on conflict do nothing;
end;
$$;
revoke all on function private.require_access_row(uuid) from public, anon, authenticated;

-- Full access until a date, or indefinitely (p_until null). Also restores access after a
-- manual expiry.
create function public.admin_set_full_access(p_org uuid, p_until timestamptz, p_invoice_reference text, p_notes text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  perform private.require_platform_admin();
  perform private.require_access_row(p_org);
  if p_until is not null and p_until <= now() then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  v_before := private.access_snapshot(p_org);
  update private.organisation_access
     set full_access_from = case when (select status from private.organisation_access_state(p_org)) = 'active'
                                 then full_access_from else now() end,
         full_access_until = p_until,
         expired_manually_at = null,
         activated_by = auth.uid(),
         invoice_reference = coalesce(nullif(btrim(p_invoice_reference), ''), invoice_reference),
         admin_notes = coalesce(nullif(btrim(p_notes), ''), admin_notes),
         updated_at = now()
   where organisation_id = p_org;
  perform private.admin_audit('full_access_set', 'company', p_org::text,
    jsonb_build_object('before', v_before, 'after', private.access_snapshot(p_org)));
end;
$$;

-- New trial end (later than the current one); the trial start is never changed.
create function public.admin_extend_trial(p_org uuid, p_trial_ends_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  perform private.require_platform_admin();
  perform private.require_access_row(p_org);
  if p_trial_ends_at <= now()
     or p_trial_ends_at <= (select trial_ends_at from private.organisation_access where organisation_id = p_org) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  v_before := private.access_snapshot(p_org);
  update private.organisation_access
     set trial_ends_at = p_trial_ends_at, expired_manually_at = null, updated_at = now()
   where organisation_id = p_org;
  perform private.admin_audit('trial_extended', 'company', p_org::text,
    jsonb_build_object('before', v_before, 'after', private.access_snapshot(p_org)));
end;
$$;

create function public.admin_expire_access(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  perform private.require_platform_admin();
  perform private.require_access_row(p_org);
  v_before := private.access_snapshot(p_org);
  update private.organisation_access set expired_manually_at = now(), updated_at = now() where organisation_id = p_org;
  perform private.admin_audit('access_expired', 'company', p_org::text,
    jsonb_build_object('before', v_before, 'after', private.access_snapshot(p_org)));
end;
$$;

create function public.admin_set_access_reference(p_org uuid, p_invoice_reference text, p_notes text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  perform private.require_platform_admin();
  perform private.require_access_row(p_org);
  v_before := private.access_snapshot(p_org);
  update private.organisation_access
     set invoice_reference = nullif(btrim(p_invoice_reference), ''), admin_notes = nullif(btrim(p_notes), ''), updated_at = now()
   where organisation_id = p_org;
  perform private.admin_audit('access_reference_changed', 'company', p_org::text,
    jsonb_build_object('before', v_before, 'after', private.access_snapshot(p_org)));
end;
$$;

-- Admin reads: access details for one company, and the access columns for the list.
create function public.admin_company_access(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  perform private.require_platform_admin();
  select jsonb_build_object(
           'status', s.status, 'ends_at', s.ends_at, 'expired_since', s.expired_since,
           'expired_90', s.expired_since is not null and s.expired_since <= now() - interval '90 days',
           'trial_started_at', a.trial_started_at, 'trial_ends_at', a.trial_ends_at,
           'full_access_from', a.full_access_from, 'full_access_until', a.full_access_until,
           'expired_manually_at', a.expired_manually_at,
           'activated_by', (select coalesce(nullif(p.full_name, ''), p.email) from public.profiles p where p.id = a.activated_by),
           'invoice_reference', a.invoice_reference, 'admin_notes', a.admin_notes)
    into v
    from private.organisation_access_state(p_org) s
    left join private.organisation_access a on a.organisation_id = p_org;
  if v is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return v;
end;
$$;

create function public.admin_access_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return (
    select jsonb_build_object(
      'trials', count(*) filter (where s.status = 'trial'),
      'trials_ending_7d', count(*) filter (where s.status = 'trial' and s.ends_at <= now() + interval '7 days'),
      'expired_trials', count(*) filter (where s.status = 'expired' and a.full_access_from is null),
      'active', count(*) filter (where s.status = 'active'),
      'expired', count(*) filter (where s.status = 'expired'),
      'expired_90', count(*) filter (where s.status = 'expired' and s.expired_since <= now() - interval '90 days'))
    from public.organisations o
    cross join lateral private.organisation_access_state(o.id) s
    left join private.organisation_access a on a.organisation_id = o.id);
end;
$$;

-- Company ids per access filter, for the admin list (trial, active, expired, deactivated,
-- ending_soon, expired_90) with each company's access columns.
create function public.admin_company_access_list(p_filter text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return coalesce((
    select jsonb_object_agg(o.id, jsonb_build_object('status', s.status, 'ends_at', s.ends_at, 'expired_since', s.expired_since))
      from public.organisations o
      cross join lateral private.organisation_access_state(o.id) s
     where p_filter is null
        or (p_filter in ('trial', 'active', 'expired', 'deactivated') and s.status = p_filter)
        or (p_filter = 'ending_soon' and s.status in ('trial', 'active') and s.ends_at <= now() + interval '7 days')
        or (p_filter = 'expired_90' and s.status = 'expired' and s.expired_since <= now() - interval '90 days')), '{}'::jsonb);
end;
$$;

revoke all on function public.admin_set_full_access(uuid, timestamptz, text, text), public.admin_extend_trial(uuid, timestamptz),
  public.admin_expire_access(uuid), public.admin_set_access_reference(uuid, text, text), public.admin_company_access(uuid),
  public.admin_access_overview(), public.admin_company_access_list(text) from public;
grant execute on function public.admin_set_full_access(uuid, timestamptz, text, text), public.admin_extend_trial(uuid, timestamptz),
  public.admin_expire_access(uuid), public.admin_set_access_reference(uuid, text, text), public.admin_company_access(uuid),
  public.admin_access_overview(), public.admin_company_access_list(text) to authenticated;

