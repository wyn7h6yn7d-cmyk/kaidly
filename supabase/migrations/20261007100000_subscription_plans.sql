-- KAIDLY launch pricing: plans with usage limits on top of the existing company access
-- (docs/SUBSCRIPTIONS.md). No second access system:
--
-- * private.organisation_access (one row per company) gains the plan, its label, the
--   agreed monthly price and the two limits. Paid period = the existing full access
--   (full_access_from / full_access_until); read-only expiry, trial and deactivation are
--   unchanged and still derived by private.organisation_access_state().
-- * Plans differ only by limits: total users (members of every role + pending
--   invitations) and active (not archived) electrical installations — never by features.
--   The 14-day trial has every feature with trial limits of 1 user (the owner) and 5 active
--   installations. A null limit means "no limit": every company that existed before this
--   migration keeps working exactly as before until a platform admin assigns a plan.
-- * Limits are enforced in the database (BEFORE triggers, serialised per company by a row
--   lock on its access row), so no client, forged request or race can exceed them. Only
--   actions that would exceed a limit are refused; nothing existing is touched.
-- * Platform admin manages plans and paid periods (admin_set_subscription, with a
--   preview); every change is in the admin audit log. Customers see their plan and usage
--   (organisation_plan), never the price notes or admin fields.

-- ---------------------------------------------------------------------------
-- Plan catalogue (fixed plans; prices in EUR per month, VAT excluded)
-- ---------------------------------------------------------------------------

create table private.subscription_plans (
  plan text primary key check (plan in ('start', 'team', 'pro', 'business')),
  monthly_price numeric(10, 2) not null check (monthly_price >= 0),
  user_limit integer not null check (user_limit >= 1),
  installation_limit integer not null check (installation_limit >= 1),
  sort smallint not null unique
);
revoke all on table private.subscription_plans from public, anon, authenticated;

insert into private.subscription_plans (plan, monthly_price, user_limit, installation_limit, sort) values
  ('start', 19, 1, 5, 1),
  ('team', 29, 3, 10, 2),
  ('pro', 39, 5, 25, 3),
  ('business', 89, 15, 100, 4);

alter table private.organisation_access
  add column plan text check (plan in ('start', 'team', 'pro', 'business', 'custom')),
  add column plan_label text check (plan_label is null or char_length(plan_label) between 1 and 60),
  add column monthly_price numeric(10, 2) check (monthly_price is null or monthly_price between 0 and 100000),
  add column user_limit integer check (user_limit is null or user_limit between 1 and 10000),
  add column installation_limit integer check (installation_limit is null or installation_limit between 0 and 100000),
  add constraint organisation_access_custom_label check (plan is distinct from 'custom' or plan_label is not null);

comment on column private.organisation_access.user_limit is
  'Total users (members of every role + pending invitations); null = no limit (trial, legacy).';
comment on column private.organisation_access.installation_limit is
  'Active (not archived) electrical installations; null = no limit (trial, legacy).';

-- ---------------------------------------------------------------------------
-- Trial limits for new companies
-- ---------------------------------------------------------------------------

-- A company created by a signed-in user (create_organisation) starts its 14-day trial with
-- 1 user and 5 active installations; assigning any plan replaces these limits. Companies
-- created by the database owner (seed, test fixtures, support) get no limits.
create or replace function private.organisation_access_on_create()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.organisation_access (organisation_id, trial_started_at, trial_ends_at, user_limit, installation_limit)
  values (new.id, now(), now() + interval '14 days',
          case when auth.uid() is not null then 1 end,
          case when auth.uid() is not null then 5 end)
  on conflict (organisation_id) do nothing;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Usage
-- ---------------------------------------------------------------------------

-- Seats: every member (owner, admin, operator, viewer) plus every live invitation.
create function private.seats_used(p_org uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from public.organisation_members m where m.organisation_id = p_org)::integer
       + (select count(*) from public.organisation_invitations i
           where i.organisation_id = p_org and i.accepted_at is null and i.revoked_at is null and i.expires_at > now())::integer
$$;

create function private.installations_active(p_org uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.electrical_installations i where i.organisation_id = p_org and i.archived_at is null
$$;

-- Locks the company's access row: concurrent inserts for the same company are serialised,
-- so two requests can never both take the last seat or installation.
create function private.lock_company_limits(p_org uuid)
returns private.organisation_access
language sql
security definer
set search_path = ''
as $$
  select * from private.organisation_access where organisation_id = p_org for update
$$;

-- ---------------------------------------------------------------------------
-- Enforcement
-- ---------------------------------------------------------------------------

-- A new invitation reserves a seat.
create function private.invitation_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_access private.organisation_access;
begin
  v_access := private.lock_company_limits(new.organisation_id);
  if v_access.user_limit is not null and private.seats_used(new.organisation_id) + 1 > v_access.user_limit then
    raise exception 'plan_user_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger invitation_seat_limit
  before insert on public.organisation_invitations
  for each row execute function private.invitation_seat_limit();

-- A new member never takes the company over its user limit (accepting an invitation after
-- the limit was lowered, or any other insert path). Pending invitations already hold their
-- seat, so only members are counted here.
create or replace function private.organisation_member_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_access private.organisation_access;
begin
  if exists (select 1 from public.organisations where id = new.organisation_id and deactivated_at is not null) then
    raise exception 'organisation_deactivated' using errcode = 'P0001';
  end if;
  v_access := private.lock_company_limits(new.organisation_id);
  if v_access.user_limit is not null
     and (select count(*) from public.organisation_members m where m.organisation_id = new.organisation_id) + 1 > v_access.user_limit then
    raise exception 'plan_user_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Active installations: a new one, or an archived one brought back.
create function private.installation_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_access private.organisation_access;
begin
  if new.archived_at is not null or (tg_op = 'UPDATE' and old.archived_at is null) then
    return new;
  end if;
  -- Members only, before anything that could describe another tenant (100_cross_tenant_oracles).
  if auth.uid() is not null and not private.has_org_role(new.organisation_id, 'viewer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_access := private.lock_company_limits(new.organisation_id);
  if v_access.installation_limit is not null
     and private.installations_active(new.organisation_id) + 1 > v_access.installation_limit then
    raise exception 'plan_installation_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger installation_plan_limit
  before insert or update of archived_at on public.electrical_installations
  for each row execute function private.installation_plan_limit();

-- ---------------------------------------------------------------------------
-- Dates: calendar months and the Tallinn "valid until" day
-- ---------------------------------------------------------------------------

-- Adds whole months. A month-end stays a month-end (31.12 + 6 = 30.06, 30.11 + 1 = 31.12);
-- any other day keeps its day number, clamped to the target month (31.01 + 1 = 28/29.02).
create function private.add_months(p_date date, p_months integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select case
    when p_date = (date_trunc('month', p_date) + interval '1 month - 1 day')::date
      then (date_trunc('month', p_date) + make_interval(months => p_months + 1) - interval '1 day')::date
    else (p_date + make_interval(months => p_months))::date
  end
$$;

-- "Kehtib kuni D" = access until the end of D in Tallinn.
create function private.until_from_day(p_day date)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select ((p_day + 1)::timestamp at time zone 'Europe/Tallinn')
$$;

create function private.day_from_until(p_until timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$
  select ((p_until at time zone 'Europe/Tallinn') - interval '1 microsecond')::date
$$;

-- ---------------------------------------------------------------------------
-- Snapshot (audit) — now with the plan
-- ---------------------------------------------------------------------------

create or replace function private.access_snapshot(p_org uuid)
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
    'paid_until', case when a.full_access_until is not null then private.day_from_until(a.full_access_until) end,
    'expired_manually_at', a.expired_manually_at,
    'invoice_reference', a.invoice_reference,
    'plan', a.plan,
    'plan_label', a.plan_label,
    'monthly_price', a.monthly_price,
    'user_limit', a.user_limit,
    'installation_limit', a.installation_limit)
  from private.organisation_access a where a.organisation_id = p_org
$$;

-- ---------------------------------------------------------------------------
-- Subscription: one calculation for the preview and for saving
-- ---------------------------------------------------------------------------

-- p_months (1, 3, 6, 12, 24) extends; p_paid_until sets the exact last day; neither keeps
-- the current period (plan or limit change only). An active subscription is extended from
-- its current paid-until day; otherwise the new period starts on p_start (default: today).
create function private.subscription_compute(
  p_org uuid, p_plan text, p_label text, p_price numeric, p_user_limit integer, p_installation_limit integer,
  p_months integer, p_paid_until date, p_start date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_access private.organisation_access;
  v_fixed private.subscription_plans;
  v_status text;
  v_today date := private.business_date();
  v_active boolean;
  v_current_day date;
  v_start date;
  v_from timestamptz;
  v_until timestamptz;
  v_mode text;
  v_label text;
  v_price numeric;
  v_users integer;
  v_installations integer;
begin
  select * into v_access from private.organisation_access where organisation_id = p_org;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_status := (select status from private.organisation_access_state(p_org));
  v_active := v_status = 'active';
  v_current_day := case when v_access.full_access_until is not null then private.day_from_until(v_access.full_access_until) end;

  if p_plan in ('start', 'team', 'pro', 'business') then
    select * into v_fixed from private.subscription_plans where plan = p_plan;
    v_label := null;
    v_price := v_fixed.monthly_price;
    v_users := v_fixed.user_limit;
    v_installations := v_fixed.installation_limit;
  elsif p_plan = 'custom' then
    v_label := nullif(btrim(coalesce(p_label, '')), '');
    if v_label is null or char_length(v_label) > 60
       or p_price is null or p_price < 0 or p_price > 100000
       or p_user_limit is null or p_user_limit < 1 or p_user_limit > 10000
       or p_installation_limit is null or p_installation_limit < 0 or p_installation_limit > 100000 then
      raise exception 'invalid_input' using errcode = '22023';
    end if;
    v_price := round(p_price, 2);
    v_users := p_user_limit;
    v_installations := p_installation_limit;
  else
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  if p_months is not null and p_paid_until is not null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  v_from := v_access.full_access_from;
  v_until := v_access.full_access_until;
  if p_months is not null then
    if p_months not in (1, 3, 6, 12, 24) then
      raise exception 'invalid_input' using errcode = '22023';
    end if;
    if v_active and v_current_day is not null then
      v_mode := 'extend';
      v_until := private.until_from_day(private.add_months(v_current_day, p_months));
    elsif v_active then
      -- Indefinite full access (legacy): the paid period starts now.
      v_mode := 'activate';
      v_start := v_today;
      v_until := private.until_from_day(private.add_months(v_today, p_months));
    else
      v_mode := 'activate';
      v_start := coalesce(p_start, v_today);
      if v_start < v_today - 366 or v_start > v_today + 366 then
        raise exception 'invalid_input' using errcode = '22023';
      end if;
      v_from := (v_start::timestamp at time zone 'Europe/Tallinn');
      v_until := private.until_from_day(private.add_months(v_start, p_months));
    end if;
  elsif p_paid_until is not null then
    if p_paid_until < v_today or p_paid_until > v_today + 3660 then
      raise exception 'invalid_input' using errcode = '22023';
    end if;
    v_until := private.until_from_day(p_paid_until);
    if v_active then
      v_mode := 'set_until';
    else
      v_mode := 'activate';
      v_start := coalesce(p_start, v_today);
      if v_start > p_paid_until or v_start < v_today - 366 then
        raise exception 'invalid_input' using errcode = '22023';
      end if;
      v_from := (v_start::timestamp at time zone 'Europe/Tallinn');
    end if;
  else
    v_mode := 'plan_only';
  end if;

  if v_mode <> 'plan_only' and v_until <= now() then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'mode', v_mode,
    'plan', p_plan,
    'plan_label', v_label,
    'monthly_price', v_price,
    'user_limit', v_users,
    'installation_limit', v_installations,
    'months', p_months,
    'start', case when v_mode = 'activate' then coalesce(v_start, v_today) end,
    'full_access_from', v_from,
    'full_access_until', v_until,
    'paid_until', case when v_until is not null then private.day_from_until(v_until) end,
    'previous_paid_until', v_current_day,
    'previous_status', v_status,
    'seats_used', private.seats_used(p_org),
    'installations_active', private.installations_active(p_org));
end;
$$;

create function public.admin_subscription_preview(
  p_org uuid, p_plan text, p_label text, p_price numeric, p_user_limit integer, p_installation_limit integer,
  p_months integer, p_paid_until date, p_start date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  if not exists (select 1 from public.organisations where id = p_org) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return private.subscription_compute(p_org, p_plan, p_label, p_price, p_user_limit, p_installation_limit,
                                      p_months, p_paid_until, p_start);
end;
$$;

create function public.admin_set_subscription(
  p_org uuid, p_plan text, p_label text, p_price numeric, p_user_limit integer, p_installation_limit integer,
  p_months integer, p_paid_until date, p_start date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v jsonb;
begin
  perform private.require_platform_admin();
  perform private.require_access_row(p_org);
  perform private.lock_company_limits(p_org);
  v_before := private.access_snapshot(p_org);
  v := private.subscription_compute(p_org, p_plan, p_label, p_price, p_user_limit, p_installation_limit,
                                    p_months, p_paid_until, p_start);
  update private.organisation_access
     set plan = v ->> 'plan',
         plan_label = v ->> 'plan_label',
         monthly_price = (v ->> 'monthly_price')::numeric,
         user_limit = (v ->> 'user_limit')::integer,
         installation_limit = (v ->> 'installation_limit')::integer,
         full_access_from = case when v ->> 'mode' = 'plan_only' then full_access_from else (v ->> 'full_access_from')::timestamptz end,
         full_access_until = case when v ->> 'mode' = 'plan_only' then full_access_until else (v ->> 'full_access_until')::timestamptz end,
         expired_manually_at = case when v ->> 'mode' = 'plan_only' then expired_manually_at else null end,
         activated_by = case when v ->> 'mode' = 'plan_only' then activated_by else auth.uid() end,
         updated_at = now()
   where organisation_id = p_org;
  perform private.admin_audit('subscription_set', 'company', p_org::text,
    jsonb_build_object('mode', v ->> 'mode', 'months', v -> 'months',
                       'before', v_before, 'after', private.access_snapshot(p_org)));
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin reads
-- ---------------------------------------------------------------------------

create function public.admin_subscriptions(p_search text default null, p_filter text default null,
                                           p_limit integer default 50, p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  perform private.require_platform_admin();
  return (
    with base as (
      select o.id, o.name, o.slug, o.deactivated_at, s.status, s.ends_at,
             a.plan, a.plan_label, a.trial_ends_at, a.full_access_until, a.user_limit, a.installation_limit,
             private.seats_used(o.id) as seats_used,
             private.installations_active(o.id) as installations_active
        from public.organisations o
        cross join lateral private.organisation_access_state(o.id) s
        left join private.organisation_access a on a.organisation_id = o.id
       where (v_search is null or o.name ilike '%' || v_search || '%' or o.slug ilike '%' || v_search || '%'
              or a.plan_label ilike '%' || v_search || '%')
         and (p_filter is null
              or (p_filter in ('trial', 'active', 'expired', 'deactivated') and s.status = p_filter)
              or (p_filter in ('start', 'team', 'pro', 'business', 'custom') and a.plan = p_filter)
              or (p_filter = 'no_plan' and a.plan is null)
              or (p_filter = 'ending_soon' and s.status in ('trial', 'active') and s.ends_at <= now() + interval '14 days'))
    )
    select jsonb_build_object(
      'total', (select count(*) from base),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', b.id, 'name', b.name, 'slug', b.slug, 'status', b.status,
                 'plan', b.plan, 'plan_label', b.plan_label,
                 'trial_ends_at', b.trial_ends_at,
                 'paid_until', case when b.full_access_until is not null then private.day_from_until(b.full_access_until) end,
                 'indefinite', b.status = 'active' and b.full_access_until is null,
                 'seats_used', b.seats_used, 'user_limit', b.user_limit,
                 'installations_active', b.installations_active, 'installation_limit', b.installation_limit)
               order by b.name, b.id)
          from (select * from base order by name, id
                 limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)) b), '[]'::jsonb)));
end;
$$;

create function public.admin_subscription(p_org uuid)
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
           'id', o.id, 'name', o.name, 'slug', o.slug,
           'status', s.status, 'ends_at', s.ends_at,
           'plan', a.plan, 'plan_label', a.plan_label, 'monthly_price', a.monthly_price,
           'user_limit', a.user_limit, 'installation_limit', a.installation_limit,
           'trial_started_at', a.trial_started_at, 'trial_ends_at', a.trial_ends_at,
           'full_access_from', a.full_access_from, 'full_access_until', a.full_access_until,
           'paid_until', case when a.full_access_until is not null then private.day_from_until(a.full_access_until) end,
           'indefinite', s.status = 'active' and a.full_access_until is null,
           'invoice_reference', a.invoice_reference, 'admin_notes', a.admin_notes,
           'seats_used', private.seats_used(o.id),
           'installations_active', private.installations_active(o.id),
           'plans', (select jsonb_agg(jsonb_build_object('plan', p.plan, 'monthly_price', p.monthly_price,
                                                         'user_limit', p.user_limit, 'installation_limit', p.installation_limit)
                                      order by p.sort) from private.subscription_plans p),
           'history', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'action', l.action, 'at', l.created_at,
                      'by', (select coalesce(nullif(p.full_name, ''), p.email) from public.profiles p where p.id = l.admin_user_id),
                      'mode', l.summary ->> 'mode',
                      'before', l.summary -> 'before', 'after', l.summary -> 'after')
                    order by l.created_at desc, l.id desc)
               from (select * from private.admin_audit_log
                      where target_type = 'company' and target_id = o.id::text
                        and action in ('subscription_set', 'full_access_set', 'trial_extended', 'access_expired', 'access_reference_changed')
                      order by created_at desc, id desc limit 100) l), '[]'::jsonb))
    into v
    from public.organisations o
    cross join lateral private.organisation_access_state(o.id) s
    left join private.organisation_access a on a.organisation_id = o.id
   where o.id = p_org;
  if v is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Customer view: plan and usage of one of the caller's companies (no price, no notes)
-- ---------------------------------------------------------------------------

create function public.organisation_plan(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not exists (select 1 from private.org_ids_readable('viewer') o where o = p_org) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select jsonb_build_object(
           'status', s.status,
           'plan', a.plan,
           'plan_label', a.plan_label,
           'user_limit', a.user_limit,
           'installation_limit', a.installation_limit,
           'seats_used', private.seats_used(p_org),
           'installations_active', private.installations_active(p_org),
           'trial_ends_at', a.trial_ends_at,
           'paid_until', case when s.status = 'active' and a.full_access_until is not null
                              then private.day_from_until(a.full_access_until) end,
           'indefinite', s.status = 'active' and a.full_access_until is null)
    into v
    from private.organisation_access_state(p_org) s
    left join private.organisation_access a on a.organisation_id = p_org;
  return v;
end;
$$;

revoke all on function private.seats_used(uuid), private.installations_active(uuid), private.lock_company_limits(uuid),
  private.invitation_seat_limit(), private.installation_plan_limit(), private.add_months(date, integer),
  private.until_from_day(date), private.day_from_until(timestamptz),
  private.subscription_compute(uuid, text, text, numeric, integer, integer, integer, date, date)
  from public, anon, authenticated;
revoke all on function public.admin_subscription_preview(uuid, text, text, numeric, integer, integer, integer, date, date),
  public.admin_set_subscription(uuid, text, text, numeric, integer, integer, integer, date, date),
  public.admin_subscriptions(text, text, integer, integer), public.admin_subscription(uuid),
  public.organisation_plan(uuid) from public;
grant execute on function public.admin_subscription_preview(uuid, text, text, numeric, integer, integer, integer, date, date),
  public.admin_set_subscription(uuid, text, text, numeric, integer, integer, integer, date, date),
  public.admin_subscriptions(text, text, integer, integer), public.admin_subscription(uuid),
  public.organisation_plan(uuid) to authenticated;
