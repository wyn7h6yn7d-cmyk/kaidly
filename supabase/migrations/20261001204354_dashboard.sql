-- KAIDLY Phase 8: dashboard — "what needs my attention?"
--
-- One view with outstanding items per active site, so the dashboard needs a single query
-- instead of one per site. It is security_invoker: the caller's RLS on sites, scheduled
-- activities and deficiencies applies, so it only ever counts the caller's organisations.
-- "Today" is the Tallinn calendar date, matching lib/time.ts; "due soon" is the same
-- 14-day window as lib/schedule.ts (DUE_SOON_DAYS).

create view public.site_attention
with (security_invoker = true)
as
with today as (
  select (now() at time zone 'Europe/Tallinn')::date as d
)
select
  s.id as site_id,
  s.organisation_id,
  s.name,
  (select count(*) from public.scheduled_activities a, today
    where a.site_id = s.id and a.archived_at is null and a.next_due_on < today.d
  )::int as overdue_activities,
  (select count(*) from public.scheduled_activities a, today
    where a.site_id = s.id and a.archived_at is null
      and a.next_due_on between today.d and today.d + 14
  )::int as due_soon_activities,
  (select count(*) from public.deficiencies d
    where d.site_id = s.id and d.status <> 'resolved'
  )::int as open_deficiencies,
  (select count(*) from public.deficiencies d
    where d.site_id = s.id and d.status <> 'resolved' and d.severity in ('high', 'critical')
  )::int as serious_deficiencies
from public.sites s
where s.archived_at is null;

comment on view public.site_attention is
  'Outstanding items per active site (overdue/due-soon activities, open/serious deficiencies). security_invoker: RLS of the underlying tables applies.';

grant select on public.site_attention to authenticated;

-- Supports the per-site counts above.
create index scheduled_activities_site_due_idx
  on public.scheduled_activities (site_id, next_due_on) where archived_at is null;
create index deficiencies_site_open_idx
  on public.deficiencies (site_id, severity) where status <> 'resolved';
