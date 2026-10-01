-- KAIDLY: the window for adding files to a log entry is 24 hours (approved product
-- decision, 2026-10-02; was 1 hour).
--
-- During the first 24 hours after an operating-log entry is recorded, only its author may
-- add NEW attachments. The entry itself stays immutable and existing attachments can
-- never be modified, replaced or deleted (unchanged rules). Each attachment keeps its own
-- upload time (documents.created_at). After 24 hours, further evidence goes on a
-- correction entry. Only the interval changes below.

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
    if v_entry.created_by is distinct from v_user or v_entry.created_at < now() - interval '24 hours' then
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
