-- KAIDLY Phase 4: operating log (käidupäevik).
--
-- Strictly append-only. Entries are never updated or deleted — not through the API, not
-- by the table owner (a trigger rejects UPDATE, DELETE and TRUNCATE). Mistakes are fixed
-- with a correction: a new entry pointing at the ORIGINAL entry (never at another
-- correction), with a mandatory reason. The newest correction is the current state;
-- the original and every correction stay readable. See docs/DATABASE.md.

-- Descriptive event categories, not legal classifications.
create type public.log_entry_type as enum (
  'inspection',   -- kontroll
  'maintenance',  -- hooldus
  'switching',    -- lülitamine
  'fault',        -- rike
  'repair',       -- remont
  'measurement',  -- mõõtmine
  'other'         -- muu
);

create table public.log_entries (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete restrict,
  site_id uuid not null,
  electrical_installation_id uuid not null,
  occurred_at timestamptz not null default now() check (occurred_at >= '1900-01-01'),
  entry_type public.log_entry_type not null,
  description text not null
    check (char_length(description) between 1 and 5000 and description = btrim(description)),
  result text check (char_length(result) between 1 and 2000),
  -- Who did the work; may differ from who recorded it, and may not be a KAIDLY user.
  performed_by_name text check (char_length(performed_by_name) between 1 and 200),
  -- Who recorded it. No foreign key: the record must outlive the account. Always set from
  -- the session by the trigger below; never client-writable.
  created_by uuid not null default auth.uid(),
  created_by_name text not null default '', -- always overwritten by the insert trigger
  created_at timestamptz not null default now(),
  correction_of_id uuid,
  correction_reason text
    check (char_length(correction_reason) between 1 and 1000 and correction_reason = btrim(correction_reason)),

  check ((correction_of_id is null) = (correction_reason is null)),

  -- Organisation, site and installation must agree. Together these make it impossible
  -- to file an entry under another tenant's site or installation, or under the wrong site.
  foreign key (site_id, organisation_id)
    references public.sites (id, organisation_id) on delete restrict,
  foreign key (electrical_installation_id, organisation_id)
    references public.electrical_installations (id, organisation_id) on delete restrict,
  foreign key (electrical_installation_id, site_id)
    references public.electrical_installations (id, site_id) on delete restrict,

  -- A correction belongs to the same installation as the entry it corrects.
  unique (id, electrical_installation_id),
  foreign key (correction_of_id, electrical_installation_id)
    references public.log_entries (id, electrical_installation_id) on delete restrict
);

create index log_entries_installation_occurred_idx
  on public.log_entries (electrical_installation_id, occurred_at desc);
create index log_entries_organisation_occurred_idx
  on public.log_entries (organisation_id, occurred_at desc);
create index log_entries_site_idx on public.log_entries (site_id, organisation_id);
create index log_entries_installation_site_idx
  on public.log_entries (electrical_installation_id, site_id);
create index log_entries_correction_of_idx
  on public.log_entries (correction_of_id) where correction_of_id is not null;

comment on table public.log_entries is
  'Operating log (käidupäevik). Append-only; corrections are new rows.';

-- ---------------------------------------------------------------------------
-- Insert rules
-- ---------------------------------------------------------------------------

create function private.log_entry_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_target_is_correction boolean;
begin
  -- The recorder is always the session user (also inside security definer RPCs).
  -- Only privileged maintenance without a session (seed data) may supply created_by.
  if v_user is not null then
    new.created_by := v_user;
  end if;
  if new.created_by is null then
    raise exception 'log_entry_without_author' using errcode = '23502';
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), p.email, 'Tundmatu')
    into new.created_by_name
    from public.profiles p
   where p.id = new.created_by;
  new.created_by_name := coalesce(new.created_by_name, 'Tundmatu');
  -- clock_timestamp, not now(): two corrections written in one transaction must still
  -- have a defined order ("newest correction wins").
  new.created_at := clock_timestamp();

  if new.occurred_at > now() + interval '5 minutes' then
    raise exception 'occurred_in_future' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.electrical_installations
     where id = new.electrical_installation_id and archived_at is not null
  ) then
    raise exception 'installation_archived' using errcode = 'P0001';
  end if;

  -- Corrections point at an original entry, never at another correction: one flat,
  -- unambiguous list of corrections per original.
  if new.correction_of_id is not null then
    select correction_of_id is not null
      into v_target_is_correction
      from public.log_entries
     where id = new.correction_of_id;
    if v_target_is_correction then
      raise exception 'correction_target_invalid' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger log_entry_before_insert
  before insert on public.log_entries
  for each row execute function private.log_entry_before_insert();

-- ---------------------------------------------------------------------------
-- Append-only
-- ---------------------------------------------------------------------------

create function private.log_entries_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'log_entries_append_only'
    using errcode = 'P0001',
          detail = 'Operating log entries are never changed. Add a correction instead.';
end;
$$;

create trigger log_entries_no_update_delete
  before update or delete on public.log_entries
  for each row execute function private.log_entries_append_only();

create trigger log_entries_no_truncate
  before truncate on public.log_entries
  for each statement execute function private.log_entries_append_only();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.log_entries enable row level security;

create policy "members read the operating log" on public.log_entries
  for select to authenticated
  using (organisation_id in (select private.org_ids('viewer')));

create policy "operators write the operating log" on public.log_entries
  for insert to authenticated
  with check (organisation_id in (select private.org_ids('operator')));

-- No update or delete policy, and no update/delete grant: append-only for every role.
grant select on table public.log_entries to authenticated;
grant insert (
  organisation_id, site_id, electrical_installation_id, occurred_at, entry_type,
  description, result, performed_by_name, correction_of_id, correction_reason
) on table public.log_entries to authenticated;

-- ---------------------------------------------------------------------------
-- Current state of each entry
-- ---------------------------------------------------------------------------

-- One row per original entry, with the values of its newest correction (if any).
-- security_invoker: the caller's RLS applies to every row read through the view.
create view public.log_entry_current
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
  (select count(*) from public.log_entries x where x.correction_of_id = o.id)::int as correction_count
from public.log_entries o
left join lateral (
  select c.*
    from public.log_entries c
   where c.correction_of_id = o.id
   order by c.created_at desc, c.id desc
   limit 1
) c on true
where o.correction_of_id is null;

grant select on public.log_entry_current to authenticated;
