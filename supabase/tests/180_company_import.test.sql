-- CSV import (public.import_company_data): role matrix, tenant isolation, commercial access
-- and deactivation, all-or-nothing behaviour, idempotency per token, row validation.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

select plan(34);

create function pg_temp.imp(p_org text, p_kind text, p_rows text, p_token uuid default gen_random_uuid())
returns jsonb language sql as $$
  select public.import_company_data(pg_temp.org(p_org), p_kind, p_rows::jsonb, p_token)
$$;
grant execute on function pg_temp.imp(text, text, text, uuid) to authenticated, anon;

-- Role matrix ------------------------------------------------------------------------------
select pg_temp.login('a_owner');
select is((pg_temp.imp('a', 'sites', '[{"name": "Import objekt 1", "address": "Tee 1"}]') ->> 'created')::int, 1,
  'owner imports a site');
select pg_temp.login('a_admin');
select is((pg_temp.imp('a', 'sites', '[{"name": "Import objekt 2"}, {"name": "Import objekt 3"}]') ->> 'created')::int, 2,
  'admin imports sites');
select pg_temp.login('a_operator');
select throws_ok($$ select pg_temp.imp('a', 'sites', '[{"name": "X"}]') $$, 'P0002', 'not_found',
  'operator cannot import (same as creating sites)');
select pg_temp.login('a_viewer');
select throws_ok($$ select pg_temp.imp('a', 'sites', '[{"name": "X"}]') $$, 'P0002', 'not_found', 'viewer cannot import');
select pg_temp.login('outsider');
select throws_ok($$ select pg_temp.imp('a', 'sites', '[{"name": "X"}]') $$, 'P0002', 'not_found', 'outsider cannot import');
select pg_temp.login('b_owner');
select throws_ok($$ select pg_temp.imp('a', 'sites', '[{"name": "X"}]') $$, 'P0002', 'not_found',
  'owner of another company cannot import into this one');
select pg_temp.login('multi');
select throws_ok($$ select pg_temp.imp('b', 'sites', '[{"name": "X"}]') $$, 'P0002', 'not_found',
  'multi-company user: viewer role in B does not allow import');
select pg_temp.logout();
select throws_ok($$ select pg_temp.imp('a', 'sites', '[{"name": "X"}]') $$, '42501', null, 'anon cannot call the import');

reset role;
select is((select count(*)::int from public.sites where organisation_id = pg_temp.org('a') and name like 'Import objekt%'), 3,
  'exactly the authorised rows were created');
select is((select created_by from public.sites where name = 'Import objekt 1'), pg_temp.uid('a_owner'),
  'imported rows record the importing user');

-- Installations: sites are matched by name within the company only -------------------------
select pg_temp.login('a_owner');
select is((pg_temp.imp('a', 'installations',
  '[{"site": "import objekt 1", "name": "Peakilp", "identifier": "PK-1", "type": "switchboard", "commissioned_on": "2020-05-01"},
    {"site": "Import objekt 1", "name": "Laadija", "identifier": "LA-1", "type": "Charging"},
    {"site": "Import objekt 2", "name": "Kilp", "identifier": "PK-1"}]') ->> 'created')::int, 3,
  'installations are created under the named sites (case-insensitive), same identifier on another site is fine');
select throws_ok($$ select pg_temp.imp('a', 'installations', '[{"site": "B objekt 1", "name": "Võõras"}]') $$,
  'P0001', 'import_site_missing', 'a site of another company is never matched');

-- Validation: codes with the row number, nothing created -----------------------------------
select throws_like($$ select pg_temp.imp('a', 'installations', '[{"site": "Import objekt 1", "name": "Uus", "identifier": "pk-1"}]') $$,
  'import_identifier_exists', 'an existing identifier on the same site is refused');
select throws_ok($$ select pg_temp.imp('a', 'installations',
  '[{"site": "Import objekt 3", "name": "A", "identifier": "X-1"}, {"site": "Import objekt 3", "name": "B", "identifier": "x-1"}]') $$,
  'P0001', 'import_duplicate_identifier', 'duplicate identifier within the file');
select throws_ok($$ select pg_temp.imp('a', 'installations', '[{"site": "Import objekt 3", "name": "A", "type": "reactor"}]') $$,
  'P0001', 'import_type_invalid', 'unknown installation type');
select throws_ok($$ select pg_temp.imp('a', 'installations', '[{"site": "Import objekt 3", "name": "A", "commissioned_on": "2026-02-30"}]') $$,
  'P0001', 'import_date_invalid', 'impossible date');
select throws_ok($$ select pg_temp.imp('a', 'installations', '[{"site": "Import objekt 3", "name": "A", "commissioned_on": "01.02.2020"}]') $$,
  'P0001', 'import_date_invalid', 'dates must be YYYY-MM-DD');
select throws_ok($$ select pg_temp.imp('a', 'sites', '[{"name": "Import objekt 1"}]') $$,
  'P0001', 'import_site_exists', 'a site with the same name already exists');
select throws_ok($$ select pg_temp.imp('a', 'sites', '[{"name": "Uus 1"}, {"name": "uus 1"}]') $$,
  'P0001', 'import_duplicate_row', 'duplicate site row within the file');
select throws_ok($$ select pg_temp.imp('a', 'sites', '[{"name": "  "}]') $$, 'P0001', 'import_name_required', 'name is required');
select throws_ok($$ select pg_temp.imp('a', 'sites', '[{"name": "=HYPERLINK(\"x\")"}]') $$,
  'P0001', 'import_formula_value', 'spreadsheet formulas are refused');
select throws_ok($$ select pg_temp.imp('a', 'sites', format('[{"name": "%s"}]', repeat('x', 201))) $$,
  'P0001', 'import_value_too_long', 'over-long values are refused');
select throws_ok($$ select pg_temp.imp('a', 'sites', (select jsonb_agg(jsonb_build_object('name', 'R' || g))::text from generate_series(1, 1001) g)) $$,
  'P0001', 'import_too_many_rows', 'the 1000-row safety limit');
select throws_ok($$ select pg_temp.imp('a', 'sites', '[]') $$, 'P0001', 'import_empty', 'empty import');
select throws_ok($$ select pg_temp.imp('a', 'logs', '[{"name": "x"}]') $$, 'P0001', 'import_kind_invalid',
  'operating history cannot be imported');

-- The row number is reported; a failing row rolls back the whole import.
create function pg_temp.detail_of(p_sql text) returns text language plpgsql as $$
declare v text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics v = pg_exception_detail;
  return v;
end $$;
grant execute on function pg_temp.detail_of(text) to authenticated;
select is(pg_temp.detail_of($$ select pg_temp.imp('a', 'sites', '[{"name": "Kehtiv 1"}, {"name": "Kehtiv 2"}, {"name": ""}]') $$), '3',
  'the failing row number is reported');
select is((select count(*)::int from public.sites where name like 'Kehtiv%'), 0, 'nothing from a failed import is kept');

-- Idempotency: the same token returns the first result and creates nothing more.
select is((pg_temp.imp('a', 'sites', '[{"name": "Kord 1"}]', 'eeeeeeee-0000-4000-8000-000000000001') ->> 'repeated')::boolean, false,
  'first submission imports');
select is((pg_temp.imp('a', 'sites', '[{"name": "Kord 1"}]', 'eeeeeeee-0000-4000-8000-000000000001') ->> 'repeated')::boolean, true,
  'a repeated submission is recognised');
select is((select count(*)::int from public.sites where name = 'Kord 1'), 1, 'double submit creates the site once');

-- Batch record: not readable through the API.
select throws_ok($$ select count(*) from private.import_batches $$, '42501', null, 'import batches are not readable by users');
reset role;
select is((select count(*)::int from private.import_batches where organisation_id = pg_temp.org('a')), 4,
  'one batch per successful import attempt (failed attempts leave no batch)');

-- Expired company: read-only, also for import.
update private.organisation_access set trial_started_at = now() - interval '30 days', trial_ends_at = now() - interval '1 day'
 where organisation_id = pg_temp.org('a');
select pg_temp.login('a_owner');
select throws_ok($$ select pg_temp.imp('a', 'sites', '[{"name": "Pärast lõppu"}]') $$, '42501', 'company_read_only',
  'an expired company cannot import');

-- Deactivated company.
reset role;
update public.organisations set deactivated_at = now() where id = pg_temp.org('b');
select pg_temp.login('b_owner');
select throws_ok($$ select pg_temp.imp('b', 'sites', '[{"name": "Suletud"}]') $$, '42501', 'company_read_only',
  'a deactivated company cannot import');

select * from finish();
rollback;
