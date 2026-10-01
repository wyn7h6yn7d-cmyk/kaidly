-- KAIDLY Phase 6: deficiencies (puudused).
--
-- A deficiency is a problem found on one electrical installation. Lifecycle:
--   open (avatud) ⇄ in_progress (töös) → resolved (lahendatud)
-- Operators and above create deficiencies and move them between open and in progress.
-- Resolving happens only through resolve_deficiency(), which requires a resolution note
-- and writes an operating-log entry in the same transaction. A resolved deficiency is
-- final (immutable); a recurring problem is recorded as a new deficiency.
-- Deficiencies are never deleted — not through the API, not by the table owner.
-- Severity labels are descriptive, not legal classifications.

create type public.deficiency_severity as enum ('low', 'medium', 'high', 'critical');
create type public.deficiency_status as enum ('open', 'in_progress', 'resolved');

create table public.deficiencies (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete restrict,
  site_id uuid not null,
  electrical_installation_id uuid not null,
  title text not null check (char_length(title) between 1 and 200 and title = btrim(title)),
  description text not null
    check (char_length(description) between 1 and 5000 and description = btrim(description)),
  severity public.deficiency_severity not null,
  detected_at timestamptz not null default now() check (detected_at >= '1900-01-01'),
  responsible_person_name text check (char_length(responsible_person_name) <= 200),
  due_on date check (due_on between '1900-01-01' and '2200-12-31'),
  status public.deficiency_status not null default 'open',
  resolution text check (char_length(resolution) between 1 and 5000 and resolution = btrim(resolution)),
  resolved_at timestamptz,
  -- No foreign keys on people: the record outlives accounts; names are snapshotted.
  resolved_by uuid,
  resolved_by_name text,
  created_by uuid not null default auth.uid(),
  created_by_name text not null default '', -- always set by the insert trigger
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check ((status = 'resolved') = (resolved_at is not null)),
  check (
    (status = 'resolved' and resolution is not null and resolved_by is not null and resolved_by_name is not null)
    or (status <> 'resolved' and resolution is null and resolved_by is null and resolved_by_name is null)
  ),

  foreign key (site_id, organisation_id)
    references public.sites (id, organisation_id) on delete restrict,
  foreign key (electrical_installation_id, organisation_id)
    references public.electrical_installations (id, organisation_id) on delete restrict,
  foreign key (electrical_installation_id, site_id)
    references public.electrical_installations (id, site_id) on delete restrict,
  unique (id, electrical_installation_id)
);

create index deficiencies_org_status_idx
  on public.deficiencies (organisation_id, status, severity, due_on);
create index deficiencies_installation_idx
  on public.deficiencies (electrical_installation_id, status);
create index deficiencies_installation_site_idx
  on public.deficiencies (electrical_installation_id, site_id);
create index deficiencies_installation_org_idx
  on public.deficiencies (electrical_installation_id, organisation_id);
create index deficiencies_site_idx on public.deficiencies (site_id, organisation_id);

comment on table public.deficiencies is 'Deficiencies (puudused) found on installations. Never deleted.';

-- ---------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------

create function private.deficiency_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is not null then
    new.created_by := v_user;
  end if;
  if new.created_by is null then
    raise exception 'deficiency_without_author' using errcode = '23502';
  end if;
  select coalesce(nullif(btrim(p.full_name), ''), p.email, 'Tundmatu')
    into new.created_by_name
    from public.profiles p where p.id = new.created_by;
  new.created_by_name := coalesce(new.created_by_name, 'Tundmatu');
  new.created_at := clock_timestamp();

  if new.detected_at > now() + interval '5 minutes' then
    raise exception 'occurred_in_future' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.electrical_installations
     where id = new.electrical_installation_id and archived_at is not null
  ) then
    raise exception 'installation_archived' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger deficiency_before_insert
  before insert on public.deficiencies
  for each row execute function private.deficiency_before_insert();

create function private.deficiency_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'resolved' then
    raise exception 'deficiency_resolved' using errcode = 'P0001';
  end if;
  if new.status = 'resolved'
     and coalesce(current_setting('kaidly.resolving_deficiency', true), '') <> 'on' then
    raise exception 'deficiency_resolve_via_rpc' using errcode = 'P0001';
  end if;
  if new.detected_at > now() + interval '5 minutes' then
    raise exception 'occurred_in_future' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger deficiency_before_update
  before update on public.deficiencies
  for each row execute function private.deficiency_before_update();

create function private.deficiencies_no_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'deficiencies_are_kept' using errcode = 'P0001';
end;
$$;

create trigger deficiencies_no_delete
  before delete on public.deficiencies
  for each row execute function private.deficiencies_no_delete();
create trigger deficiencies_no_truncate
  before truncate on public.deficiencies
  for each statement execute function private.deficiencies_no_delete();

create trigger set_updated_at
  before update on public.deficiencies
  for each row execute function private.set_updated_at();
create trigger prevent_organisation_change
  before update on public.deficiencies
  for each row execute function private.prevent_organisation_change();
-- Status transitions and edits land in activity_history with the acting user.
create trigger record_history
  after insert or update on public.deficiencies
  for each row execute function private.record_history();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.deficiencies enable row level security;

create policy "members read deficiencies" on public.deficiencies
  for select to authenticated
  using (organisation_id in (select private.org_ids('viewer')));

create policy "operators record deficiencies" on public.deficiencies
  for insert to authenticated
  with check (organisation_id in (select private.org_ids('operator')));

create policy "operators update deficiencies" on public.deficiencies
  for update to authenticated
  using (organisation_id in (select private.org_ids('operator')))
  with check (organisation_id in (select private.org_ids('operator')));

grant select on table public.deficiencies to authenticated;
-- Resolution fields are not writable: resolving goes through resolve_deficiency().
grant insert (
  organisation_id, site_id, electrical_installation_id, title, description, severity,
  detected_at, responsible_person_name, due_on, status
) on table public.deficiencies to authenticated;
grant update (
  title, description, severity, detected_at, responsible_person_name, due_on, status
) on table public.deficiencies to authenticated;

-- ---------------------------------------------------------------------------
-- Operating log: resolution records
-- ---------------------------------------------------------------------------

alter table public.log_entries add column deficiency_id uuid;

alter table public.log_entries
  add constraint log_entries_correction_not_resolution
    check (correction_of_id is null or deficiency_id is null),
  add constraint log_entries_deficiency_fkey
    foreign key (deficiency_id, electrical_installation_id)
    references public.deficiencies (id, electrical_installation_id) on delete restrict;

-- One resolution entry per deficiency.
create unique index log_entries_one_resolution_per_deficiency
  on public.log_entries (deficiency_id)
  where deficiency_id is not null;

-- deficiency_id is deliberately not in the log_entries insert grant.

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
  o.scheduled_due_on,
  o.deficiency_id
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
-- RPC: resolve_deficiency
-- ---------------------------------------------------------------------------

create function public.resolve_deficiency(
  p_deficiency_id uuid,
  p_resolution text,
  p_entry_type public.log_entry_type,
  p_occurred_at timestamptz,
  p_performed_by_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_deficiency public.deficiencies%rowtype;
  v_resolution text := nullif(btrim(coalesce(p_resolution, '')), '');
  v_entry uuid;
  v_name text;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_deficiency from public.deficiencies where id = p_deficiency_id for update;
  if not found or not private.has_org_role(v_deficiency.organisation_id, 'operator') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_deficiency.status = 'resolved' then
    raise exception 'deficiency_already_resolved' using errcode = 'P0001';
  end if;
  if v_resolution is null then
    raise exception 'resolution_required' using errcode = '23514';
  end if;

  insert into public.log_entries (
    organisation_id, site_id, electrical_installation_id, occurred_at, entry_type,
    description, performed_by_name, deficiency_id
  ) values (
    v_deficiency.organisation_id, v_deficiency.site_id, v_deficiency.electrical_installation_id,
    coalesce(p_occurred_at, now()), p_entry_type, v_resolution,
    nullif(btrim(p_performed_by_name), ''), v_deficiency.id
  )
  returning id into v_entry;

  select coalesce(nullif(btrim(p.full_name), ''), p.email, 'Tundmatu')
    into v_name from public.profiles p where p.id = v_user;

  perform set_config('kaidly.resolving_deficiency', 'on', true);
  update public.deficiencies
     set status = 'resolved',
         resolution = v_resolution,
         resolved_at = now(),
         resolved_by = v_user,
         resolved_by_name = coalesce(v_name, 'Tundmatu')
   where id = v_deficiency.id;
  perform set_config('kaidly.resolving_deficiency', 'off', true);

  return v_entry;
end;
$$;

grant execute on function public.resolve_deficiency(
  uuid, text, public.log_entry_type, timestamptz, text
) to authenticated;
