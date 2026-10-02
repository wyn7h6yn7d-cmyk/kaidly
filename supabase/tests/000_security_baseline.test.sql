-- Security baseline that must hold for the whole schema, in every phase.
-- New tables and functions are covered automatically, so a table added without RLS
-- or a function accidentally exposed to anon fails this file.

begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

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
       ('admin_audit_entries(integer,integer)'),
       ('admin_companies(text,integer,integer)'),
       ('admin_company(uuid)'),
       ('admin_deadlines(uuid,text,text,text,date,date,boolean,uuid)'),
       ('admin_overview()'),
       ('admin_password_reset_target(uuid)'),
       ('admin_remove_member(uuid)'),
       ('admin_revoke_sessions(uuid)'),
       ('admin_set_member_role(uuid,org_role)'),
       ('admin_set_user_disabled(uuid,boolean)'),
       ('admin_system()'),
       ('admin_user(uuid)'),
       ('admin_users(text,integer,integer)'),
       ('am_platform_admin()'),
       ('complete_scheduled_activity(uuid,date,log_entry_type,timestamp with time zone,text,text,text)'),
       ('create_invitation(uuid,text,org_role)'),
       ('create_organisation(text,text)'),
       ('deactivate_organisation(uuid,text)'),
       ('delete_organisation(uuid,text)'),
       ('finalize_document(uuid)'),
       ('invitation_preview(text)'),
       ('my_notifications(boolean,integer,integer)'),
       ('private.co_member_ids()'),
       ('private.org_ids(org_role)'),
       ('reactivate_organisation(uuid)'),
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

-- ---------------------------------------------------------------------------
-- Review gates: a new table or privileged function fails this file until it has been
-- reviewed (policies, grants, tests) and added here.
-- ---------------------------------------------------------------------------

select results_eq(
  $$ select c.relname::text collate "default" from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')
        and c.relname <> '__default_privileges_probe' -- created earlier in this file
      order by c.relname::text collate "C" $$,
  $$ values ('activity_history'), ('deficiencies'), ('documents'), ('electrical_installations'), ('log_entries'),
            ('notifications'), ('organisation_invitations'), ('organisation_members'), ('organisations'), ('profiles'),
            ('scheduled_activities'), ('sites') $$,
  'public tables are exactly the reviewed set'
);

select results_eq(
  $$ select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and p.prosecdef order by 1 $$,
  $$ values
       ('accept_invitation(text)'),
       ('admin_audit_entries(integer,integer)'),
       ('admin_companies(text,integer,integer)'),
       ('admin_company(uuid)'),
       ('admin_deadlines(uuid,text,text,text,date,date,boolean,uuid)'),
       ('admin_overview()'),
       ('admin_password_reset_target(uuid)'),
       ('admin_remove_member(uuid)'),
       ('admin_revoke_sessions(uuid)'),
       ('admin_set_member_role(uuid,org_role)'),
       ('admin_set_user_disabled(uuid,boolean)'),
       ('admin_system()'),
       ('admin_user(uuid)'),
       ('admin_users(text,integer,integer)'),
       ('am_platform_admin()'),
       ('complete_scheduled_activity(uuid,date,log_entry_type,timestamp with time zone,text,text,text)'),
       ('create_invitation(uuid,text,org_role)'),
       ('create_organisation(text,text)'),
       ('deactivate_organisation(uuid,text)'),
       ('delete_organisation(uuid,text)'),
       ('finalize_document(uuid)'),
       ('invitation_preview(text)'),
       ('private.admin_audit(text,text,text,jsonb)'),
       ('private.bootstrap_platform_admin(text)'),
       ('private.co_member_ids()'),
       ('private.deficiency_before_insert()'),
       ('private.document_before_insert()'),
       ('private.ensure_site_active()'),
       ('private.generate_activity_reminders(date,uuid)'),
       ('private.handle_new_user()'),
       ('private.has_org_role(uuid,org_role)'),
       ('private.is_owner(uuid)'),
       ('private.is_platform_admin_user(uuid)'),
       ('private.is_platform_admin()'),
       ('private.log_entry_before_insert()'),
       ('private.org_ids(org_role)'),
       ('private.organisation_member_before_insert()'),
       ('private.protect_last_owner()'),
       ('private.record_history()'),
       ('private.require_platform_admin()'),
       ('private.scheduled_activity_reminders()'),
       ('private.sync_profile_email()'),
       ('reactivate_organisation(uuid)'),
       ('resolve_deficiency(uuid,text,log_entry_type,timestamp with time zone,text)'),
       ('revoke_invitation(uuid)') $$,
  'security definer functions are exactly the reviewed set'
);

-- Tenant tables: every policy is scoped through private.org_ids() (members are also
-- allowed to remove themselves), and every tenant table has a select policy.
select is_empty(
  $$ select tablename || '.' || policyname from pg_policies
      where schemaname = 'public'
        and tablename in (select table_name from information_schema.columns
                           where table_schema = 'public' and column_name = 'organisation_id')
        and coalesce(qual, '') || coalesce(with_check, '') not like '%org_ids%' $$,
  'every policy on a tenant table is scoped through private.org_ids()'
);
select is_empty(
  $$ select c.table_name from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
      where c.table_schema = 'public' and c.column_name = 'organisation_id'
        and not exists (select 1 from pg_policies p
                         where p.schemaname = 'public' and p.tablename = c.table_name and p.cmd = 'SELECT') $$,
  'every tenant table has a select policy'
);
select is_empty(
  $$ select policyname from pg_policies
      where schemaname = 'public' and tablename = 'organisations'
        and coalesce(qual, '') || coalesce(with_check, '') not like '%org_ids%' $$,
  'organisations policies are scoped through private.org_ids()'
);

-- Records that must never change or disappear, at the privilege level.
select ok(
  -- has_any_column_privilege also catches column-level grants.
  not has_any_column_privilege('authenticated', 'public.log_entries', 'update')
  and not has_table_privilege('authenticated', 'public.log_entries', 'delete')
  and not has_table_privilege('authenticated', 'public.deficiencies', 'delete')
  and not has_any_column_privilege('authenticated', 'public.activity_history', 'insert')
  and not has_any_column_privilege('authenticated', 'public.activity_history', 'update')
  and not has_table_privilege('authenticated', 'public.activity_history', 'delete'),
  'append-only and never-deleted tables grant no write paths'
);
select ok(
  not has_column_privilege('authenticated', 'public.log_entries', 'created_by', 'insert')
  and not has_column_privilege('authenticated', 'public.log_entries', 'scheduled_activity_id', 'insert')
  and not has_column_privilege('authenticated', 'public.log_entries', 'deficiency_id', 'insert')
  and not has_column_privilege('authenticated', 'public.deficiencies', 'resolution', 'update')
  and not has_column_privilege('authenticated', 'public.scheduled_activities', 'anchor_on', 'update')
  and not has_column_privilege('authenticated', 'public.organisations', 'slug', 'update'),
  'server-owned columns are not client-writable'
);

-- Storage: one private bucket, exactly the reviewed object policies, nothing public.
select is_empty($$ select id from storage.buckets where public $$, 'no public storage buckets');
select results_eq(
  $$ select id::text, public, file_size_limit, allowed_mime_types::text[]
       from storage.buckets order by id $$,
  $$ values ('documents', false, 26214400::bigint,
             array['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
                   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[]) $$,
  'storage buckets are exactly the reviewed private documents bucket'
);
select results_eq(
  $$ select (tablename::text || ': ' || policyname::text || ' (' || cmd || ' to '
              || array_to_string(roles, ',') || ')') collate "default"
       from pg_policies where schemaname = 'storage' order by 1 $$,
  $$ values
       ('objects: kaidly documents: read ready files (SELECT to authenticated)'),
       ('objects: kaidly documents: remove own incomplete uploads (DELETE to authenticated)'),
       ('objects: kaidly documents: upload registered pending files (INSERT to authenticated)') $$,
  'storage policies are exactly the reviewed set (no update, nothing for anon)'
);
select is_empty(
  $$ select policyname from pg_policies where schemaname = 'storage'
      and (coalesce(qual, '') || coalesce(with_check, '')) collate "C" not like '%bucket_id = ''documents''%' $$,
  'every storage policy is limited to the documents bucket'
);

select * from finish();
rollback;
