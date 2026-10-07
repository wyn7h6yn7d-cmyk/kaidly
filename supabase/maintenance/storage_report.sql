-- KAIDLY storage consistency report — READ ONLY. Run by an operator of the platform
-- (e.g. in the SQL editor or psql as postgres); it changes nothing.
--
-- Incomplete uploads are expected occasionally (closed tab, lost signal). The uploader's
-- client removes its own failed uploads; anything left over shows up here. There is no
-- background worker by design (docs/DATABASE.md §10). Since 2026-10-08 nothing new is
-- uploaded (§5k); the bucket only holds files from before. A member may delete such a file
-- (delete_document_file): its row stays as a trace and only the object goes.

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
--    Link documents have no file; deleted files were removed on purpose.
select d.organisation_id, d.id, d.title, d.ready_at
  from public.documents d
 where d.status = 'ready'
   and d.storage_path is not null
   and d.deleted_at is null
   and not exists (select 1 from storage.objects o
                    where o.bucket_id = 'documents' and o.name = d.storage_path)
 order by d.ready_at;

-- 4. Deleted files whose removal did not finish (the member sees "Lõpeta
--    kustutamine" and can retry; the file is already unreadable).
select d.organisation_id, d.id, d.deleted_at, d.deleted_by_name,
       exists (select 1 from storage.objects o
                where o.bucket_id = 'documents' and o.name = d.storage_path) as object_exists
  from public.documents d
 where d.deleted_at is not null
   and d.file_removed_at is null
 order by d.deleted_at;

-- 5. Files still stored (could be deleted to free space), per company and type.
select d.organisation_id, d.mime_type, count(*) as files, sum(d.size_bytes) as bytes
  from public.documents d
 where d.storage_path is not null and d.file_removed_at is null
 group by d.organisation_id, d.mime_type
 order by bytes desc;

-- Cleanup of stale incomplete uploads is a manual, reviewed step: delete the object
-- through the Storage API (it sets storage.allow_delete_query) and then the pending
-- row. Never delete ready documents.
