-- KAIDLY Phase 5: operating plan (käidukava) — scheduled operating activities.
--
-- Not a task manager: an activity is a planned operating action on one electrical
-- installation, one-time or recurring.
--
-- Recurrence is deterministic and anchored: due dates are anchor_on + k × interval
-- (k = 1, 2, …). Completing an activity (only through complete_scheduled_activity)
-- writes an operating-log entry for that due date and moves next_due_on to the first
-- anchored date after both the completed due date and today. So:
--   * completed early  → next due is the following occurrence (no drift);
--   * completed late   → occurrences already missed are skipped, the schedule stays
--                        anchored (it does not restart from the completion date);
--   * month ends don't drift (31 Jan → 28 Feb → 31 Mar, all computed from the anchor).
-- Completion history is the operating log itself: immutable, one entry per due date.
-- Status (upcoming / due soon / overdue / done) is derived from next_due_on, not stored.

create type public.activity_frequency as enum ('once', 'recurring');
create type public.interval_unit as enum ('day', 'week', 'month', 'year');
create type public.activity_priority as enum ('low', 'normal', 'high');

create table public.scheduled_activities (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete restrict,
  site_id uuid not null,
  electrical_installation_id uuid not null,
  title text not null check (char_length(title) between 1 and 200 and title = btrim(title)),
  description text check (char_length(description) <= 5000),
  frequency_type public.activity_frequency not null,
  interval_value int check (interval_value between 1 and 1000),
  interval_unit public.interval_unit,
  -- Schedule anchor: the planned due date all future due dates are computed from. Reset to
  -- next_due_on whenever an admin changes the schedule; never client-writable.
  -- (The default is a placeholder; the insert trigger always sets anchor_on.)
  anchor_on date not null default current_date check (anchor_on between '1900-01-01' and '2200-12-31'),
  -- Null only for a completed one-time activity.
  next_due_on date check (next_due_on between '1900-01-01' and '2200-12-31'),
  responsible_person_name text check (char_length(responsible_person_name) <= 200),
  priority public.activity_priority not null default 'normal',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  check ((interval_value is null) = (interval_unit is null)),
  check ((frequency_type = 'recurring') = (interval_value is not null)),
  check (frequency_type = 'once' or next_due_on is not null),
  check (next_due_on is null or next_due_on >= anchor_on),

  foreign key (site_id, organisation_id)
    references public.sites (id, organisation_id) on delete restrict,
  foreign key (electrical_installation_id, organisation_id)
    references public.electrical_installations (id, organisation_id) on delete restrict,
  foreign key (electrical_installation_id, site_id)
    references public.electrical_installations (id, site_id) on delete restrict,
  unique (id, electrical_installation_id)
);

create index scheduled_activities_org_due_idx
  on public.scheduled_activities (organisation_id, next_due_on) where archived_at is null;
create index scheduled_activities_installation_idx
  on public.scheduled_activities (electrical_installation_id, site_id);
create index scheduled_activities_installation_org_idx
  on public.scheduled_activities (electrical_installation_id, organisation_id);
create index scheduled_activities_site_idx on public.scheduled_activities (site_id, organisation_id);
create index scheduled_activities_created_by_idx on public.scheduled_activities (created_by);

comment on table public.scheduled_activities is
  'Operating plan (käidukava): planned operating activities per installation.';

-- When an admin changes when or how often an activity is due, that becomes the new
-- anchor. complete_scheduled_activity() advances next_due_on without moving the anchor.
create function private.scheduled_activity_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('kaidly.advancing_schedule', true), '') <> 'on'
     and (new.next_due_on is distinct from old.next_due_on
          or new.frequency_type is distinct from old.frequency_type
          or new.interval_value is distinct from old.interval_value
          or new.interval_unit is distinct from old.interval_unit) then
    if new.next_due_on is null then
      raise exception 'next_due_required' using errcode = '23514';
    end if;
    new.anchor_on := new.next_due_on;
  end if;
  return new;
end;
$$;

create trigger scheduled_activity_before_update
  before update on public.scheduled_activities
  for each row execute function private.scheduled_activity_before_update();

create function private.scheduled_activity_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.next_due_on is null then
    raise exception 'next_due_required' using errcode = '23514';
  end if;
  new.anchor_on := new.next_due_on;
  return new;
end;
$$;

create trigger scheduled_activity_before_insert
  before insert on public.scheduled_activities
  for each row execute function private.scheduled_activity_before_insert();

create trigger set_updated_at
  before update on public.scheduled_activities
  for each row execute function private.set_updated_at();
create trigger prevent_organisation_change
  before update on public.scheduled_activities
  for each row execute function private.prevent_organisation_change();
create trigger record_history
  after insert or update on public.scheduled_activities
  for each row execute function private.record_history();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.scheduled_activities enable row level security;

create policy "members read the operating plan" on public.scheduled_activities
  for select to authenticated
  using (organisation_id in (select private.org_ids('viewer')));

create policy "admins create activities" on public.scheduled_activities
  for insert to authenticated
  with check (organisation_id in (select private.org_ids('admin')));

create policy "admins manage activities" on public.scheduled_activities
  for update to authenticated
  using (organisation_id in (select private.org_ids('admin')))
  with check (organisation_id in (select private.org_ids('admin')));

grant select on table public.scheduled_activities to authenticated;
-- anchor_on is deliberately not insertable/updatable: the triggers above own it.
grant insert (
  organisation_id, site_id, electrical_installation_id, title, description, frequency_type,
  interval_value, interval_unit, next_due_on, responsible_person_name, priority
) on table public.scheduled_activities to authenticated;
grant update (
  title, description, frequency_type, interval_value, interval_unit, next_due_on,
  responsible_person_name, priority, archived_at
) on table public.scheduled_activities to authenticated;

-- ---------------------------------------------------------------------------
-- Operating log: completion records
-- ---------------------------------------------------------------------------

-- Adding columns is DDL; existing log rows are not modified.
alter table public.log_entries
  add column scheduled_activity_id uuid,
  add column scheduled_due_on date;

alter table public.log_entries
  add constraint log_entries_schedule_pair
    check ((scheduled_activity_id is null) = (scheduled_due_on is null)),
  add constraint log_entries_correction_not_completion
    check (correction_of_id is null or scheduled_activity_id is null),
  add constraint log_entries_scheduled_activity_fkey
    foreign key (scheduled_activity_id, electrical_installation_id)
    references public.scheduled_activities (id, electrical_installation_id) on delete restrict;

-- One completion per due date: a double submit or two people at once can't both record it.
create unique index log_entries_one_completion_per_due_date
  on public.log_entries (scheduled_activity_id, scheduled_due_on)
  where scheduled_activity_id is not null;

-- These columns are deliberately NOT in the log_entries insert grant: only
-- complete_scheduled_activity() can record a completion.

create or replace view public.log_entry_current
with (security_invoker = true)
as
select
  o.id,
  o.organisation_id,
  o.site_id,
  o.electrical_installation_id,
  case when c.id is null then o.occurred_at else c.occurred_at end as occurred_at,
  case when c.id is null then o.entry_type else c.entry_type end as entry_type,
  case when c.id is null then o.description else c.description end as description,
  case when c.id is null then o.result else c.result end as result,
  case when c.id is null then o.performed_by_name else c.performed_by_name end as performed_by_name,
  o.created_by_name as recorded_by_name,
  o.created_at as recorded_at,
  c.id is not null as is_corrected,
  c.created_at as corrected_at,
  c.created_by_name as corrected_by_name,
  c.correction_reason,
  (select count(*) from public.log_entries x where x.correction_of_id = o.id)::int as correction_count,
  o.scheduled_activity_id,
  o.scheduled_due_on
from public.log_entries o
left join lateral (
  select c.*
    from public.log_entries c
   where c.correction_of_id = o.id
   order by c.created_at desc, c.id desc
   limit 1
) c on true
where o.correction_of_id is null;

-- ---------------------------------------------------------------------------
-- Next due date
-- ---------------------------------------------------------------------------

-- First anchored date strictly after both p_after and p_today.
create function private.next_anchored_due(
  p_anchor date,
  p_value int,
  p_unit public.interval_unit,
  p_after date,
  p_today date
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_step interval := case p_unit
    when 'day' then make_interval(days => p_value)
    when 'week' then make_interval(weeks => p_value)
    when 'month' then make_interval(months => p_value)
    when 'year' then make_interval(years => p_value)
  end;
  v_next date;
  k int := 1;
begin
  loop
    v_next := (p_anchor + k * v_step)::date;
    exit when v_next > p_after and v_next > p_today;
    k := k + 1;
    if k > 1000000 then
      raise exception 'schedule_out_of_range' using errcode = '22003';
    end if;
  end loop;
  return v_next;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: complete_scheduled_activity
-- ---------------------------------------------------------------------------

create function public.complete_scheduled_activity(
  p_activity_id uuid,
  p_due_on date,
  p_entry_type public.log_entry_type,
  p_occurred_at timestamptz,
  p_description text,
  p_result text default null,
  p_performed_by_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_activity public.scheduled_activities%rowtype;
  v_entry uuid;
  v_next date;
  v_today date := (now() at time zone 'Europe/Tallinn')::date;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Lock: concurrent completions of the same activity are serialised.
  select * into v_activity
    from public.scheduled_activities
   where id = p_activity_id
   for update;

  -- Same error for "doesn't exist" and "not allowed": ids can't be probed.
  if not found or not private.has_org_role(v_activity.organisation_id, 'operator') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_activity.archived_at is not null then
    raise exception 'activity_archived' using errcode = 'P0001';
  end if;
  -- Already completed (one-time) or someone else just completed this due date.
  if v_activity.next_due_on is null or p_due_on is distinct from v_activity.next_due_on then
    raise exception 'activity_already_completed' using errcode = 'P0001';
  end if;

  insert into public.log_entries (
    organisation_id, site_id, electrical_installation_id, occurred_at, entry_type,
    description, result, performed_by_name, scheduled_activity_id, scheduled_due_on
  ) values (
    v_activity.organisation_id, v_activity.site_id, v_activity.electrical_installation_id,
    coalesce(p_occurred_at, now()), p_entry_type,
    coalesce(nullif(btrim(p_description), ''), v_activity.title),
    nullif(btrim(p_result), ''), nullif(btrim(p_performed_by_name), ''),
    v_activity.id, p_due_on
  )
  returning id into v_entry;

  if v_activity.frequency_type = 'once' then
    v_next := null;
  else
    v_next := private.next_anchored_due(
      v_activity.anchor_on, v_activity.interval_value, v_activity.interval_unit, p_due_on, v_today
    );
  end if;

  perform set_config('kaidly.advancing_schedule', 'on', true);
  update public.scheduled_activities set next_due_on = v_next where id = v_activity.id;
  perform set_config('kaidly.advancing_schedule', 'off', true);

  return v_entry;
end;
$$;

grant execute on function public.complete_scheduled_activity(
  uuid, date, public.log_entry_type, timestamptz, text, text, text
) to authenticated;
