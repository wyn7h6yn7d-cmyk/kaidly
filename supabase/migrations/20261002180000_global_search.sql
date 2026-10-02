-- KAIDLY global search.
--
-- public.search_kaidly(query, entry_types, per_group) is SECURITY INVOKER: every table it
-- reads is filtered by the caller's own RLS, so search can never return a row the user
-- could not open anyway (tenant, role and membership rules unchanged). Deactivated
-- companies are left out (their pages only show the deactivation notice); expired
-- (read-only) companies are searchable — reading stays allowed.
--
-- Searched: company name; site name and address; installation name and identifier;
-- operating-log description, result and performer; activity title; deficiency title and
-- description; ready document title and original filename. Log entry TYPES are matched by
-- the app (localised labels → p_entry_types). Nothing else (no storage paths, no tokens,
-- no internal notes).
--
-- Substring search (ILIKE '%…%') uses trigram GIN indexes on exactly the searched columns.

create extension if not exists pg_trgm with schema extensions;

create index organisations_name_trgm on public.organisations using gin (name extensions.gin_trgm_ops);
create index sites_name_trgm on public.sites using gin (name extensions.gin_trgm_ops);
create index electrical_installations_name_trgm on public.electrical_installations using gin (name extensions.gin_trgm_ops);
create index electrical_installations_identifier_trgm on public.electrical_installations using gin (identifier extensions.gin_trgm_ops);
create index log_entries_description_trgm on public.log_entries using gin (description extensions.gin_trgm_ops);
create index scheduled_activities_title_trgm on public.scheduled_activities using gin (title extensions.gin_trgm_ops);
create index deficiencies_title_trgm on public.deficiencies using gin (title extensions.gin_trgm_ops);
create index documents_title_trgm on public.documents using gin (title extensions.gin_trgm_ops);
create index documents_filename_trgm on public.documents using gin (original_filename extensions.gin_trgm_ops);

create function public.search_kaidly(p_query text, p_entry_types public.log_entry_type[] default '{}', p_per_group int default 6)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
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
          from public.log_entries e
          join public.electrical_installations i on i.id = e.electrical_installation_id
          join public.sites s on s.id = e.site_id
          join public.organisations o on o.id = e.organisation_id
         where o.deactivated_at is null
           and (e.description ilike v_like or e.result ilike v_like or e.performed_by_name ilike v_like
                or e.entry_type = any (p_entry_types))
         order by e.occurred_at desc, e.id desc limit v_n) r), '[]'::jsonb),
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
$$;

revoke all on function public.search_kaidly(text, public.log_entry_type[], int) from public;
grant execute on function public.search_kaidly(text, public.log_entry_type[], int) to authenticated;
