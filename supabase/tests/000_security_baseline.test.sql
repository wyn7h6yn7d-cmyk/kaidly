-- Security baseline that must hold for the whole schema, in every phase.
-- New tables and functions are covered automatically, so a table added without RLS
-- or a function accidentally exposed to anon fails this file.

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

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

-- The API surface: exactly these functions are callable by signed-in users.
-- Adding an RPC means reviewing it and adding it here.
select results_eq(
  $$ select p.oid::regprocedure::text
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private')
        and has_function_privilege('authenticated', p.oid, 'execute')
      order by 1 $$,
  $$ values
       ('accept_invitation(text)'),
       ('complete_scheduled_activity(uuid,date,log_entry_type,timestamp with time zone,text,text,text)'),
       ('create_invitation(uuid,text,org_role)'),
       ('create_organisation(text,text)'),
       ('invitation_preview(text)'),
       ('private.co_member_ids()'),
       ('private.org_ids(org_role)'),
       ('resolve_deficiency(uuid,text,log_entry_type,timestamp with time zone,text)'),
       ('revoke_invitation(uuid)') $$,
  'authenticated can execute exactly the reviewed functions'
);

-- Views run with the caller's rights, so RLS of the underlying tables applies.
select is_empty(
  $$ select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'v'
        and not coalesce('security_invoker=true' = any (c.reloptions), false) $$,
  'every view in public is security_invoker'
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
