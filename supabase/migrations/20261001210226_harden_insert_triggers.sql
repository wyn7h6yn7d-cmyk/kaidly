-- KAIDLY security hardening: no cross-tenant oracles in BEFORE triggers.
--
-- These security definer triggers run before RLS WITH CHECK and before the foreign keys.
-- Their lookups were not scoped to the row's organisation, so a member of organisation A
-- inserting a row that names organisation B's installation (or site, log entry, deficiency)
-- got a specific error ("installation_archived", "site_archived", …) when that row exists
-- in B with that state, and a generic foreign-key error otherwise — revealing existence and
-- state of another tenant's records to anyone who knows a UUID.
--
-- Now every such trigger (1) refuses callers who are not members of the row's organisation
-- with the same error RLS gives, and (2) scopes every lookup to new.organisation_id, so
-- foreign ids fall through to the generic foreign-key error. Behaviour for legitimate
-- writes is unchanged.


create or replace function private.ensure_site_active()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 set search_path = ''
AS $$
begin
  -- Members only, checked before anything else: these triggers run before RLS and the
  -- foreign keys, so a non-member must get the same error RLS would give.
  if auth.uid() is not null and not private.has_org_role(new.organisation_id, 'viewer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' or new.site_id is distinct from old.site_id then
    if exists (
      select 1 from public.sites
       where id = new.site_id and organisation_id = new.organisation_id
         and archived_at is not null
    ) then
      raise exception 'site_archived' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.log_entry_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 set search_path = ''
AS $$
declare
  v_user uuid := auth.uid();
  v_target_is_correction boolean;
begin
  -- Members only, checked before anything else: these triggers run before RLS and the
  -- foreign keys, so a non-member must get the same error RLS would give.
  if auth.uid() is not null and not private.has_org_role(new.organisation_id, 'viewer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

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
     where id = new.electrical_installation_id and organisation_id = new.organisation_id
       and archived_at is not null
  ) then
    raise exception 'installation_archived' using errcode = 'P0001';
  end if;

  -- Corrections point at an original entry, never at another correction: one flat,
  -- unambiguous list of corrections per original.
  if new.correction_of_id is not null then
    select correction_of_id is not null
      into v_target_is_correction
      from public.log_entries
     where id = new.correction_of_id and organisation_id = new.organisation_id;
    if v_target_is_correction then
      raise exception 'correction_target_invalid' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.deficiency_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 set search_path = ''
AS $$
declare
  v_user uuid := auth.uid();
begin
  -- Members only, checked before anything else: these triggers run before RLS and the
  -- foreign keys, so a non-member must get the same error RLS would give.
  if auth.uid() is not null and not private.has_org_role(new.organisation_id, 'viewer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
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
     where id = new.electrical_installation_id and organisation_id = new.organisation_id
       and archived_at is not null
  ) then
    raise exception 'installation_archived' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function private.document_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 set search_path = ''
AS $$
declare
  v_user uuid := auth.uid();
  v_entry record;
begin
  -- Members only, checked before anything else: these triggers run before RLS and the
  -- foreign keys, so a non-member must get the same error RLS would give.
  if auth.uid() is not null and not private.has_org_role(new.organisation_id, 'viewer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_user is not null then
    new.uploaded_by := v_user;
  end if;
  if new.uploaded_by is null then
    raise exception 'document_without_uploader' using errcode = '23502';
  end if;
  select coalesce(nullif(btrim(p.full_name), ''), p.email, 'Tundmatu')
    into new.uploaded_by_name from public.profiles p where p.id = new.uploaded_by;
  new.uploaded_by_name := coalesce(new.uploaded_by_name, 'Tundmatu');

  -- Server-generated, collision-free object key.
  new.storage_path := new.organisation_id::text || '/' || new.id::text || '/' || gen_random_uuid()::text;
  new.created_at := now();
  -- Seed/maintenance without a session may insert ready rows; users always start pending.
  if v_user is not null then
    new.status := 'pending';
    new.ready_at := null;
    new.archived_at := null;
  end if;

  if new.electrical_installation_id is not null and exists (
    select 1 from public.electrical_installations
     where id = new.electrical_installation_id and organisation_id = new.organisation_id
       and archived_at is not null
  ) then
    raise exception 'installation_archived' using errcode = 'P0001';
  end if;

  if new.log_entry_id is not null and v_user is not null then
    select created_by, created_at into v_entry from public.log_entries
     where id = new.log_entry_id and organisation_id = new.organisation_id;
    if v_entry.created_by is distinct from v_user or v_entry.created_at < now() - interval '1 hour' then
      raise exception 'log_entry_attachment_closed' using errcode = 'P0001';
    end if;
  end if;

  if new.deficiency_id is not null and exists (
    select 1 from public.deficiencies
     where id = new.deficiency_id and organisation_id = new.organisation_id and status = 'resolved'
  ) then
    raise exception 'deficiency_resolved' using errcode = 'P0001';
  end if;

  return new;
end;
$$;
