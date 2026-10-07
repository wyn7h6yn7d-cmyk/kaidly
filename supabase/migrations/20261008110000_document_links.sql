-- KAIDLY: no user files in Storage at all — documents become links.
--
-- Owner decision 2026-10-08 (follow-up to `photo_links`): KAIDLY stores no customer files —
-- no photos, PDFs, DOCX, XLSX or anything else. "Dokumendid" stays as a document register:
-- each record holds a title, category, placement and an external https link to wherever
-- the company keeps the file. Log entries and deficiencies keep their photo link.
--
-- Files uploaded earlier stay readable until an authorised member deletes them: the file
-- is removed from Storage (space freed), the row stays as a trace, and a general document
-- can get an external link afterwards. Nothing is deleted by this migration.
--
-- Additive / relaxing only: one nullable column, file columns become nullable for link
-- records, no column or data removed.

-- ---------------------------------------------------------------------------
-- 1. Link documents
-- ---------------------------------------------------------------------------

alter table public.documents
  add column external_url text
    check (external_url is null or (char_length(external_url) <= 2000
           and external_url ~ '^https://[^\s/?#@\\]+\.[^\s/?#@\\]+([/?#]\S*)?$')),
  alter column storage_path drop not null,
  alter column storage_path drop default,
  alter column original_filename drop not null,
  alter column mime_type drop not null,
  alter column size_bytes drop not null,
  -- A record is a stored file (all file columns set) or a link (none set) — and every
  -- record has at least one of them.
  add constraint documents_file_or_link
    check (num_nulls(storage_path, original_filename, mime_type, size_bytes) in (0, 4)
           and (storage_path is not null or external_url is not null)),
  -- Attachments of log entries and deficiencies exist only as files from before; there
  -- are no link attachments (records use their photo link).
  add constraint documents_links_are_general
    check (storage_path is not null or (log_entry_id is null and deficiency_id is null));

comment on column public.documents.external_url is
  'External https link to the document (any provider). The only way to add a document since 2026-10-08; also allowed on a general document whose file was uploaded earlier.';

-- Deleting is now possible for any earlier file, not only images.
alter table public.documents drop constraint documents_deleted_consistent;
alter table public.documents add constraint documents_deleted_consistent
  check ((deleted_at is null) = (deleted_by_name is null)
         and (file_removed_at is null or deleted_at is not null)
         and (deleted_at is null or (status = 'ready' and storage_path is not null)));

grant insert (external_url), update (external_url) on table public.documents to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Inserts: links only for signed-in users
-- ---------------------------------------------------------------------------

drop trigger document_no_new_images on public.documents;
drop function private.document_no_new_images();

-- Signed-in users create link records only: any file metadata or a log-entry / deficiency
-- placement is refused (`file_uploads_disabled`), the link is required, and the record is
-- ready at once. Maintenance without a session (seed, restore) may still write file rows,
-- which get a generated object path as before.
create or replace function private.document_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  -- Members only, checked before anything else: these triggers run before RLS and the
  -- foreign keys, so a non-member must get the same error RLS would give.
  if v_user is not null and not private.has_org_role(new.organisation_id, 'viewer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_user is not null then
    new.uploaded_by := v_user;
    if new.mime_type is not null or new.size_bytes is not null or new.original_filename is not null
       or new.log_entry_id is not null or new.deficiency_id is not null then
      raise exception 'file_uploads_disabled' using errcode = 'P0001';
    end if;
    if new.external_url is null then
      raise exception 'document_link_required' using errcode = '23514';
    end if;
  end if;
  if new.uploaded_by is null then
    raise exception 'document_without_uploader' using errcode = '23502';
  end if;
  select coalesce(nullif(btrim(p.full_name), ''), p.email, 'Tundmatu')
    into new.uploaded_by_name from public.profiles p where p.id = new.uploaded_by;
  new.uploaded_by_name := coalesce(new.uploaded_by_name, 'Tundmatu');

  -- Object key only for file rows (maintenance); link records have none.
  new.storage_path := case when new.mime_type is not null
    then new.organisation_id::text || '/' || new.id::text || '/' || gen_random_uuid()::text end;
  new.created_at := now();
  -- A link has nothing to upload: it is ready at once (also when written by maintenance).
  if new.storage_path is null then
    new.status := 'ready';
    new.ready_at := coalesce(new.ready_at, now());
  end if;
  if v_user is not null then
    new.status := 'ready';
    new.ready_at := now();
    new.archived_at := null;
    new.deleted_at := null;
    new.deleted_by := null;
    new.deleted_by_name := null;
    new.file_removed_at := null;
  end if;

  if new.electrical_installation_id is not null and exists (
    select 1 from public.electrical_installations
     where id = new.electrical_installation_id and organisation_id = new.organisation_id
       and archived_at is not null
  ) then
    raise exception 'installation_archived' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Upload abuse limits counted bytes of stored files; link records store nothing.
create or replace function private.document_upload_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l private.upload_limits;
  v_user uuid := auth.uid();
begin
  if v_user is null or new.storage_path is null then
    return new; -- maintenance, or a link record (no file)
  end if;
  select * into l from private.upload_limits;
  perform pg_advisory_xact_lock(hashtext('kaidly-upload:' || v_user::text));
  if (select count(*) from private.upload_events where user_id = v_user and created_at > now() - interval '1 hour') >= l.per_user_hour
     or (select count(*) from private.upload_events where user_id = v_user and created_at > now() - interval '24 hours') >= l.per_user_day
     or (select coalesce(sum(size_bytes), 0) from private.upload_events where user_id = v_user and created_at > now() - interval '24 hours') + new.size_bytes > l.bytes_per_user_day
     or (select count(*) from public.documents where uploaded_by = v_user and status = 'pending') >= l.pending_per_user
     or (select count(*) from private.upload_events where organisation_id = new.organisation_id and created_at > now() - interval '24 hours') >= l.per_org_day
     or (select coalesce(sum(size_bytes), 0) from private.upload_events where organisation_id = new.organisation_id and created_at > now() - interval '24 hours') + new.size_bytes > l.bytes_per_org_day
  then
    raise exception 'upload_rate_limited' using errcode = 'P0001';
  end if;
  insert into private.upload_events (user_id, organisation_id, size_bytes) values (v_user, new.organisation_id, new.size_bytes);
  return new;
end;
$$;

-- No upload can ever be finalized again: there are no new pending files.
drop function public.finalize_document(uuid);

-- ---------------------------------------------------------------------------
-- 3. Updates
-- ---------------------------------------------------------------------------

-- File facts never change. Attachments of log entries and deficiencies stay fixed. A
-- deleted file stays deleted (no undo, no second file); a general document whose file was
-- deleted can still be renamed, recategorised, archived and get an external link.
create or replace function private.document_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.storage_path is distinct from old.storage_path
     or new.organisation_id is distinct from old.organisation_id
     or new.site_id is distinct from old.site_id
     or new.electrical_installation_id is distinct from old.electrical_installation_id
     or new.log_entry_id is distinct from old.log_entry_id
     or new.deficiency_id is distinct from old.deficiency_id
     or new.mime_type is distinct from old.mime_type
     or new.size_bytes is distinct from old.size_bytes
     or new.original_filename is distinct from old.original_filename
     or new.uploaded_by is distinct from old.uploaded_by then
    raise exception 'document_immutable' using errcode = 'P0001';
  end if;
  if old.deleted_at is not null
     and (new.deleted_at is distinct from old.deleted_at
          or new.deleted_by is distinct from old.deleted_by
          or new.deleted_by_name is distinct from old.deleted_by_name
          or new.status is distinct from old.status
          or (old.file_removed_at is not null and new.file_removed_at is distinct from old.file_removed_at)) then
    raise exception 'document_immutable' using errcode = 'P0001';
  end if;
  if (old.log_entry_id is not null or old.deficiency_id is not null)
     and old.status = 'ready'
     and (new.title is distinct from old.title
          or new.category is distinct from old.category
          or new.archived_at is distinct from old.archived_at
          or new.status is distinct from old.status
          or new.external_url is distinct from old.external_url) then
    raise exception 'document_immutable' using errcode = 'P0001';
  end if;
  if old.status = 'ready' and new.status <> 'ready' then
    raise exception 'document_immutable' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Deleting earlier files (any type; replaces the image-only functions)
-- ---------------------------------------------------------------------------

drop function public.delete_document_image(uuid);
drop function public.confirm_document_image_removed(uuid);

-- Step 1: marks the file deleted (unreadable from now on) and returns the object path for
-- the caller to remove through the Storage API with their own session. Operators delete
-- attachments of log entries and deficiencies, admins general documents. Viewers, other
-- companies, read-only companies, link records and incomplete uploads get not_found.
create function public.delete_document_file(p_document_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_doc public.documents%rowtype;
  v_name text;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_doc from public.documents where id = p_document_id for update;
  if not found
     or v_doc.status <> 'ready'
     or v_doc.storage_path is null
     or not private.has_org_role(
          v_doc.organisation_id,
          case when v_doc.log_entry_id is not null or v_doc.deficiency_id is not null
               then 'operator' else 'admin' end::public.org_role) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if v_doc.deleted_at is not null then
    if v_doc.file_removed_at is not null then
      raise exception 'file_already_deleted' using errcode = 'P0001';
    end if;
    return v_doc.storage_path;
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), p.email, 'Tundmatu')
    into v_name from public.profiles p where p.id = v_user;

  update public.documents
     set deleted_at = now(), deleted_by = v_user, deleted_by_name = coalesce(v_name, 'Tundmatu')
   where id = v_doc.id;
  return v_doc.storage_path;
end;
$$;

-- Step 2: records that the object is really gone (false while it still exists).
create function public.confirm_document_file_removed(p_document_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_doc public.documents%rowtype;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_doc from public.documents where id = p_document_id for update;
  if not found
     or v_doc.deleted_at is null
     or not private.has_org_role(v_doc.organisation_id, 'operator') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_doc.file_removed_at is not null then
    return true;
  end if;
  if exists (select 1 from storage.objects o
              where o.bucket_id = 'documents' and o.name = v_doc.storage_path) then
    return false;
  end if;

  update public.documents set file_removed_at = now() where id = v_doc.id;
  return true;
end;
$$;

revoke execute on function public.delete_document_file(uuid) from public, anon;
revoke execute on function public.confirm_document_file_removed(uuid) from public, anon;
grant execute on function public.delete_document_file(uuid) to authenticated;
grant execute on function public.confirm_document_file_removed(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Storage: nothing can be uploaded any more
-- ---------------------------------------------------------------------------

-- Without an INSERT policy no signed-in user can put an object into the bucket, whatever
-- the type or path. Reading earlier files and removing them stay as before.
drop policy "kaidly documents: upload registered pending files" on storage.objects;

drop policy "kaidly documents: remove deleted images" on storage.objects;
create policy "kaidly documents: remove deleted files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.documents d
       where d.storage_path = storage.objects.name
         and d.deleted_at is not null
         and d.file_removed_at is null
         and d.organisation_id in (select private.org_ids('operator'))
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Platform admin: storage figures count files still stored
-- ---------------------------------------------------------------------------

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Tallinn')::date;
begin
  perform private.require_platform_admin();
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_active_30d', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'companies', (select count(*) from public.organisations),
    'companies_active', (select count(*) from public.organisations where deactivated_at is null),
    'companies_deactivated', (select count(*) from public.organisations where deactivated_at is not null),
    'sites', (select count(*) from public.sites),
    'installations', (select count(*) from public.electrical_installations),
    'activities_overdue', (select count(*) from public.scheduled_activities a join public.organisations o on o.id = a.organisation_id
                            where a.archived_at is null and o.deactivated_at is null and a.next_due_on < v_today),
    'activities_due_soon', (select count(*) from public.scheduled_activities a join public.organisations o on o.id = a.organisation_id
                             where a.archived_at is null and o.deactivated_at is null and a.next_due_on between v_today and v_today + 14),
    'deficiencies_open', (select count(*) from public.deficiencies d join public.organisations o on o.id = d.organisation_id
                           where d.status <> 'resolved' and o.deactivated_at is null),
    'deficiencies_serious', (select count(*) from public.deficiencies d join public.organisations o on o.id = d.organisation_id
                              where d.status <> 'resolved' and d.severity in ('high', 'critical') and o.deactivated_at is null),
    'documents', (select count(*) from public.documents where status = 'ready'),
    'stored_files', (select count(*) from public.documents where storage_path is not null and file_removed_at is null),
    'storage_bytes', (select coalesce(sum(size_bytes), 0) from public.documents where storage_path is not null and file_removed_at is null),
    'log_entries_30d', (select count(*) from public.log_entries where created_at > now() - interval '30 days')
  );
end;
$$;

create or replace function public.admin_company(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Tallinn')::date;
  v_company jsonb;
begin
  perform private.require_platform_admin();
  select jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug, 'registry_code', o.registry_code,
                            'contact_email', o.contact_email, 'contact_phone', o.contact_phone, 'address', o.address,
                            'created_at', o.created_at, 'deactivated_at', o.deactivated_at)
    into v_company from public.organisations o where o.id = p_org;
  if v_company is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'company', v_company,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('membership_id', m.id, 'user_id', m.user_id, 'name', p.full_name, 'email', p.email,
                                          'role', m.role, 'joined_at', m.created_at)
                       order by case m.role when 'owner' then 0 when 'admin' then 1 when 'operator' then 2 else 3 end, p.full_name)
        from public.organisation_members m join public.profiles p on p.id = m.user_id
       where m.organisation_id = p_org), '[]'::jsonb),
    'counts', jsonb_build_object(
      'sites', (select count(*) from public.sites where organisation_id = p_org),
      'installations', (select count(*) from public.electrical_installations where organisation_id = p_org),
      'log_entries', (select count(*) from public.log_entries where organisation_id = p_org),
      'activities', (select count(*) from public.scheduled_activities where organisation_id = p_org and archived_at is null),
      'overdue', (select count(*) from public.scheduled_activities where organisation_id = p_org and archived_at is null and next_due_on < v_today),
      'due_soon', (select count(*) from public.scheduled_activities where organisation_id = p_org and archived_at is null and next_due_on between v_today and v_today + 14),
      'deficiencies_open', (select count(*) from public.deficiencies where organisation_id = p_org and status <> 'resolved'),
      'deficiencies_serious', (select count(*) from public.deficiencies where organisation_id = p_org and status <> 'resolved' and severity in ('high', 'critical')),
      'documents', (select count(*) from public.documents where organisation_id = p_org and status = 'ready'),
      'stored_files', (select count(*) from public.documents where organisation_id = p_org and storage_path is not null and file_removed_at is null),
      'storage_bytes', (select coalesce(sum(size_bytes), 0) from public.documents where organisation_id = p_org and storage_path is not null and file_removed_at is null)),
    'recent', coalesce((
      select jsonb_agg(r order by r.created_at desc) from (
        select h.created_at, h.table_name, h.action, coalesce(nullif(p.full_name, ''), p.email) as actor
          from public.activity_history h left join public.profiles p on p.id = h.actor_id
         where h.organisation_id = p_org
         order by h.created_at desc limit 15) r), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_system()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return jsonb_build_object(
    'latest_migration', (select max(version) from supabase_migrations.schema_migrations),
    'migrations', (select count(*) from supabase_migrations.schema_migrations),
    'users', (select count(*) from auth.users),
    'companies', (select count(*) from public.organisations),
    'documents', (select count(*) from public.documents where status = 'ready'),
    'pending_uploads', (select count(*) from public.documents where status <> 'ready'),
    'stored_files', (select count(*) from public.documents where storage_path is not null and file_removed_at is null),
    'storage_bytes', (select coalesce(sum(size_bytes), 0) from public.documents where storage_path is not null and file_removed_at is null),
    'platform_admins', (select count(*) from private.platform_admins where active)
  );
end;
$$;
