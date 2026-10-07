-- Phase 7: documents and Storage — tenant isolation for metadata and objects, upload
-- lifecycle, immutable historical attachments, roles, public access.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

-- Log entries and a deficiency to attach to (as postgres).
insert into public.log_entries (id, organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
values
  ('e1000000-0000-4000-8000-0000000000a1', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'A kanne', pg_temp.uid('a_operator')),
  ('e1000000-0000-4000-8000-0000000000a2', pg_temp.org('a'), pg_temp.site('a2'), pg_temp.inst('a2'), 'inspection', 'A2 kanne', pg_temp.uid('a_operator'));
-- An old entry: bypass the insert trigger's timestamp to simulate an entry from yesterday.
alter table public.log_entries disable trigger log_entry_before_insert;
insert into public.log_entries (id, organisation_id, site_id, electrical_installation_id, entry_type, description, created_by, created_by_name, created_at)
values ('e1000000-0000-4000-8000-0000000000a3', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'Vana kanne',
        pg_temp.uid('a_operator'), 'A Operator', now() - interval '25 hours'),
       ('e1000000-0000-4000-8000-0000000000a4', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'Eilne kanne',
        pg_temp.uid('a_operator'), 'A Operator', now() - interval '23 hours');
alter table public.log_entries enable trigger log_entry_before_insert;
insert into public.deficiencies (id, organisation_id, site_id, electrical_installation_id, title, description, severity, created_by)
values ('df000000-0000-4000-8000-0000000000a1', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Puudus', 'Kirjeldus', 'high', pg_temp.uid('a_operator'));

-- Ready fixture documents (seed-style, as postgres): one general (A), one historical (A), one in B.
insert into public.documents (id, organisation_id, site_id, electrical_installation_id, log_entry_id, category, title, original_filename, mime_type, size_bytes, status, ready_at, uploaded_by)
values
  ('d0c00000-0000-4000-8000-0000000000a1', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), null, 'single_line_diagram', 'Skeem', 'skeem.pdf', 'application/pdf', 1000, 'ready', now(), pg_temp.uid('a_admin')),
  ('d0c00000-0000-4000-8000-0000000000a2', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'e1000000-0000-4000-8000-0000000000a1', 'photo', 'Foto', 'foto.jpg', 'image/jpeg', 2000, 'ready', now(), pg_temp.uid('a_operator')),
  ('d0c00000-0000-4000-8000-0000000000b1', pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), null, 'audit', 'B audit', 'audit.pdf', 'application/pdf', 3000, 'ready', now(), pg_temp.uid('b_admin'));
-- Their objects.
insert into storage.objects (bucket_id, name, metadata)
select 'documents', storage_path, jsonb_build_object('size', size_bytes, 'mimetype', mime_type) from public.documents
where id::text like 'd0c00000-%';

create function pg_temp.doc(p text) returns uuid language sql immutable as $$
  select ('d0c00000-0000-4000-8000-0000000000' || p)::uuid $$;
create function pg_temp.path(p text) returns text language sql stable as $$
  select storage_path from public.documents where id = pg_temp.doc(p) $$;
grant execute on function pg_temp.doc(text) to authenticated, anon;
grant execute on function pg_temp.path(text) to authenticated, anon;
-- Paths are captured as postgres so cross-tenant tests use the real values.
create temporary table paths as select name, pg_temp.path(name) as storage_path from (values ('a1'), ('a2'), ('b1')) v(name);
grant select on paths to authenticated, anon;
create function pg_temp.p(p text) returns text language sql stable as $$ select storage_path from paths where name = p $$;
grant execute on function pg_temp.p(text) to authenticated, anon;

-- Registers a document as the current user and remembers its id/path.
create function pg_temp.register(p_key text, p_inst text, p_log uuid default null, p_def uuid default null, p_size bigint default 1234)
returns void language plpgsql as $$
declare v_id uuid; v_path text;
begin
  insert into public.documents (organisation_id, site_id, electrical_installation_id, log_entry_id, deficiency_id, category, title, original_filename, mime_type, size_bytes)
  select i.organisation_id, i.site_id, i.id, p_log, p_def, 'other', 'Uus', 'uus.pdf', 'application/pdf', p_size
    from public.electrical_installations i where i.id = pg_temp.inst(p_inst)
  returning id, storage_path into v_id, v_path;
  perform set_config('test.id_' || p_key, v_id::text, true);
  perform set_config('test.path_' || p_key, v_path, true);
end; $$;
grant execute on function pg_temp.register(text, text, uuid, uuid, bigint) to authenticated;
create function pg_temp.reg_id(k text) returns uuid language sql stable as $$ select current_setting('test.id_' || k)::uuid $$;
create function pg_temp.reg_path(k text) returns text language sql stable as $$ select current_setting('test.path_' || k) $$;
grant execute on function pg_temp.reg_id(text), pg_temp.reg_path(text) to authenticated;

select plan(44);

-- ===========================================================================
-- Metadata: tenant isolation and roles
-- ===========================================================================

select pg_temp.login('a_viewer');
select is((select count(*)::int from public.documents where id::text like 'd0c00000-%'), 2, 'a viewer sees their organisation''s documents');
select is_empty($$ select 1 from public.documents where id = pg_temp.doc('b1') or organisation_id = pg_temp.org('b') $$,
  'tenant A cannot list tenant B''s documents');
select throws_ok(
  $$ insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'x', 'x.pdf', 'application/pdf', 10) $$,
  '42501', null, 'a viewer cannot upload');

select pg_temp.login('a_operator');
select lives_ok($$ select pg_temp.register('op', 'a1') $$, 'an operator can register an installation document');
select is(
  (select status::text from public.documents where id = pg_temp.reg_id('op')), 'pending',
  'a new document starts pending (not visible as a valid document)');
select matches(
  pg_temp.reg_path('op'),
  '^' || pg_temp.org('a')::text || '/' || pg_temp.reg_id('op')::text || '/[0-9a-f-]{36}$',
  'the object path is generated: organisation/document/random');
select throws_ok(
  $$ insert into public.documents (organisation_id, category, title, original_filename, mime_type, size_bytes)
     values (pg_temp.org('a'), 'manual', 'Org doc', 'juhend.pdf', 'application/pdf', 10) $$,
  '42501', null, 'operators cannot upload organisation-level documents (admin+)');
select throws_ok(
  $$ insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes, storage_path)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'x', 'x.pdf', 'application/pdf', 10, pg_temp.p('b1')) $$,
  '42501', null, 'the storage path cannot be supplied (no reference to another tenant''s object)');
select throws_ok(
  $$ insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('b1'), 'other', 'x', 'x.pdf', 'application/pdf', 10) $$,
  '23503', null, 'metadata cannot reference another tenant''s installation');
select throws_ok(
  $$ insert into public.documents (organisation_id, site_id, electrical_installation_id, log_entry_id, category, title, original_filename, mime_type, size_bytes)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'e1000000-0000-4000-8000-0000000000a2', 'other', 'x', 'x.pdf', 'application/pdf', 10) $$,
  '23503', null, 'an attachment must belong to the log entry''s own installation');
select throws_ok(
  $$ insert into public.documents (organisation_id, category, title, original_filename, mime_type, size_bytes)
     values (pg_temp.org('b'), 'manual', 'x', 'x.pdf', 'application/pdf', 10) $$,
  '42501', null, 'tenant A cannot register documents in tenant B');
select throws_ok(
  $$ insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'x', 'leht.html', 'text/html', 10) $$,
  '23514', null, 'HTML (and anything outside the allowlist) is refused (images, SVG included: 230_photo_links)');
select throws_ok(
  $$ insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'x', 'suur.pdf', 'application/pdf', 26214401) $$,
  '23514', null, 'files over 25 MB are refused');
select throws_ok(
  $$ insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'x', '../../etc/passwd', 'application/pdf', 10) $$,
  '23514', null, 'filenames with path separators are refused');

-- Attachment windows
select lives_ok($$ select pg_temp.register('fresh', 'a1', 'e1000000-0000-4000-8000-0000000000a1') $$,
  'the author can attach to their fresh log entry');
select lives_ok($$ select pg_temp.register('day', 'a1', 'e1000000-0000-4000-8000-0000000000a4') $$,
  'the author can still attach within 24 hours (entry 23 h old)');
select throws_ok($$ select pg_temp.register('old', 'a1', 'e1000000-0000-4000-8000-0000000000a3') $$,
  'P0001', 'log_entry_attachment_closed', 'after 24 hours the entry takes no new attachments (use a correction)');
select pg_temp.login('a_admin');
select throws_ok($$ select pg_temp.register('foreign', 'a1', 'e1000000-0000-4000-8000-0000000000a1') $$,
  'P0001', 'log_entry_attachment_closed', 'only the entry''s author can attach to it');
select lives_ok($$ select pg_temp.register('def', 'a1', null, 'df000000-0000-4000-8000-0000000000a1') $$,
  'documents can be attached to an open deficiency');

-- ===========================================================================
-- Storage objects
-- ===========================================================================

select pg_temp.login('a_operator');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, metadata)
     values ('documents', pg_temp.reg_path('op'), '{"size": 1234, "mimetype": "application/pdf"}') $$,
  'an operator can upload to their own registered pending path');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, metadata)
     values ('documents', pg_temp.org('a')::text || '/' || gen_random_uuid() || '/' || gen_random_uuid(), '{}') $$,
  '42501', null, 'an unregistered path in the own organisation is refused (no forged paths)');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, metadata)
     values ('documents', pg_temp.org('b')::text || '/x/y', '{}') $$,
  '42501', null, 'tenant A cannot upload into tenant B''s path');
with u as (
  update storage.objects set metadata = '{"size": 1}' where name = pg_temp.p('b1') returning 1
)
select is(count(*)::int, 0, 'tenant A cannot overwrite tenant B''s object') from u;
with u as (
  update storage.objects set metadata = '{"size": 1}' where name = pg_temp.p('a2') returning 1
)
select is(count(*)::int, 0, 'nobody can overwrite an object (no update policy)') from u;
select is_empty($$ select 1 from storage.objects where name = pg_temp.p('b1') $$,
  'tenant A cannot read (or learn about) tenant B''s object');
select pg_temp.login('a_admin');
select is_empty(format('select 1 from storage.objects where name = %L', current_setting('test.path_op')),
  'an uploaded but not finalized (pending) object is not readable by other members');
select pg_temp.login('a_operator');
select isnt_empty($$ select 1 from storage.objects where name = pg_temp.p('a1') $$,
  'ready objects of the own organisation are readable (for signed URLs)');

-- Finalize
select is(public.finalize_document(pg_temp.reg_id('op')), 'ready'::public.document_status,
  'finalize marks an uploaded file ready');
select is(public.finalize_document(pg_temp.reg_id('fresh')), 'failed'::public.document_status,
  'finalize without an uploaded object marks it failed');
select pg_temp.register('liar', 'a1', null, null, 5000);
insert into storage.objects (bucket_id, name, metadata)
values ('documents', pg_temp.reg_path('liar'), '{"size": 26000000, "mimetype": "application/pdf"}');
select is(public.finalize_document(pg_temp.reg_id('liar')), 'failed'::public.document_status,
  'finalize refuses a file whose size differs from the registered metadata');
select pg_temp.login('b_operator');
select throws_ok(format('select public.finalize_document(%L)', current_setting('test.id_op')),
  'P0002', 'not_found', 'another tenant cannot finalize (or probe) a document');

-- Deleting objects (the Storage API sets storage.allow_delete_query for its own deletes)
select pg_temp.login('a_operator');
select set_config('storage.allow_delete_query', 'true', true);
with d as (delete from storage.objects where name = pg_temp.p('a2') returning 1)
select is(count(*)::int, 0, 'a historical attachment''s file cannot be deleted') from d;
with d as (delete from storage.objects where name = pg_temp.p('b1') returning 1)
select is(count(*)::int, 0, 'tenant A cannot delete tenant B''s file') from d;
select pg_temp.login('a_admin');
select set_config('storage.allow_delete_query', 'true', true);
with d as (delete from storage.objects where name = pg_temp.p('a1') returning 1)
select is(count(*)::int, 0, 'not even an admin can delete a ready file') from d;

-- ===========================================================================
-- Immutable history, archiving
-- ===========================================================================

select throws_ok($$ update public.documents set archived_at = now() where id = pg_temp.doc('a2') $$,
  'P0001', 'document_immutable', 'a historical attachment cannot be archived');
select throws_ok($$ update public.documents set title = 'Muudetud' where id = pg_temp.doc('a2') $$,
  'P0001', 'document_immutable', 'a historical attachment cannot be changed');
with d as (delete from public.documents where id = pg_temp.doc('a2') returning 1)
select is(count(*)::int, 0, 'a ready document row cannot be deleted') from d;
with u as (update public.documents set archived_at = now() where id = pg_temp.doc('a1') returning 1)
select is(count(*)::int, 1, 'an admin can archive a general document') from u;
select isnt_empty($$ select 1 from storage.objects where name = pg_temp.p('a1') $$,
  'an archived document stays readable (archived, not deleted)');
select pg_temp.login('a_operator');
with u as (update public.documents set archived_at = null where id = pg_temp.doc('a1') returning 1)
select is(count(*)::int, 0, 'operators cannot archive or restore documents') from u;
reset role;
select throws_ok($$ delete from public.documents where id = pg_temp.doc('a1') $$,
  'P0001', 'documents_are_kept', 'even the table owner cannot delete a ready document');

-- Resolved deficiency, public access
update public.deficiencies set status = 'in_progress' where id = 'df000000-0000-4000-8000-0000000000a1';
select pg_temp.login('a_operator');
select public.resolve_deficiency('df000000-0000-4000-8000-0000000000a1', 'Korras', 'repair', now(), null);
select throws_ok($$ select pg_temp.register('late', 'a1', null, 'df000000-0000-4000-8000-0000000000a1') $$,
  'P0001', 'deficiency_resolved', 'a resolved deficiency takes no new attachments');

select pg_temp.logout();
select is_empty('select 1 from storage.objects', 'anonymous users cannot read any object');
select ok(not exists (select 1 from storage.buckets where public), 'no bucket is public');

select * from finish();
rollback;
