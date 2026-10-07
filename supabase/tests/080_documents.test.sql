-- Documents: a link register (migration document_links) — tenant isolation for metadata
-- and for files uploaded earlier, roles, https links, no file uploads of any kind (rows or
-- Storage objects), immutable historical attachments, archive/restore, public access.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

-- A log entry and a deficiency (as postgres).
insert into public.log_entries (id, organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
values ('e1000000-0000-4000-8000-0000000000a1', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'A kanne', pg_temp.uid('a_operator'));
insert into public.deficiencies (id, organisation_id, site_id, electrical_installation_id, title, description, severity, created_by)
values ('df000000-0000-4000-8000-0000000000a1', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Puudus', 'Kirjeldus', 'high', pg_temp.uid('a_operator'));

-- Files uploaded before links (as postgres, like existing Production rows): one general (A),
-- one historical attachment (A), one in B — plus their objects.
insert into public.documents (id, organisation_id, site_id, electrical_installation_id, log_entry_id, category, title, original_filename, mime_type, size_bytes, status, ready_at, uploaded_by)
values
  ('d0c00000-0000-4000-8000-0000000000a1', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), null, 'single_line_diagram', 'Skeem', 'skeem.pdf', 'application/pdf', 1000, 'ready', now(), pg_temp.uid('a_admin')),
  ('d0c00000-0000-4000-8000-0000000000a2', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'e1000000-0000-4000-8000-0000000000a1', 'photo', 'Foto', 'foto.jpg', 'image/jpeg', 2000, 'ready', now(), pg_temp.uid('a_operator')),
  ('d0c00000-0000-4000-8000-0000000000b1', pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), null, 'audit', 'B audit', 'audit.pdf', 'application/pdf', 3000, 'ready', now(), pg_temp.uid('b_admin'));
insert into storage.objects (bucket_id, name, metadata)
select 'documents', storage_path, jsonb_build_object('size', size_bytes, 'mimetype', mime_type) from public.documents
where id::text like 'd0c00000-%';

create function pg_temp.doc(p text) returns uuid language sql immutable as $$
  select ('d0c00000-0000-4000-8000-0000000000' || p)::uuid $$;
grant execute on function pg_temp.doc(text) to authenticated, anon;
-- Paths are captured as postgres so cross-tenant tests use the real values.
create temporary table paths as
  select name, (select storage_path from public.documents where id = pg_temp.doc(name)) as storage_path
    from (values ('a1'), ('a2'), ('b1')) v(name);
grant select on paths to authenticated, anon;
create function pg_temp.p(p text) returns text language sql stable as $$ select storage_path from paths where name = p $$;
grant execute on function pg_temp.p(text) to authenticated, anon;

-- Adds a link document as the current user.
create function pg_temp.add_link(p_title text, p_inst text default 'a1', p_url text default 'https://example.com/doc')
returns uuid language sql as $$
  insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, external_url)
  select i.organisation_id, i.site_id, i.id, 'measurement_protocol', p_title, p_url
    from public.electrical_installations i where i.id = pg_temp.inst(p_inst)
  returning id $$;
grant execute on function pg_temp.add_link(text, text, text) to authenticated;

select plan(43);

-- ===========================================================================
-- Metadata: tenant isolation and roles
-- ===========================================================================

select pg_temp.login('a_viewer');
select is((select count(*)::int from public.documents where id::text like 'd0c00000-%'), 2, 'a viewer sees their organisation''s documents');
select is_empty($$ select 1 from public.documents where id = pg_temp.doc('b1') or organisation_id = pg_temp.org('b') $$,
  'tenant A cannot list tenant B''s documents');
select throws_ok($$ select pg_temp.add_link('Viewer') $$, '42501', null, 'a viewer cannot add documents');

select pg_temp.login('a_operator');
select isnt(pg_temp.add_link('Mõõteprotokoll 2026'), null, 'an operator adds an installation document as a link');
select is(
  (select status::text || '/' || (storage_path is null)::text || '/' || (ready_at is not null)::text || '/' || uploaded_by_name
     from public.documents where title = 'Mõõteprotokoll 2026'),
  'ready/true/true/A Operator', 'a link document is ready at once, has no object path and records who added it');
select throws_ok(
  $$ insert into public.documents (organisation_id, category, title, external_url)
     values (pg_temp.org('a'), 'manual', 'Org doc', 'https://example.com/juhend') $$,
  '42501', null, 'operators cannot add organisation-level documents (admin+)');
select throws_ok(
  $$ insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'Lingita') $$,
  '23514', 'document_link_required', 'a document needs its link');
select throws_ok(
  $$ select pg_temp.add_link('http', 'a1', 'http://example.com/doc') $$,
  '23514', null, 'plain http links are refused');
select throws_ok(
  $$ select pg_temp.add_link('script', 'a1', 'javascript:alert(1)') $$,
  '23514', null, 'script links are refused');
select throws_ok(
  $$ select pg_temp.add_link('creds', 'a1', 'https://user:pw@example.com/doc') $$,
  '23514', null, 'links with credentials are refused');
select throws_ok(
  $$ insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, external_url)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('b1'), 'other', 'x', 'https://example.com/x') $$,
  '23503', null, 'a document cannot reference another tenant''s installation');
select throws_ok(
  $$ insert into public.documents (organisation_id, category, title, external_url)
     values (pg_temp.org('b'), 'manual', 'x', 'https://example.com/x') $$,
  '42501', null, 'tenant A cannot add documents in tenant B');
select pg_temp.add_link('Path', 'a1', 'https://example.com/p');
select is((select storage_path is null from public.documents where title = 'Path'), true,
  'no object path is ever created for a link');

-- ===========================================================================
-- No file uploads of any kind
-- ===========================================================================

select throws_ok(
  $$ insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'x', 'x.pdf', 'application/pdf', 10) $$,
  'P0001', 'file_uploads_disabled', 'a PDF can no longer be registered');
select throws_ok(
  $$ insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes, external_url)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'x', 'x.docx',
             'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 10, 'https://example.com/x') $$,
  'P0001', 'file_uploads_disabled', 'nor DOCX (not even next to a link)');
select throws_ok(
  $$ insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'x', 'x.xlsx',
             'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 10) $$,
  'P0001', 'file_uploads_disabled', 'nor XLSX');
select throws_ok(
  $$ insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'photo', 'x', 'x.jpg', 'image/jpeg', 10) $$,
  'P0001', 'file_uploads_disabled', 'nor images');
select throws_ok(
  $$ insert into public.documents (organisation_id, site_id, electrical_installation_id, log_entry_id, category, title, external_url)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'e1000000-0000-4000-8000-0000000000a1', 'other', 'x', 'https://example.com/x') $$,
  'P0001', 'file_uploads_disabled', 'no attachments on log entries (they use the photo link)');
select throws_ok(
  $$ insert into public.documents (organisation_id, site_id, electrical_installation_id, deficiency_id, category, title, external_url)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'df000000-0000-4000-8000-0000000000a1', 'other', 'x', 'https://example.com/x') $$,
  'P0001', 'file_uploads_disabled', 'no attachments on deficiencies');

-- Even a pending file row (written as postgres) gives the user no way into Storage.
select pg_temp.logout();
reset role;
insert into public.documents (id, organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes, uploaded_by)
values ('d0c00000-0000-4000-8000-0000000000c1', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'Pooleli', 'p.pdf', 'application/pdf', 10, pg_temp.uid('a_operator'));
insert into paths values ('c1', (select storage_path from public.documents where id = pg_temp.doc('c1')));
select pg_temp.login('a_operator');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, metadata)
     values ('documents', pg_temp.p('c1'), '{"size": 10, "mimetype": "application/pdf"}') $$,
  '42501', null, 'nothing can be uploaded to Storage, not even to a registered pending path');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, metadata)
     values ('documents', pg_temp.org('a')::text || '/' || gen_random_uuid() || '/' || gen_random_uuid(), '{}') $$,
  '42501', null, 'nor to any other path of the own company');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, metadata) values ('documents', pg_temp.org('b')::text || '/x/y', '{}') $$,
  '42501', null, 'nor into another company');
select ok(not exists (select 1 from pg_proc where proname = 'finalize_document'), 'there is no upload finalisation any more');

-- ===========================================================================
-- Files uploaded earlier: reading, overwriting, deleting
-- ===========================================================================

with u as (update storage.objects set metadata = '{"size": 1}' where name = pg_temp.p('b1') returning 1)
select is(count(*)::int, 0, 'tenant A cannot overwrite tenant B''s object') from u;
with u as (update storage.objects set metadata = '{"size": 1}' where name = pg_temp.p('a2') returning 1)
select is(count(*)::int, 0, 'nobody can overwrite an object (no update policy)') from u;
select is_empty($$ select 1 from storage.objects where name = pg_temp.p('b1') $$,
  'tenant A cannot read (or learn about) tenant B''s object');
select isnt_empty($$ select 1 from storage.objects where name = pg_temp.p('a1') $$,
  'earlier files of the own company stay readable (for signed URLs)');
select set_config('storage.allow_delete_query', 'true', true);
with d as (delete from storage.objects where name = pg_temp.p('a2') returning 1)
select is(count(*)::int, 0, 'an earlier file cannot be removed without deleting it through KAIDLY first') from d;
with d as (delete from storage.objects where name = pg_temp.p('b1') returning 1)
select is(count(*)::int, 0, 'tenant A cannot delete tenant B''s file') from d;

-- ===========================================================================
-- Immutable history, editing, archiving
-- ===========================================================================

select pg_temp.login('a_admin');
select throws_ok($$ update public.documents set archived_at = now() where id = pg_temp.doc('a2') $$,
  'P0001', 'document_immutable', 'a historical attachment cannot be archived');
select throws_ok($$ update public.documents set external_url = 'https://example.com/x' where id = pg_temp.doc('a2') $$,
  'P0001', 'document_immutable', 'a historical attachment gets no link (records use their photo link)');
with d as (delete from public.documents where id = pg_temp.doc('a2') returning 1)
select is(count(*)::int, 0, 'a ready document row cannot be deleted') from d;
with u as (update public.documents set external_url = 'https://example.sharepoint.com/skeem' where id = pg_temp.doc('a1') returning 1)
select is(count(*)::int, 1, 'an admin adds a link to a general document that has an earlier file') from u;
with u as (
  update public.documents set external_url = 'https://example.com/uus', title = 'Uus pealkiri'
   where title = 'Mõõteprotokoll 2026' returning 1)
select is(count(*)::int, 1, 'an admin changes a document''s link and title') from u;
select throws_ok($$ update public.documents set external_url = null where title = 'Uus pealkiri' $$,
  '23514', null, 'a link document must keep a link');
select throws_ok($$ update public.documents set external_url = 'http://example.com/x' where title = 'Uus pealkiri' $$,
  '23514', null, 'an edited link must still be https');
with u as (update public.documents set archived_at = now() where id = pg_temp.doc('a1') returning 1)
select is(count(*)::int, 1, 'an admin can archive a general document') from u;
select pg_temp.login('a_operator');
with u as (update public.documents set external_url = 'https://evil.example.com/' where title = 'Uus pealkiri' returning 1)
select is(count(*)::int, 0, 'operators cannot change document links (admins manage documents)') from u;
select pg_temp.login('a_viewer');
with u as (update public.documents set external_url = 'https://evil.example.com/' where title = 'Uus pealkiri' returning 1)
select is(count(*)::int, 0, 'viewers cannot change document links') from u;
select pg_temp.login('b_admin');
with u as (update public.documents set external_url = 'https://evil.example.com/' where title = 'Uus pealkiri' returning 1)
select is(count(*)::int, 0, 'another company cannot change a document link') from u;
reset role;
select throws_ok($$ delete from public.documents where id = pg_temp.doc('a1') $$,
  'P0001', 'documents_are_kept', 'even the table owner cannot delete a ready document');

select pg_temp.logout();
select is_empty('select 1 from storage.objects', 'anonymous users cannot read any object');
select ok(not exists (select 1 from storage.buckets where public), 'no bucket is public');

select * from finish();
rollback;
