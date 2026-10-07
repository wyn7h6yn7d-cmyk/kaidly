-- No cross-tenant oracles: writing a row that names another organisation's records must
-- give the same generic error whether or not those records exist, and whatever their state.
-- (Definer BEFORE triggers run before RLS and foreign keys; see migration
-- harden_insert_triggers.) Also: Storage never reveals that another tenant's object exists.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

-- Organisation B: an archived site and installation, a correction, a resolved deficiency,
-- a ready document with its object.
insert into public.sites (id, organisation_id, name, archived_at)
values ('5b000000-0000-4000-8000-0000000000b2', pg_temp.org('b'), 'B arhiiv', now());
alter table public.log_entries disable trigger log_entry_before_insert;
insert into public.log_entries (id, organisation_id, site_id, electrical_installation_id, entry_type, description, created_by, created_by_name)
values ('eb000000-0000-4000-8000-0000000000b1', pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'other', 'B', pg_temp.uid('b_operator'), 'B'),
       ('eb000000-0000-4000-8000-0000000000b2', pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'other', 'B parandus', pg_temp.uid('b_operator'), 'B');
alter table public.log_entries enable trigger log_entry_before_insert;
alter table public.log_entries disable trigger user;
update public.log_entries set correction_of_id = 'eb000000-0000-4000-8000-0000000000b1', correction_reason = 'x'
 where id = 'eb000000-0000-4000-8000-0000000000b2';
alter table public.log_entries enable trigger user;
alter table public.deficiencies disable trigger user;
insert into public.deficiencies (id, organisation_id, site_id, electrical_installation_id, title, description, severity, status,
                                 resolution, resolved_at, resolved_by, resolved_by_name, created_by, created_by_name)
values ('dfb00000-0000-4000-8000-0000000000b1', pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'B', 'B', 'low', 'resolved',
        'ok', now(), pg_temp.uid('b_operator'), 'B', pg_temp.uid('b_operator'), 'B');
alter table public.deficiencies enable trigger user;
insert into public.documents (id, organisation_id, site_id, electrical_installation_id, category, title, original_filename,
                              mime_type, size_bytes, status, ready_at, uploaded_by)
values ('d0cb0000-0000-4000-8000-0000000000b1', pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'audit', 'B', 'b.pdf',
        'application/pdf', 10, 'ready', now(), pg_temp.uid('b_admin'));
insert into storage.objects (bucket_id, name, metadata)
select 'documents', storage_path, '{"size": 10, "mimetype": "application/pdf"}' from public.documents
 where id = 'd0cb0000-0000-4000-8000-0000000000b1';
update public.electrical_installations set archived_at = now() where id = pg_temp.inst('b1');
create temporary table b_path as
  select storage_path from public.documents where id = 'd0cb0000-0000-4000-8000-0000000000b1';
grant select on b_path to authenticated;

select plan(9);

select pg_temp.login('a_admin');

-- Naming B's archived records from organisation A: generic foreign-key error, not a hint.
select throws_ok(
  $$ insert into public.electrical_installations (organisation_id, site_id, name, installation_type)
     values (pg_temp.org('a'), '5b000000-0000-4000-8000-0000000000b2', 'x', 'switchboard') $$,
  '23503', null, 'installation on B''s archived site: no "site_archived" hint');
select throws_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('b1'), 'other', 'x') $$,
  '23503', null, 'log entry naming B''s archived installation: no "installation_archived" hint');
select throws_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description,
                                     correction_of_id, correction_reason)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'other', 'x',
             'eb000000-0000-4000-8000-0000000000b2', 'y') $$,
  '23503', null, 'correction of B''s correction: no "correction_target_invalid" hint');
select throws_ok(
  $$ insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('b1'), 'x', 'x', 'low') $$,
  '23503', null, 'deficiency naming B''s archived installation: no hint');
select throws_ok(
  $$ insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, external_url)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('b1'), 'other', 'x', 'https://example.com/x') $$,
  '23503', null, 'document naming B''s archived installation: no "installation_archived" hint');

-- Writing into B directly as a non-member: the RLS error, before any trigger hint.
select throws_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description)
     values (pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'other', 'x') $$,
  '42501', null, 'non-member writing into B with B''s archived installation: plain "forbidden"');
select throws_ok(
  $$ insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title,
                                   original_filename, mime_type, size_bytes)
     values (pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'audit', 'x', 'x.pdf', 'application/pdf', 10) $$,
  '42501', null, 'non-member registering a document in B: plain "forbidden"');

-- Storage: uploading to the path of B's existing object is refused like any unknown path
-- (RLS before the unique check), and B's object can't be listed.
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, metadata)
     select 'documents', storage_path, '{}' from b_path $$,
  '42501', null, 'uploading onto B''s existing object path: same error as an unknown path');
select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'documents' and name like pg_temp.org('b')::text || '%' $$,
  'B''s objects cannot be listed by prefix');

select * from finish();
rollback;
