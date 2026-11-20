-- Periodic audits of electrical installations (owner decision 2026-11-20, docs/AUDITS.md).
--
-- * public.installation_audits — the history of completed periodic audits per installation
--   (date, result, auditing body, link to the audit document). Append-only like the
--   operating log: a mistake is fixed by recording the audit again; the latest row is
--   "Viimane korraline audit".
-- * "Järgmise korralise auditi tähtaeg" is a scheduled activity with kind 'periodic_audit'
--   (at most one live per installation, reminders 90 and 30 days before). That reuses the
--   one countdown implementation, the bell and the optional e-mail reminder — nothing is
--   computed a second time.
-- * Read: company members and site viewers (viewer_site_ids). Record: owners/admins of a
--   writable company.

-- ---------------------------------------------------------------------------
-- Next audit deadline = a kind of scheduled activity
-- ---------------------------------------------------------------------------

alter table public.scheduled_activities
  add column kind text not null default 'regular' check (kind in ('regular', 'periodic_audit'));

create unique index scheduled_activities_one_live_audit_idx
  on public.scheduled_activities (electrical_installation_id)
  where kind = 'periodic_audit' and archived_at is null;

grant insert (kind) on table public.scheduled_activities to authenticated;

comment on column public.scheduled_activities.kind is
  'regular | periodic_audit (the next periodic audit deadline; one live per installation).';

-- ---------------------------------------------------------------------------
-- Audit history
-- ---------------------------------------------------------------------------

create table public.installation_audits (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete restrict,
  site_id uuid not null,
  electrical_installation_id uuid not null,
  audited_on date not null check (audited_on >= '1990-01-01'),
  result text not null check (char_length(result) between 1 and 2000 and result = btrim(result)),
  auditor text not null check (char_length(auditor) between 1 and 200 and auditor = btrim(auditor)),
  document_url text check (
    document_url is null or (char_length(document_url) <= 2000
      and document_url ~ '^https://[^\s/?#@\\]+\.[^\s/?#@\\]+([/?#]\S*)?$')
  ),
  created_by uuid not null default auth.uid(),
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  foreign key (site_id, organisation_id) references public.sites (id, organisation_id) on delete restrict,
  foreign key (electrical_installation_id, organisation_id) references public.electrical_installations (id, organisation_id) on delete restrict,
  foreign key (electrical_installation_id, site_id) references public.electrical_installations (id, site_id) on delete restrict
);
alter table public.installation_audits enable row level security;

create index installation_audits_installation_idx on public.installation_audits (electrical_installation_id, audited_on desc, created_at desc);
create index installation_audits_site_idx on public.installation_audits (site_id, organisation_id);
create index installation_audits_org_idx on public.installation_audits (organisation_id);

-- Members only (checked first: BEFORE triggers run before RLS and the foreign keys); the
-- author is always the session user; no future audits.
create function private.installation_audit_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not private.has_org_role(new.organisation_id, 'viewer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  select coalesce(nullif(btrim(p.full_name), ''), p.email, 'Tundmatu') into new.created_by_name
    from public.profiles p where p.id = new.created_by;
  new.created_by_name := coalesce(new.created_by_name, 'Tundmatu');
  new.created_at := now();
  if new.audited_on > (now() at time zone 'Europe/Tallinn')::date then
    raise exception 'audit_in_future' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.installation_audit_before_insert() from public, anon, authenticated;

create trigger installation_audit_before_insert
  before insert on public.installation_audits
  for each row execute function private.installation_audit_before_insert();

create trigger prevent_organisation_change
  before update on public.installation_audits
  for each row execute function private.prevent_organisation_change();

create policy "members read audits" on public.installation_audits
  for select to authenticated
  using (organisation_id in (select private.org_ids('viewer')));

create policy "site viewers read audits" on public.installation_audits
  for select to authenticated
  using (site_id in (select private.viewer_site_ids()));

create policy "admins record audits" on public.installation_audits
  for insert to authenticated
  with check (organisation_id in (select private.org_ids('admin')));

grant select on table public.installation_audits to authenticated;
grant insert (organisation_id, site_id, electrical_installation_id, audited_on, result, auditor, document_url)
  on table public.installation_audits to authenticated;
