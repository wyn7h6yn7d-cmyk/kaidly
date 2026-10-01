-- Security baseline that must hold for the whole schema, in every phase.
-- New tables and functions are covered automatically, so a table added without RLS
-- or a function accidentally exposed to anon fails this file.

begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

-- Every table in the API-exposed schema has RLS enabled.
select is_empty(
  $$ select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'p')
        and not c.relrowsecurity $$,
  'every table in public has row level security enabled'
);

-- anon has no privileges on any table in public.
select is_empty(
  $$ select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'p', 'v', 'm')
        and (has_table_privilege('anon', c.oid, 'select')
          or has_table_privilege('anon', c.oid, 'insert')
          or has_table_privilege('anon', c.oid, 'update')
          or has_table_privilege('anon', c.oid, 'delete')) $$,
  'anon has no table privileges in public'
);

-- anon cannot execute any KAIDLY function.
select is_empty(
  $$ select p.oid::regprocedure::text
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private')
        and has_function_privilege('anon', p.oid, 'execute') $$,
  'anon cannot execute any function in public or private'
);

-- Every security definer function pins its search_path.
select is_empty(
  $$ select p.oid::regprocedure::text
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private')
        and p.prosecdef
        and not exists (
          select 1 from unnest(coalesce(p.proconfig, '{}')) cfg
           where cfg like 'search_path=%'
        ) $$,
  'every security definer function sets search_path'
);

-- authenticated never holds privileges that bypass RLS or alter tables.
select is_empty(
  $$ select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'p')
        and (has_table_privilege('authenticated', c.oid, 'truncate')
          or has_table_privilege('authenticated', c.oid, 'references')
          or has_table_privilege('authenticated', c.oid, 'trigger')) $$,
  'authenticated has no truncate, references or trigger privilege in public'
);

-- Default privileges keep both API roles out of tables created in future migrations,
-- until a migration grants access explicitly.
create table public.__default_privileges_probe (id int primary key);
select ok(
  not has_table_privilege('anon', 'public.__default_privileges_probe', 'select'),
  'a newly created table is not readable by anon'
);
select ok(
  not has_table_privilege('authenticated', 'public.__default_privileges_probe', 'select')
  and not has_table_privilege('authenticated', 'public.__default_privileges_probe', 'truncate'),
  'a newly created table grants authenticated nothing until a migration does'
);

select * from finish();
rollback;
