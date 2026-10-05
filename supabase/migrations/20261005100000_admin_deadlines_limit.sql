-- Platform-wide deadlines (/admin/deadlines) are bounded: at most the 500 most urgent rows
-- (same order as before: due date, severity, title) plus the true total, so a growing
-- customer base can't turn the page into an unbounded multi-megabyte list. Filters and
-- authorisation unchanged (require_platform_admin first). Measured before: 8,925 rows /
-- 4.3 MB JSON / 3.1 s page on the scale fixture.

create or replace function public.admin_deadlines(
  p_company uuid default null,
  p_kind text default null,
  p_severity text default null,
  p_state text default null,
  p_from date default null,
  p_to date default null,
  p_include_deactivated boolean default false,
  p_site uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Tallinn')::date;
  v_rows jsonb;
  v_total bigint;
begin
  perform private.require_platform_admin();
  with x as (
    select * from (
      select 'activity' as kind, a.id, o.id as company_id, o.name as company, o.deactivated_at is not null as company_deactivated,
             s.id as site_id, s.name as site, i.name as installation, i.identifier, a.title as item, null::text as severity, 0 as severity_rank,
             a.next_due_on as due_on, (a.next_due_on - v_today) as days, a.responsible_person_name as responsible,
             case when a.next_due_on < v_today then 'overdue' else 'soon' end as state
        from public.scheduled_activities a
        join public.organisations o on o.id = a.organisation_id
        join public.sites s on s.id = a.site_id
        join public.electrical_installations i on i.id = a.electrical_installation_id
       where a.archived_at is null and a.next_due_on is not null and a.next_due_on <= v_today + 14
         and (p_kind is null or p_kind = 'activity') and p_severity is null
         and (p_state is null or (p_state = 'overdue' and a.next_due_on < v_today) or (p_state = 'soon' and a.next_due_on >= v_today))
      union all
      select 'deficiency', d.id, o.id, o.name, o.deactivated_at is not null, s.id, s.name, i.name, i.identifier, d.title, d.severity::text,
             case d.severity when 'critical' then 2 else 1 end,
             d.due_on, (d.due_on - v_today), d.responsible_person_name,
             case when d.due_on is not null and d.due_on < v_today then 'overdue' else 'open' end
        from public.deficiencies d
        join public.organisations o on o.id = d.organisation_id
        join public.sites s on s.id = d.site_id
        join public.electrical_installations i on i.id = d.electrical_installation_id
       where d.status <> 'resolved' and d.severity in ('high', 'critical')
         and (p_kind is null or p_kind = 'deficiency')
         and (p_severity is null or d.severity::text = p_severity)
         and (p_state is null or (p_state = 'overdue' and d.due_on < v_today))
    ) u
   where (p_company is null or u.company_id = p_company)
     and (p_site is null or u.site_id = p_site)
     and (p_include_deactivated or not u.company_deactivated)
     and (p_from is null or u.due_on >= p_from)
     and (p_to is null or u.due_on <= p_to)
  ), ranked as (
    select x.*, count(*) over () as total_count,
           row_number() over (order by x.due_on nulls last, x.severity_rank desc, x.item, x.id) as rn
      from x
  )
  select coalesce(jsonb_agg((to_jsonb(r) - 'rn' - 'total_count') order by r.rn) filter (where r.rn <= 500), '[]'::jsonb),
         coalesce(max(r.total_count), 0)
    into v_rows, v_total
    from ranked r;
  return jsonb_build_object('today', v_today, 'rows', v_rows, 'total', v_total, 'limit', 500);
end;
$$;
