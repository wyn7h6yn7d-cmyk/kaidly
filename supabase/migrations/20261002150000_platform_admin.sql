-- KAIDLY platform administration (the SaaS operator, not a customer role).
--
-- * private.platform_admins — who may administer the platform, by auth.users.id (never by
--   email). Lives in the private schema: not exposed through the API, no grants.
-- * private.admin_audit_log — every platform-admin mutation (no secrets, no payloads).
-- * private.is_platform_admin() — the only authorisation check. Organisation roles
--   (owner/admin/…) never grant platform administration.
-- * public.admin_* — security definer functions for the /admin console. Each one checks
--   is_platform_admin() first and otherwise answers 'not_found' (nothing reveals that the
--   function or the data exists). Reads return support METADATA (names, emails, counts,
--   statuses, deadlines) — never document contents, log descriptions or storage paths.
--   Mutations are audited. Tenant RLS is unchanged: a platform admin is not a member of
--   customer companies and sees nothing extra through the normal app.
-- * private.bootstrap_platform_admin(email) — run by the database owner only (CLI/SQL),
--   resolves exactly one confirmed account and stores its UUID.
-- No service-role key is involved anywhere.

create table private.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id) on delete set null,
  active boolean not null default true,
  notes text check (notes is null or char_length(notes) <= 500)
);

create table private.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_user_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) <= 60),
  target_type text not null check (target_type in ('user', 'company', 'membership', 'platform')),
  target_id text,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_log_created_idx on private.admin_audit_log (created_at desc);

revoke all on table private.platform_admins, private.admin_audit_log from public, anon, authenticated;

create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.platform_admins
     where user_id = (select auth.uid()) and active
  )
$$;

create function private.require_platform_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

create function private.admin_audit(p_action text, p_target_type text, p_target_id text, p_summary jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.admin_audit_log (admin_user_id, action, target_type, target_id, summary)
  values ((select auth.uid()), p_action, p_target_type, p_target_id, coalesce(p_summary, '{}'::jsonb));
$$;

revoke all on function private.is_platform_admin(), private.require_platform_admin(),
  private.admin_audit(text, text, text, jsonb) from public;

-- For the app: is the signed-in user a platform admin? (Only ever about oneself.)
create function public.am_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and private.is_platform_admin()
$$;

-- ---------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------

create function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Tallinn')::date;
begin
  perform private.require_platform_admin();
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_active_30d', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'companies', (select count(*) from public.organisations),
    'companies_active', (select count(*) from public.organisations where deactivated_at is null),
    'companies_deactivated', (select count(*) from public.organisations where deactivated_at is not null),
    'sites', (select count(*) from public.sites),
    'installations', (select count(*) from public.electrical_installations),
    'activities_overdue', (select count(*) from public.scheduled_activities a join public.organisations o on o.id = a.organisation_id
                            where a.archived_at is null and o.deactivated_at is null and a.next_due_on < v_today),
    'activities_due_soon', (select count(*) from public.scheduled_activities a join public.organisations o on o.id = a.organisation_id
                             where a.archived_at is null and o.deactivated_at is null and a.next_due_on between v_today and v_today + 14),
    'deficiencies_open', (select count(*) from public.deficiencies d join public.organisations o on o.id = d.organisation_id
                           where d.status <> 'resolved' and o.deactivated_at is null),
    'deficiencies_serious', (select count(*) from public.deficiencies d join public.organisations o on o.id = d.organisation_id
                              where d.status <> 'resolved' and d.severity in ('high', 'critical') and o.deactivated_at is null),
    'documents', (select count(*) from public.documents where status = 'ready'),
    'storage_bytes', (select coalesce(sum(size_bytes), 0) from public.documents where status = 'ready'),
    'log_entries_30d', (select count(*) from public.log_entries where created_at > now() - interval '30 days')
  );
end;
$$;

create function public.admin_users(p_search text default null, p_limit int default 50, p_offset int default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_rows jsonb;
  v_total int;
begin
  perform private.require_platform_admin();
  with matched as (
    select u.id, u.email, u.email_confirmed_at, u.created_at, u.last_sign_in_at, u.banned_until,
           p.full_name, p.preferred_locale
      from auth.users u
      left join public.profiles p on p.id = u.id
     where v_search is null
        or u.email ilike '%' || v_search || '%'
        or p.full_name ilike '%' || v_search || '%'
        or exists (select 1 from public.organisation_members m join public.organisations o on o.id = m.organisation_id
                    where m.user_id = u.id and o.name ilike '%' || v_search || '%')
  )
  select (select count(*) from matched),
         coalesce(jsonb_agg(row_to_json(r)::jsonb order by r.created_at desc), '[]'::jsonb)
    into v_total, v_rows
    from (
      select m.id, m.email, m.email_confirmed_at is not null as email_confirmed, m.created_at, m.last_sign_in_at,
             (m.banned_until is not null and m.banned_until > now()) as disabled,
             m.full_name, m.preferred_locale,
             (select private.is_platform_admin_user(m.id)) as platform_admin,
             coalesce((select jsonb_agg(jsonb_build_object('company_id', o.id, 'company', o.name, 'role', om.role,
                                                           'deactivated', o.deactivated_at is not null) order by o.name)
                         from public.organisation_members om join public.organisations o on o.id = om.organisation_id
                        where om.user_id = m.id), '[]'::jsonb) as memberships
        from matched m
       order by m.created_at desc
       limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)
    ) r;
  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

create function private.is_platform_admin_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.platform_admins where user_id = p_user and active)
$$;
revoke all on function private.is_platform_admin_user(uuid) from public;

create function public.admin_user(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_account jsonb;
begin
  perform private.require_platform_admin();
  select jsonb_build_object(
           'id', u.id, 'email', u.email, 'email_confirmed', u.email_confirmed_at is not null,
           'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
           'disabled', (u.banned_until is not null and u.banned_until > now()),
           'full_name', p.full_name, 'phone', p.phone, 'preferred_locale', p.preferred_locale,
           'platform_admin', private.is_platform_admin_user(u.id))
    into v_account
    from auth.users u left join public.profiles p on p.id = u.id
   where u.id = p_user;
  if v_account is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'account', v_account,
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object('membership_id', m.id, 'company_id', o.id, 'company', o.name, 'slug', o.slug,
                                          'role', m.role, 'joined_at', m.created_at,
                                          'deactivated', o.deactivated_at is not null) order by o.name)
        from public.organisation_members m join public.organisations o on o.id = m.organisation_id
       where m.user_id = p_user), '[]'::jsonb),
    'usage', jsonb_build_object(
      'log_entries', (select count(*) from public.log_entries where created_by = p_user),
      'activities_completed', (select count(*) from public.log_entries where created_by = p_user and scheduled_activity_id is not null),
      'deficiencies_created', (select count(*) from public.deficiencies where created_by = p_user),
      'deficiencies_resolved', (select count(*) from public.deficiencies where resolved_by = p_user),
      'documents_uploaded', (select count(*) from public.documents where uploaded_by = p_user and status = 'ready')),
    -- What kind of change, where and when — never the content.
    'recent', coalesce((
      select jsonb_agg(r order by r.created_at desc) from (
        select h.created_at, h.table_name, h.action, o.name as company
          from public.activity_history h join public.organisations o on o.id = h.organisation_id
         where h.actor_id = p_user
         order by h.created_at desc limit 15) r), '[]'::jsonb)
  );
end;
$$;

create function public.admin_companies(p_search text default null, p_limit int default 50, p_offset int default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_today date := (now() at time zone 'Europe/Tallinn')::date;
  v_total int;
  v_rows jsonb;
begin
  perform private.require_platform_admin();
  select count(*) into v_total from public.organisations o
   where v_search is null or o.name ilike '%' || v_search || '%' or o.registry_code ilike '%' || v_search || '%';
  select coalesce(jsonb_agg(row_to_json(r)::jsonb order by r.name), '[]'::jsonb) into v_rows from (
    select o.id, o.name, o.slug, o.registry_code, o.created_at, o.deactivated_at,
           (select coalesce(jsonb_agg(coalesce(nullif(p.full_name, ''), p.email) order by p.full_name), '[]'::jsonb)
              from public.organisation_members m join public.profiles p on p.id = m.user_id
             where m.organisation_id = o.id and m.role = 'owner') as owners,
           (select count(*) from public.organisation_members m where m.organisation_id = o.id) as members,
           (select count(*) from public.sites s where s.organisation_id = o.id) as sites,
           (select count(*) from public.electrical_installations i where i.organisation_id = o.id) as installations,
           (select count(*) from public.scheduled_activities a where a.organisation_id = o.id and a.archived_at is null and a.next_due_on < v_today) as overdue,
           (select count(*) from public.deficiencies d where d.organisation_id = o.id and d.status <> 'resolved') as open_deficiencies,
           (select count(*) from public.documents d where d.organisation_id = o.id and d.status = 'ready') as documents
      from public.organisations o
     where v_search is null or o.name ilike '%' || v_search || '%' or o.registry_code ilike '%' || v_search || '%'
     order by o.name
     limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)
  ) r;
  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

create function public.admin_company(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Tallinn')::date;
  v_company jsonb;
begin
  perform private.require_platform_admin();
  select jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug, 'registry_code', o.registry_code,
                            'contact_email', o.contact_email, 'contact_phone', o.contact_phone, 'address', o.address,
                            'created_at', o.created_at, 'deactivated_at', o.deactivated_at)
    into v_company from public.organisations o where o.id = p_org;
  if v_company is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'company', v_company,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('membership_id', m.id, 'user_id', m.user_id, 'name', p.full_name, 'email', p.email,
                                          'role', m.role, 'joined_at', m.created_at)
                       order by case m.role when 'owner' then 0 when 'admin' then 1 when 'operator' then 2 else 3 end, p.full_name)
        from public.organisation_members m join public.profiles p on p.id = m.user_id
       where m.organisation_id = p_org), '[]'::jsonb),
    'counts', jsonb_build_object(
      'sites', (select count(*) from public.sites where organisation_id = p_org),
      'installations', (select count(*) from public.electrical_installations where organisation_id = p_org),
      'log_entries', (select count(*) from public.log_entries where organisation_id = p_org),
      'activities', (select count(*) from public.scheduled_activities where organisation_id = p_org and archived_at is null),
      'overdue', (select count(*) from public.scheduled_activities where organisation_id = p_org and archived_at is null and next_due_on < v_today),
      'due_soon', (select count(*) from public.scheduled_activities where organisation_id = p_org and archived_at is null and next_due_on between v_today and v_today + 14),
      'deficiencies_open', (select count(*) from public.deficiencies where organisation_id = p_org and status <> 'resolved'),
      'deficiencies_serious', (select count(*) from public.deficiencies where organisation_id = p_org and status <> 'resolved' and severity in ('high', 'critical')),
      'documents', (select count(*) from public.documents where organisation_id = p_org and status = 'ready'),
      'storage_bytes', (select coalesce(sum(size_bytes), 0) from public.documents where organisation_id = p_org and status = 'ready')),
    'recent', coalesce((
      select jsonb_agg(r order by r.created_at desc) from (
        select h.created_at, h.table_name, h.action, coalesce(nullif(p.full_name, ''), p.email) as actor
          from public.activity_history h left join public.profiles p on p.id = h.actor_id
         where h.organisation_id = p_org
         order by h.created_at desc limit 15) r), '[]'::jsonb)
  );
end;
$$;

-- Platform-wide deadlines: only deadlines already in customer data. Archived activities,
-- resolved deficiencies and (unless asked) deactivated companies are never warnings.
create function public.admin_deadlines(
  p_company uuid default null,
  p_kind text default null,          -- 'activity' | 'deficiency'
  p_severity text default null,      -- 'high' | 'critical'
  p_state text default null,         -- 'overdue' | 'soon' (activities)
  p_from date default null,
  p_to date default null,
  p_include_deactivated boolean default false,
  p_site uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Tallinn')::date;
  v_rows jsonb;
begin
  perform private.require_platform_admin();
  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.due_on nulls last, x.severity_rank desc, x.item), '[]'::jsonb)
    into v_rows
    from (
      select 'activity' as kind, a.id, o.id as company_id, o.name as company, o.deactivated_at is not null as company_deactivated,
             s.id as site_id, s.name as site, i.name as installation, i.identifier, a.title as item, null::text as severity, 0 as severity_rank,
             a.next_due_on as due_on, (a.next_due_on - v_today) as days, a.responsible_person_name as responsible,
             case when a.next_due_on < v_today then 'overdue' else 'soon' end as state
        from public.scheduled_activities a
        join public.organisations o on o.id = a.organisation_id
        join public.sites s on s.id = a.site_id
        join public.electrical_installations i on i.id = a.electrical_installation_id
       where a.archived_at is null and a.next_due_on is not null and a.next_due_on <= v_today + 14
         and (p_kind is null or p_kind = 'activity') and p_severity is null
         and (p_state is null or (p_state = 'overdue' and a.next_due_on < v_today) or (p_state = 'soon' and a.next_due_on >= v_today))
      union all
      select 'deficiency', d.id, o.id, o.name, o.deactivated_at is not null, s.id, s.name, i.name, i.identifier, d.title, d.severity::text,
             case d.severity when 'critical' then 2 else 1 end,
             d.due_on, (d.due_on - v_today), d.responsible_person_name,
             case when d.due_on is not null and d.due_on < v_today then 'overdue' else 'open' end
        from public.deficiencies d
        join public.organisations o on o.id = d.organisation_id
        join public.sites s on s.id = d.site_id
        join public.electrical_installations i on i.id = d.electrical_installation_id
       where d.status <> 'resolved' and d.severity in ('high', 'critical')
         and (p_kind is null or p_kind = 'deficiency')
         and (p_severity is null or d.severity::text = p_severity)
         and (p_state is null or (p_state = 'overdue' and d.due_on < v_today))
    ) x
   where (p_company is null or x.company_id = p_company)
     and (p_site is null or x.site_id = p_site)
     and (p_include_deactivated or not x.company_deactivated)
     and (p_from is null or x.due_on >= p_from)
     and (p_to is null or x.due_on <= p_to);
  return jsonb_build_object('today', v_today, 'rows', v_rows);
end;
$$;

create function public.admin_system()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return jsonb_build_object(
    'latest_migration', (select max(version) from supabase_migrations.schema_migrations),
    'migrations', (select count(*) from supabase_migrations.schema_migrations),
    'users', (select count(*) from auth.users),
    'companies', (select count(*) from public.organisations),
    'documents', (select count(*) from public.documents where status = 'ready'),
    'pending_uploads', (select count(*) from public.documents where status <> 'ready'),
    'storage_bytes', (select coalesce(sum(size_bytes), 0) from public.documents where status = 'ready'),
    'platform_admins', (select count(*) from private.platform_admins where active)
  );
end;
$$;

create function public.admin_audit_entries(p_limit int default 100, p_offset int default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return coalesce((
    select jsonb_agg(row_to_json(r)::jsonb order by r.created_at desc, r.id desc) from (
      select l.id, l.created_at, l.action, l.target_type, l.target_id, l.summary,
             coalesce(nullif(p.full_name, ''), p.email) as admin
        from private.admin_audit_log l left join public.profiles p on p.id = l.admin_user_id
       order by l.created_at desc, l.id desc
       limit least(greatest(p_limit, 1), 500) offset greatest(p_offset, 0)) r), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Mutations (all audited)
-- ---------------------------------------------------------------------------

create function public.admin_set_member_role(p_membership uuid, p_role public.org_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.organisation_members%rowtype;
begin
  perform private.require_platform_admin();
  select * into v_member from public.organisation_members where id = p_membership for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_member.role = p_role then
    return;
  end if;
  update public.organisation_members set role = p_role where id = p_membership; -- last-owner guard applies
  perform private.admin_audit('membership_role_changed', 'membership', p_membership::text,
    jsonb_build_object('company_id', v_member.organisation_id, 'user_id', v_member.user_id, 'from', v_member.role, 'to', p_role));
end;
$$;

create function public.admin_remove_member(p_membership uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.organisation_members%rowtype;
begin
  perform private.require_platform_admin();
  select * into v_member from public.organisation_members where id = p_membership for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  delete from public.organisation_members where id = p_membership; -- last-owner guard applies
  perform private.admin_audit('membership_removed', 'membership', p_membership::text,
    jsonb_build_object('company_id', v_member.organisation_id, 'user_id', v_member.user_id, 'role', v_member.role));
end;
$$;

-- Disabling uses Supabase Auth's own ban mechanism (banned_until): sign-in and token refresh
-- are refused; existing sessions are revoked. Re-enabling clears it. Admins can't disable
-- themselves (no locking the platform out).
create function public.admin_set_user_disabled(p_user uuid, p_disabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  if p_user = auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- 100 years — a finite date, as Auth's own ban API uses.
  update auth.users set banned_until = case when p_disabled then now() + interval '100 years' else null end where id = p_user;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_disabled then
    delete from auth.sessions where user_id = p_user;
  end if;
  perform private.admin_audit(case when p_disabled then 'account_disabled' else 'account_enabled' end, 'user', p_user::text, '{}'::jsonb);
end;
$$;

create function public.admin_revoke_sessions(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  delete from auth.sessions where user_id = p_user;
  perform private.admin_audit('sessions_revoked', 'user', p_user::text, '{}'::jsonb);
end;
$$;

-- Records the reset request and returns the address the normal reset email goes to. The
-- reset itself is Supabase's public flow; nobody sees or sets a password.
create function public.admin_password_reset_target(p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  perform private.require_platform_admin();
  select email into v_email from auth.users where id = p_user and email_confirmed_at is not null;
  if v_email is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform private.admin_audit('password_reset_requested', 'user', p_user::text, '{}'::jsonb);
  return v_email;
end;
$$;

-- ---------------------------------------------------------------------------
-- Bootstrap (database owner only — never callable through the API)
-- ---------------------------------------------------------------------------

create function private.bootstrap_platform_admin(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  select array_agg(id) into v_ids from auth.users
   where lower(email) = lower(btrim(p_email)) and email_confirmed_at is not null;
  if v_ids is null or array_length(v_ids, 1) = 0 then
    raise exception 'no confirmed account with this email';
  end if;
  if array_length(v_ids, 1) > 1 then
    raise exception 'more than one account matches; refusing';
  end if;
  insert into private.platform_admins (user_id, notes) values (v_ids[1], 'bootstrap')
  on conflict (user_id) do update set active = true;
  insert into private.admin_audit_log (admin_user_id, action, target_type, target_id, summary)
  values (null, 'platform_admin_granted', 'user', v_ids[1]::text, '{"via": "bootstrap"}');
  return v_ids[1];
end;
$$;

revoke all on function private.bootstrap_platform_admin(text) from public, anon, authenticated;

revoke all on function public.am_platform_admin(), public.admin_overview(), public.admin_users(text, int, int),
  public.admin_user(uuid), public.admin_companies(text, int, int), public.admin_company(uuid),
  public.admin_deadlines(uuid, text, text, text, date, date, boolean, uuid), public.admin_system(),
  public.admin_audit_entries(int, int), public.admin_set_member_role(uuid, public.org_role),
  public.admin_remove_member(uuid), public.admin_set_user_disabled(uuid, boolean),
  public.admin_revoke_sessions(uuid), public.admin_password_reset_target(uuid) from public;
grant execute on function public.am_platform_admin(), public.admin_overview(), public.admin_users(text, int, int),
  public.admin_user(uuid), public.admin_companies(text, int, int), public.admin_company(uuid),
  public.admin_deadlines(uuid, text, text, text, date, date, boolean, uuid), public.admin_system(),
  public.admin_audit_entries(int, int), public.admin_set_member_role(uuid, public.org_role),
  public.admin_remove_member(uuid), public.admin_set_user_disabled(uuid, boolean),
  public.admin_revoke_sessions(uuid), public.admin_password_reset_target(uuid) to authenticated;
