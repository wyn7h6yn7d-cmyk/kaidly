-- Photo links instead of photo uploads, and deleting images uploaded earlier
-- (migration photo_links): https-only links on log entries and deficiencies, no new image
-- documents, the delete RPCs (roles, tenants, tombstone, retry), the storage policies that
-- make the file removable, and the failed-upload cleanup that now really removes objects.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

insert into public.log_entries (id, organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
values ('e2300000-0000-4000-8000-0000000000a1', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'A kanne', pg_temp.uid('a_operator'));
insert into public.deficiencies (id, organisation_id, site_id, electrical_installation_id, title, description, severity, created_by)
values ('df230000-0000-4000-8000-0000000000a1', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Puudus', 'Kirjeldus', 'high', pg_temp.uid('a_operator')),
       ('df230000-0000-4000-8000-0000000000a2', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Teine', 'Kirjeldus', 'low', pg_temp.uid('a_operator'));

-- Images uploaded before photo links (as postgres, like existing Production rows):
-- i1 on a log entry, i2 on a deficiency, i3 a general installation image, i4 in tenant B,
-- p1 a PDF on the log entry.
insert into public.documents (id, organisation_id, site_id, electrical_installation_id, log_entry_id, deficiency_id, category, title, original_filename, mime_type, size_bytes, status, ready_at, uploaded_by)
values
  ('d2300000-0000-4000-8000-0000000000a1', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'e2300000-0000-4000-8000-0000000000a1', null, 'photo', 'Kilp', 'kilp.jpg', 'image/jpeg', 2000, 'ready', now(), pg_temp.uid('a_operator')),
  ('d2300000-0000-4000-8000-0000000000a2', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), null, 'df230000-0000-4000-8000-0000000000a1', 'photo', 'Lukk', 'lukk.png', 'image/png', 3000, 'ready', now(), pg_temp.uid('a_operator')),
  ('d2300000-0000-4000-8000-0000000000a3', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), null, null, 'photo', 'Üldfoto', 'yld.webp', 'image/webp', 4000, 'ready', now(), pg_temp.uid('a_admin')),
  ('d2300000-0000-4000-8000-0000000000b1', pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), null, null, 'photo', 'B foto', 'b.jpg', 'image/jpeg', 5000, 'ready', now(), pg_temp.uid('b_admin')),
  ('d2300000-0000-4000-8000-0000000000c1', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'e2300000-0000-4000-8000-0000000000a1', null, 'measurement_protocol', 'Protokoll', 'p.pdf', 'application/pdf', 1000, 'ready', now(), pg_temp.uid('a_operator'));
insert into storage.objects (bucket_id, name, metadata)
select 'documents', storage_path, jsonb_build_object('size', size_bytes, 'mimetype', mime_type)
  from public.documents where id::text like 'd2300000-%';

create function pg_temp.doc(p text) returns uuid language sql immutable as $$
  select ('d2300000-0000-4000-8000-0000000000' || p)::uuid $$;
create temporary table paths as select k, (select storage_path from public.documents where id = pg_temp.doc(k)) as storage_path
  from (values ('a1'), ('a2'), ('a3'), ('b1'), ('c1')) v(k);
grant select on paths to authenticated;
create function pg_temp.p(k text) returns text language sql stable as $$ select storage_path from paths where paths.k = $1 $$;
grant execute on function pg_temp.doc(text), pg_temp.p(text) to authenticated;
-- The Storage API's own delete (it sets storage.allow_delete_query); returns rows removed.
create function pg_temp.remove_object(p_path text) returns int language plpgsql as $$
declare n int;
begin
  perform set_config('storage.allow_delete_query', 'true', true);
  with d as (delete from storage.objects where bucket_id = 'documents' and name = p_path returning 1)
  select count(*) into n from d;
  return n;
end; $$;
grant execute on function pg_temp.remove_object(text) to authenticated;

select plan(42);

-- ===========================================================================
-- Photo links
-- ===========================================================================

select pg_temp.login('a_operator');
select lives_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, photos_url)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'Lingiga', 'https://drive.example.com/folders/abc?usp=sharing') $$,
  'an operator records a log entry with an https photo link');
select lives_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, photos_url)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'Lingita', null) $$,
  'the photo link is optional');
select throws_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, photos_url)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'x', 'http://example.com/fotod') $$,
  '23514', null, 'plain http is refused');
select throws_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, photos_url)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'x', 'javascript:alert(1)') $$,
  '23514', null, 'script URLs are refused');
select throws_ok(
  $$ insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, photos_url)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'x', 'x', 'low', 'https://user:salasona@example.com/x') $$,
  '23514', null, 'links with credentials are refused');
select throws_ok(
  $$ insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, photos_url)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'x', 'x', 'low', 'https://intranet/fotod') $$,
  '23514', null, 'a host without a domain is refused');
select throws_ok(
  $$ insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, photos_url)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'x', 'x', 'low', 'https://example.com/a b') $$,
  '23514', null, 'whitespace inside the link is refused');
with u as (
  update public.deficiencies set photos_url = 'https://example.sharepoint.com/sites/kilbid/fotod'
   where id = 'df230000-0000-4000-8000-0000000000a2' returning 1
)
select is(count(*)::int, 1, 'an operator sets the photo link of an open deficiency') from u;
select throws_ok(
  $$ update public.log_entries set photos_url = 'https://example.com/x' where id = 'e2300000-0000-4000-8000-0000000000a1' $$,
  '42501', null, 'log entries stay append-only: the photo link cannot be changed afterwards');

select pg_temp.login('a_viewer');
with u as (update public.deficiencies set photos_url = null where id = 'df230000-0000-4000-8000-0000000000a2' returning 1)
select is(count(*)::int, 0, 'a viewer cannot change a photo link') from u;
select is((select photos_url from public.deficiencies where id = 'df230000-0000-4000-8000-0000000000a2'),
  'https://example.sharepoint.com/sites/kilbid/fotod', 'members read the photo link');

select pg_temp.login('b_admin');
select is_empty($$ select photos_url from public.deficiencies where organisation_id = pg_temp.org('a') $$,
  'another company cannot read the photo links');
with u as (update public.deficiencies set photos_url = 'https://evil.example.com/' where id = 'df230000-0000-4000-8000-0000000000a2' returning 1)
select is(count(*)::int, 0, 'another company cannot change a photo link') from u;

select pg_temp.login('a_operator');
select public.resolve_deficiency('df230000-0000-4000-8000-0000000000a2', 'Tehtud', 'other', now(), null);
select throws_ok(
  $$ update public.deficiencies set photos_url = null where id = 'df230000-0000-4000-8000-0000000000a2' $$,
  'P0001', 'deficiency_resolved', 'a resolved deficiency''s photo link is final');

-- ===========================================================================
-- No new images
-- ===========================================================================

select throws_ok(
  $$ insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'photo', 'x', 'x.jpg', 'image/jpeg', 10) $$,
  'P0001', 'image_uploads_disabled', 'an image can no longer be registered for upload');
select throws_ok(
  $$ insert into public.documents (organisation_id, site_id, electrical_installation_id, deficiency_id, category, title, original_filename, mime_type, size_bytes)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'df230000-0000-4000-8000-0000000000a1', 'other', 'x', 'x.png', 'image/png', 10) $$,
  'P0001', 'image_uploads_disabled', 'not as a deficiency attachment either');
select throws_ok(
  $$ insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'x', 'x.svg', 'image/svg+xml', 10) $$,
  'P0001', 'image_uploads_disabled', 'SVG images are refused as well');
select lives_ok(
  $$ insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'measurement_protocol', 'Protokoll', 'p.pdf', 'application/pdf', 10) $$,
  'PDF documents are still registered as before');
reset role;
select is((select allowed_mime_types::text[] from storage.buckets where id = 'documents') && array['image/jpeg', 'image/png', 'image/webp'],
  false, 'the bucket accepts no image types');

-- ===========================================================================
-- Deleting an image: roles and tenants
-- ===========================================================================

select pg_temp.login('a_viewer');
select throws_ok($$ select public.delete_document_image(pg_temp.doc('a1')) $$, 'P0002', 'not_found', 'a viewer cannot delete an image');
select pg_temp.login('b_admin');
select throws_ok($$ select public.delete_document_image(pg_temp.doc('a1')) $$, 'P0002', 'not_found',
  'another company cannot delete (or probe) an image');
select is(pg_temp.remove_object(pg_temp.p('a1')), 0, 'another company cannot remove the file through Storage');
select pg_temp.login('a_operator');
select throws_ok($$ select public.delete_document_image(pg_temp.doc('a3')) $$, 'P0002', 'not_found',
  'an operator cannot delete a general document image (admins manage general documents)');
select throws_ok($$ select public.delete_document_image(pg_temp.doc('c1')) $$, 'P0002', 'not_found',
  'only images can be deleted, never PDFs or other documents');
select is(pg_temp.remove_object(pg_temp.p('a1')), 0, 'a ready image''s file cannot be removed without deleting it first');

-- ===========================================================================
-- Deleting an image: tombstone, file removal, confirmation
-- ===========================================================================

select is(public.delete_document_image(pg_temp.doc('a1')), pg_temp.p('a1'), 'an operator deletes a log entry image; the path comes back');
select is((select deleted_by_name is not null and deleted_at is not null and file_removed_at is null
             from public.documents where id = pg_temp.doc('a1')), true,
  'the row stays as a trace: who and when, file not yet confirmed gone');
select pg_temp.login('a_viewer');
select is_empty($$ select 1 from storage.objects where name = pg_temp.p('a1') $$,
  'a deleted image is unreadable at once (no signed URL), even before the file is removed');
select pg_temp.login('a_operator');
select is(public.confirm_document_image_removed(pg_temp.doc('a1')), false, 'confirming before removal reports the file is still there');
select is(public.delete_document_image(pg_temp.doc('a1')), pg_temp.p('a1'), 'repeating the delete returns the path again (retry)');
select is(pg_temp.remove_object(pg_temp.p('a1')), 1, 'the operator removes the file through Storage');
select is(public.confirm_document_image_removed(pg_temp.doc('a1')), true, 'confirming after removal succeeds');
select is((select file_removed_at is not null from public.documents where id = pg_temp.doc('a1')), true, 'the removal is recorded');
select throws_ok($$ select public.delete_document_image(pg_temp.doc('a1')) $$, 'P0001', 'image_already_deleted',
  'a fully deleted image cannot be deleted again');
select is(public.delete_document_image(pg_temp.doc('a2')), pg_temp.p('a2'), 'an operator deletes a deficiency image');

select pg_temp.login('a_admin');
select is(public.delete_document_image(pg_temp.doc('a3')), pg_temp.p('a3'), 'an admin deletes a general document image');
select throws_ok(
  $$ update public.documents set deleted_at = null where id = pg_temp.doc('a3') $$,
  '42501', null, 'the tombstone columns are not writable through the API');
reset role;
select throws_ok($$ update public.documents set title = 'Muudetud' where id = pg_temp.doc('a3') $$,
  'P0001', 'document_immutable', 'a deleted image''s row never changes again');
select throws_ok($$ update public.documents set deleted_at = null, deleted_by_name = null where id = pg_temp.doc('a3') $$,
  'P0001', 'document_immutable', 'a deletion cannot be undone, not even by the table owner');
select isnt_empty(
  $$ select 1 from public.activity_history where table_name = 'documents' and record_id = pg_temp.doc('a1') and action = 'update'
        and new_data ->> 'deleted_at' is not null $$,
  'the deletion is in the change history');
select is((select count(*)::int from public.documents where id::text like 'd2300000-%'), 5, 'no document row disappeared');

-- ===========================================================================
-- Failed uploads: the uploader's cleanup now really removes the object
-- ===========================================================================

select pg_temp.login('a_operator');
insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes)
values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'Katkenud', 'k.pdf', 'application/pdf', 10);
insert into storage.objects (bucket_id, name, metadata)
select 'documents', storage_path, '{"size": 10, "mimetype": "application/pdf"}' from public.documents where title = 'Katkenud';
select is(pg_temp.remove_object((select storage_path from public.documents where title = 'Katkenud')), 1,
  'the uploader removes the object of their own incomplete upload');

select * from finish();
rollback;
