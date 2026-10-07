-- KAIDLY: photo links instead of photo uploads, and deleting existing images.
--
-- Storage capacity is limited and photos fill it quickly, so KAIDLY stops storing new
-- images. Log entries and deficiencies get an optional external photo link (a folder or
-- album elsewhere, https only). PDF/DOCX/XLSX documents keep working as before.
--
-- Images uploaded earlier stay readable and can now be deleted (owner decision
-- 2026-10-08): the file is removed from Storage, but the documents row stays as a
-- tombstone ("image deleted by …, at …"), so the operational record still shows that a
-- photo existed. Nothing else about historical attachments changes.
--
-- Additive only: two nullable columns, four nullable tombstone columns, no data moved.

-- ---------------------------------------------------------------------------
-- 1. Photo links
-- ---------------------------------------------------------------------------

-- https, a host with a dot, no credentials, no whitespace; the app normalises with the URL
-- parser before saving. Displayed only as a link (rel="noopener noreferrer"), never fetched.
alter table public.log_entries
  add column photos_url text
  check (photos_url is null or (char_length(photos_url) <= 2000
         and photos_url ~ '^https://[^\s/?#@\\]+\.[^\s/?#@\\]+([/?#]\S*)?$'));
alter table public.deficiencies
  add column photos_url text
  check (photos_url is null or (char_length(photos_url) <= 2000
         and photos_url ~ '^https://[^\s/?#@\\]+\.[^\s/?#@\\]+([/?#]\S*)?$'));

comment on column public.log_entries.photos_url is
  'Optional external link to the photos of this entry (https). Set when the entry is recorded; a correction carries its own.';
comment on column public.deficiencies.photos_url is
  'Optional external link to the photos of this deficiency (https). Editable until resolved.';

-- Log entries stay append-only: the link is part of the insert, like every other field.
grant insert (photos_url) on table public.log_entries to authenticated;
-- Deficiencies: changeable with the other fields until resolved (deficiency_before_update).
grant insert (photos_url), update (photos_url) on table public.deficiencies to authenticated;

-- ---------------------------------------------------------------------------
-- 2. No new images
-- ---------------------------------------------------------------------------

-- Signed-in users can no longer register image documents. (Maintenance without a session,
-- e.g. a restore, can still write the rows that already exist.)
create function private.document_no_new_images()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and new.mime_type like 'image/%' then
    raise exception 'image_uploads_disabled' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger document_no_new_images
  before insert on public.documents
  for each row execute function private.document_no_new_images();

-- Storage refuses image bytes as well. Existing image objects stay readable (the bucket's
-- type list applies to uploads only).
update storage.buckets
   set allowed_mime_types = array[
     'application/pdf',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
   ]
 where id = 'documents';

-- ---------------------------------------------------------------------------
-- 3. Deleting existing images (tombstone + file removal)
-- ---------------------------------------------------------------------------

alter table public.documents
  add column deleted_at timestamptz,
  add column deleted_by uuid,
  add column deleted_by_name text,
  add column file_removed_at timestamptz,
  add constraint documents_deleted_consistent
    check ((deleted_at is null) = (deleted_by_name is null)
           and (file_removed_at is null or deleted_at is not null)
           and (deleted_at is null or (status = 'ready' and mime_type like 'image/%')));

comment on column public.documents.deleted_at is
  'Image deleted (delete_document_image): the row stays as a trace, the file is no longer readable.';
comment on column public.documents.file_removed_at is
  'The Storage object of a deleted image is confirmed gone (confirm_document_image_removed).';

-- The tombstone columns are not granted to API roles; only the two functions below set
-- them. Once deleted, a row never changes again except for confirming the file removal.
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
          or new.title is distinct from old.title
          or new.category is distinct from old.category
          or new.archived_at is distinct from old.archived_at
          or new.status is distinct from old.status
          or (old.file_removed_at is not null and new.file_removed_at is distinct from old.file_removed_at)) then
    raise exception 'document_immutable' using errcode = 'P0001';
  end if;
  if (old.log_entry_id is not null or old.deficiency_id is not null)
     and old.status = 'ready'
     and (new.title is distinct from old.title
          or new.category is distinct from old.category
          or new.archived_at is distinct from old.archived_at
          or new.status is distinct from old.status) then
    raise exception 'document_immutable' using errcode = 'P0001';
  end if;
  if old.status = 'ready' and new.status <> 'ready' then
    raise exception 'document_immutable' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Step 1 of deleting an image: marks it deleted (unreadable from now on) and returns the
-- object path for the caller to remove through the Storage API with their own session.
-- Who may delete = who may add such a file: operators for attachments of log entries and
-- deficiencies, admins for general documents. Viewers, other companies, read-only
-- (deactivated/expired) companies and non-images get not_found. Repeating it on an image
-- that is already deleted but whose file is still there returns the path again (retry).
create function public.delete_document_image(p_document_id uuid)
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
     or v_doc.mime_type not like 'image/%'
     or not private.has_org_role(
          v_doc.organisation_id,
          case when v_doc.log_entry_id is not null or v_doc.deficiency_id is not null
               then 'operator' else 'admin' end::public.org_role) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if v_doc.deleted_at is not null then
    if v_doc.file_removed_at is not null then
      raise exception 'image_already_deleted' using errcode = 'P0001';
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

-- Step 2: records that the object is really gone. Returns false while it still exists
-- (the removal failed; the caller retries step 1 → Storage → step 2).
create function public.confirm_document_image_removed(p_document_id uuid)
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

revoke execute on function public.delete_document_image(uuid) from public, anon;
revoke execute on function public.confirm_document_image_removed(uuid) from public, anon;
grant execute on function public.delete_document_image(uuid) to authenticated;
grant execute on function public.confirm_document_image_removed(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Storage policies
-- ---------------------------------------------------------------------------

-- A deleted image is unreadable at once, even while its object still exists.
drop policy "kaidly documents: read ready files" on storage.objects;
create policy "kaidly documents: read ready files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.documents d
       where d.storage_path = storage.objects.name and d.status = 'ready' and d.deleted_at is null
    )
  );

-- The object of a deleted image may be removed by an operator+ of its company (the
-- deletion itself was authorised by delete_document_image). Nothing else ready is ever
-- removable.
create policy "kaidly documents: remove deleted images" on storage.objects
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

-- Storage deletes with `DELETE … RETURNING`, so Postgres also applies SELECT policies to the
-- rows being removed. Without this policy the two delete policies above could never match:
-- the uploader's failed uploads were left behind in Storage (their rows were removed, the
-- objects stayed), and a deleted image's object could not be removed. It makes exactly the
-- removable objects visible to the people allowed to remove them: own incomplete uploads,
-- and images already marked deleted (until the file is confirmed gone). The app never
-- signs URLs for either (it reads only ready, undeleted rows).
create policy "kaidly documents: see removable files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.documents d
       where d.storage_path = storage.objects.name
         and (
           (d.status <> 'ready' and d.uploaded_by = (select auth.uid())
            and d.organisation_id in (select private.org_ids('operator')))
           or (d.deleted_at is not null and d.file_removed_at is null
               and d.organisation_id in (select private.org_ids('operator')))
         )
    )
  );
