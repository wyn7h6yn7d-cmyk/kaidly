-- Global search: the log-entry group picks the newest matching entries first and joins
-- installation/site/company names only for those rows. Before, a common word (e.g.
-- "kontroll") matched ~25,000 entries on the scale fixture and the planner joined them row by
-- row before the limit (~280 ms); now the scan + top-N sort runs alone. Same signature,
-- results, ordering and SECURITY INVOKER (the caller's RLS decides every row).

create or replace function public.search_kaidly(p_query text, p_entry_types log_entry_type[] DEFAULT '{}'::log_entry_type[], p_per_group integer DEFAULT 6)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_q text := btrim(coalesce(p_query, ''));
  v_like text;
  v_n int := least(greatest(coalesce(p_per_group, 6), 1), 25);
begin
  if char_length(v_q) < 2 then
    return jsonb_build_object('companies', '[]'::jsonb, 'sites', '[]'::jsonb, 'installations', '[]'::jsonb,
      'log', '[]'::jsonb, 'activities', '[]'::jsonb, 'deficiencies', '[]'::jsonb, 'documents', '[]'::jsonb);
  end if;
  v_q := left(v_q, 100);
  -- Literal search: the user's % and _ are not wildcards.
  v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return jsonb_build_object(
    'companies', coalesce((
      select jsonb_agg(r) from (
        select o.id, o.name, o.slug
          from public.organisations o
         where o.deactivated_at is null and o.name ilike v_like
         order by o.name limit v_n) r), '[]'::jsonb),
    'sites', coalesce((
      select jsonb_agg(r) from (
        select s.id, s.name, s.address, s.archived_at is not null as archived, o.name as company, o.slug
          from public.sites s join public.organisations o on o.id = s.organisation_id
         where o.deactivated_at is null and (s.name ilike v_like or s.address ilike v_like)
         order by s.archived_at nulls first, s.name limit v_n) r), '[]'::jsonb),
    'installations', coalesce((
      select jsonb_agg(r) from (
        select i.id, i.name, i.identifier, i.archived_at is not null as archived, s.name as site, o.name as company, o.slug
          from public.electrical_installations i
          join public.sites s on s.id = i.site_id
          join public.organisations o on o.id = i.organisation_id
         where o.deactivated_at is null and (i.name ilike v_like or i.identifier ilike v_like)
         order by i.archived_at nulls first, i.name limit v_n) r), '[]'::jsonb),
    'log', coalesce((
      select jsonb_agg(r) from (
        select coalesce(e.correction_of_id, e.id) as id, e.correction_of_id is not null as correction,
               e.entry_type, e.occurred_at, left(e.description, 160) as description,
               e.electrical_installation_id as installation_id, i.name as installation, i.identifier,
               s.name as site, o.name as company, o.slug
          -- The newest matches first, then names for just those rows: a common word can match
          -- tens of thousands of entries, which must not be joined row by row before the limit.
          from (select le.id, le.correction_of_id, le.entry_type, le.occurred_at, le.description,
                       le.electrical_installation_id, le.site_id, le.organisation_id
                  from public.log_entries le
                 where le.organisation_id in (select od.id from public.organisations od where od.deactivated_at is null)
                   and (le.description ilike v_like or le.result ilike v_like or le.performed_by_name ilike v_like
                        or le.entry_type = any (p_entry_types))
                 order by le.occurred_at desc, le.id desc limit v_n) e
          join public.electrical_installations i on i.id = e.electrical_installation_id
          join public.sites s on s.id = e.site_id
          join public.organisations o on o.id = e.organisation_id
         order by e.occurred_at desc, e.id desc) r), '[]'::jsonb),
    'activities', coalesce((
      select jsonb_agg(r) from (
        select a.id, a.title, a.next_due_on, a.archived_at is not null as archived,
               i.name as installation, i.identifier, s.name as site, o.name as company, o.slug
          from public.scheduled_activities a
          join public.electrical_installations i on i.id = a.electrical_installation_id
          join public.sites s on s.id = a.site_id
          join public.organisations o on o.id = a.organisation_id
         where o.deactivated_at is null and a.title ilike v_like
         order by a.archived_at nulls first, a.next_due_on nulls last limit v_n) r), '[]'::jsonb),
    'deficiencies', coalesce((
      select jsonb_agg(r) from (
        select d.id, d.title, d.severity, d.status, d.detected_at,
               i.name as installation, i.identifier, s.name as site, o.name as company, o.slug
          from public.deficiencies d
          join public.electrical_installations i on i.id = d.electrical_installation_id
          join public.sites s on s.id = d.site_id
          join public.organisations o on o.id = d.organisation_id
         where o.deactivated_at is null and (d.title ilike v_like or d.description ilike v_like)
         order by (d.status = 'resolved'), d.detected_at desc limit v_n) r), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(r) from (
        select d.id, d.title, d.original_filename, d.category, d.archived_at is not null as archived,
               s.name as site, i.name as installation, i.identifier, o.name as company, o.slug
          from public.documents d
          join public.organisations o on o.id = d.organisation_id
          left join public.sites s on s.id = d.site_id
          left join public.electrical_installations i on i.id = d.electrical_installation_id
         where o.deactivated_at is null and d.status = 'ready'
           and (d.title ilike v_like or d.original_filename ilike v_like)
         order by d.archived_at nulls first, d.ready_at desc limit v_n) r), '[]'::jsonb)
  );
end;
$function$;
