-- Global search runs with the caller's RLS: every entity type is found by its searchable
-- fields, nothing from another tenant leaks, wildcards are literal, read-only (expired)
-- companies stay searchable and deactivated ones are left out.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

select plan(20);

update public.electrical_installations set identifier = 'PK-01' where id = pg_temp.inst('a1');
insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'Termograafiline kontroll kilbis', pg_temp.uid('a_operator')),
       (pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'inspection', 'Termograafiline kontroll B salajane', pg_temp.uid('b_operator'));
insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on, created_by)
values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Isolatsioonitakistuse mõõtmine', 'once', current_date + 30, pg_temp.uid('a_admin')),
       (pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'Isolatsioonitakistuse mõõtmine B', 'once', current_date + 30, pg_temp.uid('b_admin'));
insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, created_by)
values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Lahtine klemm', 'X3 ülekuumenemine', 'high', pg_temp.uid('a_operator'));
insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes, status, ready_at, uploaded_by)
values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'measurement_protocol', 'Mõõteprotokoll 2026', 'protokoll_100%.pdf', 'application/pdf', 10, 'ready', now(), pg_temp.uid('a_admin')),
       (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'manual', 'Pooleli üleslaadimine', 'pooleli.pdf', 'application/pdf', 10, 'pending', null, pg_temp.uid('a_admin'));

create function pg_temp.hits(p_q text, p_group text) returns int language sql as $$
  select jsonb_array_length(public.search_kaidly(p_q) -> p_group)
$$;
grant execute on function pg_temp.hits(text, text) to authenticated;

select pg_temp.login('a_viewer');
select is(pg_temp.hits('Organisatsioon A', 'companies'), 1, 'finds the own company by name');
select is(pg_temp.hits('A objekt', 'sites'), 2, 'finds sites by name');
select is(pg_temp.hits('PK-01', 'installations'), 1, 'finds installations by identifier');
select is(pg_temp.hits('kilp 1', 'installations'), 1, 'finds installations by name');
select is(pg_temp.hits('Termograafiline', 'log'), 1, 'finds operating-log entries by description');
select is((public.search_kaidly('zzz', array['inspection']::public.log_entry_type[]) -> 'log' -> 0 ->> 'entry_type'), 'inspection',
  'finds operating-log entries by (localised) entry type');
select is(pg_temp.hits('Isolatsioonitakistuse', 'activities'), 1, 'finds activities by title');
select is(pg_temp.hits('ülekuumenemine', 'deficiencies'), 1, 'finds deficiencies by description');
select is(pg_temp.hits('Mõõteprotokoll', 'documents'), 1, 'finds documents by title');
select is(pg_temp.hits('100%', 'documents'), 1, 'finds documents by filename; % is literal');
select is(pg_temp.hits('pooleli', 'documents'), 0, 'unfinished uploads are not searchable');
select is(pg_temp.hits('%', 'sites'), 0, 'a bare % is not a wildcard');
select is(pg_temp.hits('a', 'sites'), 0, 'at least two characters');
select ok(public.search_kaidly('salajane')::text not like '%salajane%', 'another tenant''s log entry never appears');
select is(pg_temp.hits('Organisatsioon B', 'companies'), 0, 'another tenant''s company never appears');
select is(pg_temp.hits('B objekt', 'sites'), 0, 'another tenant''s sites never appear');

select pg_temp.login('outsider');
select is(public.search_kaidly('Termograafiline')::text, public.search_kaidly('zz-nothing')::text, 'an outsider finds nothing');

-- Expired companies stay searchable; deactivated ones are left out.
select pg_temp.logout();
reset role;
update private.organisation_access set trial_started_at = now() - interval '20 days', trial_ends_at = now() - interval '6 days' where organisation_id = pg_temp.org('a');
select pg_temp.login('a_viewer');
select is(pg_temp.hits('Termograafiline', 'log'), 1, 'an expired (read-only) company is still searchable');
select pg_temp.logout();
reset role;
update public.organisations set deactivated_at = now() where id = pg_temp.org('a');
select pg_temp.login('a_viewer');
select is(pg_temp.hits('Termograafiline', 'log'), 0, 'a deactivated company is left out');
select pg_temp.login('multi');
select is(pg_temp.hits('B objekt', 'sites'), 1, 'a member of two companies finds the other company''s data');

select * from finish();
rollback;
