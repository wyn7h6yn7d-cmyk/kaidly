-- Platform-wide deadlines are bounded: at most 500 rows (most urgent first) plus the true total.
begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

select plan(6);

insert into private.platform_admins (user_id) values (pg_temp.uid('outsider'));
-- 510 open critical deficiencies with increasing due dates in company A.
insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, due_on, created_by)
select pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), format('Limiit %s', lpad(g::text, 3, '0')), 'x', 'critical',
       (now() at time zone 'Europe/Tallinn')::date - 600 + g, pg_temp.uid('a_operator')
  from generate_series(1, 510) g;

select pg_temp.login('outsider');
select is((public.admin_deadlines(p_company => pg_temp.org('a')) ->> 'total')::int, 510, 'the true total is reported');
select is(jsonb_array_length(public.admin_deadlines(p_company => pg_temp.org('a')) -> 'rows'), 500, 'at most 500 rows are returned');
select is((public.admin_deadlines() ->> 'limit')::int, 500, 'the limit is part of the answer');
select is(public.admin_deadlines(p_company => pg_temp.org('a')) -> 'rows' -> 0 ->> 'item', 'Limiit 001', 'most urgent (earliest due) first');
select is(jsonb_array_length(public.admin_deadlines(p_company => pg_temp.org('b')) -> 'rows'), 0, 'filters still apply');

select pg_temp.login('a_owner');
select throws_ok($$ select public.admin_deadlines() $$, 'P0002', 'not_found', 'still platform admins only');

select * from finish();
rollback;
