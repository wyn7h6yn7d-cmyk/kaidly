-- KAIDLY: deadline reminders and in-app notifications, built on the operating plan.
--
-- * scheduled_activities.reminder_days — when to warn, in days before the due date
--   (default {14}; 0 = on the due date). Separate from the schedule itself: next_due_on
--   says when work is due, reminder_days says when people are warned.
-- * public.notifications — one row per user and reminder. Identity (idempotency):
--   (user, activity, due occurrence, threshold, channel) is unique, so generating again
--   never duplicates. Only 'in_app' exists; 'email' / 'push' are future channels.
-- * private.generate_activity_reminders(today, activity) — evaluates active activities of
--   active organisations: for each occurrence it creates the reminder for the tightest
--   threshold already reached (so a late first run doesn't fire 30, 14 and 7 at once), for
--   owners, admins and operators who are current members and not disabled. Viewers are
--   not notified. Runs daily through pg_cron and immediately when an activity is created,
--   rescheduled, completed or its thresholds change.
-- * When the due occurrence moves on (completion, reschedule, archive), unread reminders of
--   the old occurrence are marked read: they stay as history but leave the unread list.
-- * Business date: Europe/Tallinn (private.business_date), like the rest of KAIDLY. There
--   is no per-organisation time zone yet.
-- No countdown value is stored; it is derived from next_due_on when shown.

-- ---------------------------------------------------------------------------
-- Thresholds on the activity
-- ---------------------------------------------------------------------------

alter table public.scheduled_activities
  add column reminder_days smallint[] not null default '{14}'
    check (cardinality(reminder_days) <= 8
           and 0 <= all (reminder_days) and 365 >= all (reminder_days)
           and array_position(reminder_days, null) is null);

grant insert (reminder_days), update (reminder_days) on table public.scheduled_activities to authenticated;

-- Lets notifications reference an activity together with its organisation.
alter table public.scheduled_activities
  add constraint scheduled_activities_id_organisation_key unique (id, organisation_id);

-- ---------------------------------------------------------------------------
-- Business date
-- ---------------------------------------------------------------------------

create function private.business_date(p_at timestamptz default now())
returns date
language sql
stable
set search_path = ''
as $$
  select (p_at at time zone 'Europe/Tallinn')::date
$$;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  type text not null default 'activity_reminder' check (type in ('activity_reminder')),
  channel text not null default 'in_app' check (channel in ('in_app')),
  scheduled_activity_id uuid not null,
  -- The due occurrence this reminder is about (the activity's next_due_on at the time).
  due_on date not null,
  threshold_days smallint not null check (threshold_days between 0 and 365),
  created_at timestamptz not null default now(),
  read_at timestamptz,

  foreign key (scheduled_activity_id, organisation_id)
    references public.scheduled_activities (id, organisation_id) on delete cascade,
  constraint notifications_identity unique (user_id, scheduled_activity_id, due_on, threshold_days, channel)
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc, id desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_activity_idx on public.notifications (scheduled_activity_id, organisation_id);
create index notifications_organisation_idx on public.notifications (organisation_id);

comment on table public.notifications is
  'Per-user in-app reminders. Written only by private.generate_activity_reminders().';

alter table public.notifications enable row level security;

-- Own notifications only, and only while still a member of that organisation.
create policy "users read their own notifications" on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()) and organisation_id in (select private.org_ids('viewer')));

create policy "users mark their own notifications read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()) and organisation_id in (select private.org_ids('viewer')))
  with check (user_id = (select auth.uid()) and organisation_id in (select private.org_ids('viewer')));

grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Generation
-- ---------------------------------------------------------------------------

create function private.generate_activity_reminders(
  p_today date default null,
  p_activity uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := coalesce(p_today, private.business_date());
  v_count integer;
begin
  with due as (
    select a.id, a.organisation_id, a.next_due_on,
           (select min(t) from unnest(a.reminder_days) t where a.next_due_on - v_today <= t) as threshold
      from public.scheduled_activities a
      join public.organisations o on o.id = a.organisation_id
     where a.archived_at is null
       and a.next_due_on is not null
       and o.deactivated_at is null
       and (p_activity is null or a.id = p_activity)
  ),
  inserted as (
    insert into public.notifications (user_id, organisation_id, scheduled_activity_id, due_on, threshold_days)
    select m.user_id, d.organisation_id, d.id, d.next_due_on, d.threshold
      from due d
      join public.organisation_members m
        on m.organisation_id = d.organisation_id and m.role in ('owner', 'admin', 'operator')
      join auth.users u on u.id = m.user_id
     where d.threshold is not null
       and (u.banned_until is null or u.banned_until <= now())
    on conflict on constraint notifications_identity do nothing
    returning 1
  )
  select count(*) into v_count from inserted;
  return v_count;
end;
$$;

revoke all on function private.generate_activity_reminders(date, uuid) from public, anon, authenticated;

-- When an activity's due occurrence or thresholds change: older occurrences' unread
-- reminders become history, and the current occurrence is evaluated right away.
create function private.scheduled_activity_reminders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.next_due_on is distinct from old.next_due_on or new.archived_at is not null) then
    update public.notifications
       set read_at = now()
     where scheduled_activity_id = new.id
       and read_at is null
       and (new.archived_at is not null or new.next_due_on is null or due_on <> new.next_due_on);
  end if;
  perform private.generate_activity_reminders(null, new.id);
  return null;
end;
$$;

create trigger scheduled_activity_reminders
  after insert or update of next_due_on, archived_at, reminder_days on public.scheduled_activities
  for each row execute function private.scheduled_activity_reminders();

-- ---------------------------------------------------------------------------
-- Reading (security invoker: RLS of the caller applies to every table joined)
-- ---------------------------------------------------------------------------

create function public.my_notifications(p_unread_only boolean default false, p_limit int default 20, p_offset int default 0)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'unread', (select count(*) from public.notifications where user_id = auth.uid() and read_at is null),
    'total', (select count(*) from public.notifications where user_id = auth.uid() and (not p_unread_only or read_at is null)),
    'rows', coalesce((
      select jsonb_agg(r order by r.created_at desc, r.id desc) from (
        select n.id, n.created_at, n.read_at, n.due_on, n.threshold_days,
               n.scheduled_activity_id as activity_id,
               a.title, a.next_due_on, a.archived_at is not null as archived,
               o.name as company, o.slug,
               s.name as site, i.name as installation, i.identifier
          from public.notifications n
          join public.scheduled_activities a on a.id = n.scheduled_activity_id and a.organisation_id = n.organisation_id
          join public.organisations o on o.id = n.organisation_id
          join public.sites s on s.id = a.site_id
          join public.electrical_installations i on i.id = a.electrical_installation_id
         where n.user_id = auth.uid() and (not p_unread_only or n.read_at is null)
         order by n.created_at desc, n.id desc
         limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)) r), '[]'::jsonb)
  )
$$;

revoke all on function public.my_notifications(boolean, int, int) from public;
grant execute on function public.my_notifications(boolean, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Daily background run (pg_cron, inside the database: no HTTP endpoint, no secret, no
-- service-role key). 03:15 UTC = 05:15/06:15 in Tallinn. Idempotent; a missed day is
-- caught up by the next run (the tightest reached threshold is generated).
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;

select cron.schedule(
  'kaidly-activity-reminders',
  '15 3 * * *',
  'select private.generate_activity_reminders()'
);
