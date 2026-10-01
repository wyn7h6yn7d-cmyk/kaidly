-- KAIDLY Phase 3: sites and electrical installations.
--
-- Organisation → Site → Electrical installation. Nothing deeper: no asset trees,
-- sub-assets, inventory or equipment hierarchies.
--
-- Owners and admins create, edit and archive; operators and viewers read.
-- Records are archived, never deleted through the API.
--
-- DOMAIN REVIEW PENDING (docs/PRODUCT.md §8): the installation type list, the status
-- values and the meaning of "responsible person" must be validated by an electrical
-- operations professional before this phase is considered final.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- DOMAIN REVIEW PENDING: descriptive categories only, not a regulatory classification.
create type public.installation_type as enum (
  'building',     -- hoone elektripaigaldis
  'switchboard',  -- jaotuskilp / -keskus
  'substation',   -- alajaam
  'solar',        -- päikeseelektrijaam
  'storage',      -- energiasalvesti
  'charging',     -- laadimistaristu
  'industrial',   -- tööstuslik paigaldis
  'other'
);

-- DOMAIN REVIEW PENDING: whether two operational states are enough.
create type public.installation_status as enum (
  'in_service',     -- kasutuses
  'out_of_service'  -- kasutusest väljas
);

-- ---------------------------------------------------------------------------
-- sites
-- ---------------------------------------------------------------------------

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name text not null
    check (char_length(name) between 1 and 200 and name = btrim(name)),
  address text check (char_length(address) <= 300),
  description text check (char_length(description) <= 5000),
  -- Free text: the person may not be a KAIDLY user (DOMAIN REVIEW PENDING).
  responsible_person text check (char_length(responsible_person) <= 200),
  archived_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target for composite foreign keys from child tables.
  unique (id, organisation_id)
);

create index sites_organisation_name_idx on public.sites (organisation_id, name);
create index sites_created_by_idx on public.sites (created_by);

comment on table public.sites is 'A physical location (objekt) of an organisation.';

-- ---------------------------------------------------------------------------
-- electrical_installations
-- ---------------------------------------------------------------------------

create table public.electrical_installations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  site_id uuid not null,
  name text not null
    check (char_length(name) between 1 and 200 and name = btrim(name)),
  -- Short designation on site, e.g. "PJK-1".
  identifier text
    check (char_length(identifier) between 1 and 50 and identifier = btrim(identifier)),
  installation_type public.installation_type not null,
  -- Where on the site, e.g. "Kelder, elektriruum 012".
  location text check (char_length(location) <= 200),
  description text check (char_length(description) <= 5000),
  commissioned_on date check (commissioned_on between '1900-01-01' and '2100-12-31'),
  status public.installation_status not null default 'in_service',
  -- Free text (DOMAIN REVIEW PENDING: whether this is the käidukorraldaja).
  responsible_person text check (char_length(responsible_person) <= 200),
  notes text check (char_length(notes) <= 5000),
  archived_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The site must belong to the same organisation — enforced by the database, so no
  -- application bug can attach an installation to another tenant's site.
  foreign key (site_id, organisation_id)
    references public.sites (id, organisation_id) on delete cascade,
  unique (id, organisation_id),
  unique (id, site_id)
);

create index electrical_installations_site_idx on public.electrical_installations (site_id);
create index electrical_installations_site_org_idx
  on public.electrical_installations (site_id, organisation_id);
create index electrical_installations_organisation_name_idx
  on public.electrical_installations (organisation_id, name);
create index electrical_installations_created_by_idx on public.electrical_installations (created_by);

comment on table public.electrical_installations is
  'An electrical installation (elektripaigaldis) at a site. Master data only.';

-- New installations can't be added to, or moved onto, an archived site.
create function private.ensure_site_active()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.site_id is distinct from old.site_id then
    if exists (
      select 1 from public.sites
       where id = new.site_id and archived_at is not null
    ) then
      raise exception 'site_archived' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger ensure_site_active
  before insert or update of site_id on public.electrical_installations
  for each row execute function private.ensure_site_active();

-- ---------------------------------------------------------------------------
-- Shared triggers
-- ---------------------------------------------------------------------------

create trigger set_updated_at
  before update on public.sites
  for each row execute function private.set_updated_at();
create trigger prevent_organisation_change
  before update on public.sites
  for each row execute function private.prevent_organisation_change();
create trigger record_history
  after insert or update on public.sites
  for each row execute function private.record_history();

create trigger set_updated_at
  before update on public.electrical_installations
  for each row execute function private.set_updated_at();
create trigger prevent_organisation_change
  before update on public.electrical_installations
  for each row execute function private.prevent_organisation_change();
create trigger record_history
  after insert or update on public.electrical_installations
  for each row execute function private.record_history();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.sites enable row level security;
alter table public.electrical_installations enable row level security;

create policy "members read sites" on public.sites
  for select to authenticated
  using (organisation_id in (select private.org_ids('viewer')));

create policy "admins create sites" on public.sites
  for insert to authenticated
  with check (organisation_id in (select private.org_ids('admin')));

create policy "admins update sites" on public.sites
  for update to authenticated
  using (organisation_id in (select private.org_ids('admin')))
  with check (organisation_id in (select private.org_ids('admin')));

create policy "members read installations" on public.electrical_installations
  for select to authenticated
  using (organisation_id in (select private.org_ids('viewer')));

create policy "admins create installations" on public.electrical_installations
  for insert to authenticated
  with check (organisation_id in (select private.org_ids('admin')));

create policy "admins update installations" on public.electrical_installations
  for update to authenticated
  using (organisation_id in (select private.org_ids('admin')))
  with check (organisation_id in (select private.org_ids('admin')));

-- Column grants: ids, organisation, creator and timestamps are never client-writable.
grant select on table public.sites to authenticated;
grant insert (organisation_id, name, address, description, responsible_person)
  on table public.sites to authenticated;
grant update (name, address, description, responsible_person, archived_at)
  on table public.sites to authenticated;

grant select on table public.electrical_installations to authenticated;
grant insert (
  organisation_id, site_id, name, identifier, installation_type, location, description,
  commissioned_on, status, responsible_person, notes
) on table public.electrical_installations to authenticated;
grant update (
  site_id, name, identifier, installation_type, location, description,
  commissioned_on, status, responsible_person, notes, archived_at
) on table public.electrical_installations to authenticated;
