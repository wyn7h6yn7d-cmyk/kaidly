-- KAIDLY storage consistency report — READ ONLY. Run by an operator of the platform
-- (e.g. in the SQL editor or psql as postgres); it changes nothing.
--
-- Incomplete uploads are expected occasionally (closed tab, lost signal). The uploader's
-- client removes its own failed uploads; anything left over shows up here. There is no
-- background worker by design (docs/DATABASE.md §10). Ready documents are never
-- cleaned up: they are part of the operational record. The one exception is an image
-- uploaded before photo links, deleted by a member (delete_document_image): its row stays as
-- a trace and only the file goes.

-- 1. Pending or failed documents older than a day (never listed, never readable).
select d.organisation_id, d.id, d.status, d.created_at, d.size_bytes,
       exists (select 1 from storage.objects o
                where o.bucket_id = 'documents' and o.name = d.storage_path) as object_exists
  from public.documents d
 where d.status <> 'ready'
   and d.created_at < now() - interval '1 day'
 order by d.created_at;

-- 2. Objects in the documents bucket without any documents row (should be none: uploads
--    are only allowed to registered paths).
select o.name, o.created_at, (o.metadata ->> 'size')::bigint as size_bytes
  from storage.objects o
 where o.bucket_id = 'documents'
   and not exists (select 1 from public.documents d where d.storage_path = o.name)
 order by o.created_at;

-- 3. Ready documents whose object is missing (should be none — investigate immediately).
--    Deleted images are not missing: their file was removed on purpose.
select d.organisation_id, d.id, d.title, d.ready_at
  from public.documents d
 where d.status = 'ready'
   and d.deleted_at is null
   and not exists (select 1 from storage.objects o
                    where o.bucket_id = 'documents' and o.name = d.storage_path)
 order by d.ready_at;

-- 4. Deleted images whose file removal did not finish (the member sees "Lõpeta
--    kustutamine" and can retry; the file is already unreadable).
select d.organisation_id, d.id, d.deleted_at, d.deleted_by_name,
       exists (select 1 from storage.objects o
                where o.bucket_id = 'documents' and o.name = d.storage_path) as object_exists
  from public.documents d
 where d.deleted_at is not null
   and d.file_removed_at is null
 order by d.deleted_at;

-- 5. Images that could still be deleted to free space, largest companies first.
select d.organisation_id, count(*) as images, sum(d.size_bytes) as bytes
  from public.documents d
 where d.status = 'ready' and d.mime_type like 'image/%' and d.deleted_at is null
 group by d.organisation_id
 order by bytes desc;

-- Cleanup of stale incomplete uploads is a manual, reviewed step: delete the object
-- through the Storage API (it sets storage.allow_delete_query) and then the pending
-- row. Never delete ready documents.
