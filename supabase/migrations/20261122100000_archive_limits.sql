-- Archiving without abuse (owner decision 2026-11-21, docs/ARCHIVE.md).
--
-- 1. Restoring an archived installation needs a free active slot (unchanged rule, now with
--    its own error 'plan_restore_limit' for the message).
-- 2. The archive holds at most as many installations as the plan allows active ones
--    (same installation_limit; trial 10; no limit = no limit). Full → 'plan_archive_limit'.
-- 3. An archived installation is locked: no new or changed plan activities, deficiencies or
--    audits, no edits of the installation itself — only restoring (log entries and documents
--    were already refused).
-- 4. Archived installations/sites generate no reminders and no reminder e-mails.
-- 5. delete_installation(): an empty installation can be deleted; an archived one with
--    history can be deleted after export ("Ekspordi ja kustuta", name confirmed). The change
--    history keeps one note (name, site, counts, who, when) — no content.
-- 6. admin_archive_churn(): companies with more than N restore cycles in N days (metadata).

-- ---------------------------------------------------------------------------
-- Limits (same trigger and lock as the active-installation limit)
-- ---------------------------------------------------------------------------

create function private.installations_archived(p_org uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.electrical_installations i where i.organisation_id = p_org and i.archived_at is not null
$$;
revoke all on function private.installations_archived(uuid) from public, anon, authenticated;

create or replace function private.installation_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_access private.organisation_access;
  v_archiving boolean := tg_op = 'UPDATE' and old.archived_at is null and new.archived_at is not null;
  v_restoring boolean := tg_op = 'UPDATE' and old.archived_at is not null and new.archived_at is null;
  v_new_active boolean := tg_op = 'INSERT' and new.archived_at is null;
begin
  if not (v_archiving or v_restoring or v_new_active) then
    return new;
  end if;
  -- Members only, before anything that could describe another tenant (100_cross_tenant_oracles).
  if auth.uid() is not null and not private.has_org_role(new.organisation_id, 'viewer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_access := private.lock_company_limits(new.organisation_id);
  if v_access.installation_limit is null then
    return new;
  end if;
  if v_archiving and private.installations_archived(new.organisation_id) + 1 > v_access.installation_limit then
    raise exception 'plan_archive_limit' using errcode = 'P0001';
  end if;
  if v_restoring and private.installations_active(new.organisation_id) + 1 > v_access.installation_limit then
    raise exception 'plan_restore_limit' using errcode = 'P0001';
  end if;
  if v_new_active and private.installations_active(new.organisation_id) + 1 > v_access.installation_limit then
    raise exception 'plan_installation_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- An archived installation is locked
-- ---------------------------------------------------------------------------

create function private.ensure_installation_active()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not private.has_org_role(new.organisation_id, 'viewer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.electrical_installations i
              where i.id = new.electrical_installation_id and i.organisation_id = new.organisation_id
                and i.archived_at is not null) then
    raise exception 'installation_archived' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.ensure_installation_active() from public, anon, authenticated;

-- Only the columns people (and the completion/resolve RPCs) change: foreign-key cascades such
-- as "set null" when a user is deleted must keep working on archived installations.
create trigger ensure_installation_active
  before insert or update of electrical_installation_id, title, description, frequency_type, interval_value,
    interval_unit, next_due_on, anchor_on, responsible_person_name, priority, reminder_days
  on public.scheduled_activities
  for each row execute function private.ensure_installation_active();
create trigger ensure_installation_active
  before insert or update of electrical_installation_id, title, description, severity, detected_at,
    responsible_person_name, due_on, status, resolution, resolved_at, photos_url
  on public.deficiencies
  for each row execute function private.ensure_installation_active();
create trigger ensure_installation_active
  before insert on public.installation_audits
  for each row execute function private.ensure_installation_active();

-- The archived installation itself: only restoring is possible.
create function private.installation_archived_is_read_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.archived_at is not null and new.archived_at is not null then
    raise exception 'installation_archived' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.installation_archived_is_read_only() from public, anon, authenticated;

create trigger installation_archived_is_read_only
  before update of site_id, name, identifier, installation_type, location, description,
    commissioned_on, status, responsible_person, notes
  on public.electrical_installations
  for each row execute function private.installation_archived_is_read_only();

-- ---------------------------------------------------------------------------
-- No reminders for archived installations/sites
-- ---------------------------------------------------------------------------

create or replace function private.generate_activity_reminders(
  p_today date default null,
  p_activity uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := coalesce(p_today, private.business_date());
  v_count integer;
begin
  with due as (
    select a.id, a.organisation_id, a.next_due_on,
           (select min(t) from unnest(a.reminder_days) t where a.next_due_on - v_today <= t) as threshold
      from public.scheduled_activities a
      join public.organisations o on o.id = a.organisation_id
     where a.archived_at is null
       and a.next_due_on is not null
       -- Archived installations and sites are out of use: no reminders (archive_limits).
       and not exists (select 1 from public.electrical_installations i
                        where i.id = a.electrical_installation_id and i.archived_at is not null)
       and not exists (select 1 from public.sites s where s.id = a.site_id and s.archived_at is not null)
       and o.deactivated_at is null
       and (p_activity is null or a.id = p_activity)
  ),
  inserted as (
    insert into public.notifications (user_id, organisation_id, scheduled_activity_id, due_on, threshold_days)
    select m.user_id, d.organisation_id, d.id, d.next_due_on, d.threshold
      from due d
      join public.organisation_members m
        on m.organisation_id = d.organisation_id and m.role in ('owner', 'admin', 'operator')
      join auth.users u on u.id = m.user_id
     where d.threshold is not null
       and (u.banned_until is null or u.banned_until <= now())
    on conflict on constraint notifications_identity do nothing
    returning 1
  )
  select count(*) into v_count from inserted;
  return v_count;
end;
$$;


create or replace function private.email_block_reason(p_outbox uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from private.email_outbox o
                   join public.notification_preferences p on p.user_id = o.user_id
                  where o.id = p_outbox and not p.email_deadline_reminders) then 'preference_off'
    when not exists (select 1 from private.email_outbox o join auth.users u on u.id = o.user_id
                      where o.id = p_outbox and u.email is not null and u.email_confirmed_at is not null) then 'no_email'
    when exists (select 1 from private.email_outbox o join auth.users u on u.id = o.user_id
                  where o.id = p_outbox and u.banned_until is not null and u.banned_until > now()) then 'user_disabled'
    when not exists (
      select 1
        from private.email_outbox o
        join private.email_outbox_items it on it.outbox_id = o.id
        join public.notifications n on n.id = it.notification_id and n.user_id = o.user_id
        join public.scheduled_activities sa on sa.id = n.scheduled_activity_id and sa.archived_at is null
        join public.electrical_installations ei on ei.id = sa.electrical_installation_id and ei.archived_at is null
        join public.organisations org on org.id = n.organisation_id and org.deactivated_at is null
        join public.organisation_members m
          on m.organisation_id = n.organisation_id and m.user_id = o.user_id
         and m.role in ('owner', 'admin', 'operator')
       where o.id = p_outbox and n.read_at is null) then 'not_eligible'
  end
$$;


-- ---------------------------------------------------------------------------
-- Deleting an installation
-- ---------------------------------------------------------------------------

-- The keep-forever guards step aside only inside delete_installation() for that one
-- installation (transaction-local setting; not settable through the API).
create or replace function private.log_entries_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and current_setting('kaidly.purge_installation', true) = old.electrical_installation_id::text then
    return old;
  end if;
  raise exception 'log_entries_append_only'
    using errcode = 'P0001',
          detail = 'Operating log entries are never changed. Add a correction instead.';
end;
$$;

create or replace function private.deficiencies_no_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('kaidly.purge_installation', true) = old.electrical_installation_id::text then
    return old;
  end if;
  raise exception 'deficiencies_are_kept' using errcode = 'P0001';
end;
$$;

create or replace function private.document_before_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.electrical_installation_id is not null
     and current_setting('kaidly.purge_installation', true) = old.electrical_installation_id::text then
    return old;
  end if;
  if old.status = 'ready' then
    raise exception 'documents_are_kept' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

-- Owner/admin of a writable company. Empty installation: deleted at once. With history: only
-- when archived and the exact name is confirmed (the app has the user export the audit package
-- and the CSV first). Files still in Storage block it (delete them first).
create function public.delete_installation(p_installation_id uuid, p_confirm_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_inst public.electrical_installations%rowtype;
  v_site text;
  v_entries integer;
  v_activities integer;
  v_deficiencies integer;
  v_documents integer;
  v_audits integer;
  v_ids uuid[];
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_inst from public.electrical_installations where id = p_installation_id for update;
  if not found or not private.has_org_role(v_inst.organisation_id, 'admin') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select count(*) into v_entries from public.log_entries where electrical_installation_id = v_inst.id;
  select count(*) into v_activities from public.scheduled_activities where electrical_installation_id = v_inst.id;
  select count(*) into v_deficiencies from public.deficiencies where electrical_installation_id = v_inst.id;
  select count(*) into v_documents from public.documents where electrical_installation_id = v_inst.id;
  select count(*) into v_audits from public.installation_audits where electrical_installation_id = v_inst.id;

  if v_entries + v_activities + v_deficiencies + v_documents + v_audits > 0 then
    if v_inst.archived_at is null then
      raise exception 'installation_not_archived' using errcode = 'P0001';
    end if;
    if p_confirm_name is null or btrim(p_confirm_name) <> v_inst.name then
      raise exception 'confirm_name_mismatch' using errcode = 'P0001';
    end if;
  end if;
  if exists (select 1 from public.documents d where d.electrical_installation_id = v_inst.id
              and d.storage_path is not null and d.deleted_at is null) then
    raise exception 'installation_has_files' using errcode = 'P0001';
  end if;

  select s.name into v_site from public.sites s where s.id = v_inst.site_id;
  perform set_config('kaidly.purge_installation', v_inst.id::text, true);

  -- Every record id of the installation, so its change history goes too (content).
  select array_agg(id) into v_ids from (
    select id from public.documents where electrical_installation_id = v_inst.id
    union all select id from public.deficiencies where electrical_installation_id = v_inst.id
    union all select id from public.scheduled_activities where electrical_installation_id = v_inst.id
    union all select id from public.log_entries where electrical_installation_id = v_inst.id
    union all select v_inst.id
  ) x;

  delete from public.documents where electrical_installation_id = v_inst.id;
  delete from public.log_entries where electrical_installation_id = v_inst.id and correction_of_id is not null;
  delete from public.log_entries where electrical_installation_id = v_inst.id;
  delete from public.deficiencies where electrical_installation_id = v_inst.id;
  delete from public.installation_audits where electrical_installation_id = v_inst.id;
  delete from public.scheduled_activities where electrical_installation_id = v_inst.id;
  delete from public.electrical_installations where id = v_inst.id;

  perform set_config('kaidly.purge_installation', '', true);
  delete from public.activity_history where organisation_id = v_inst.organisation_id and record_id = any (v_ids);
  insert into public.activity_history (organisation_id, actor_id, table_name, record_id, action, old_data, new_data)
  values (v_inst.organisation_id, v_user, 'electrical_installations', v_inst.id, 'delete',
          jsonb_build_object('name', v_inst.name, 'identifier', v_inst.identifier, 'site', v_site,
                             'log_entries', v_entries, 'activities', v_activities, 'deficiencies', v_deficiencies,
                             'documents', v_documents, 'audits', v_audits, 'deleted', true),
          null);
  return jsonb_build_object('site_id', v_inst.site_id, 'log_entries', v_entries);
end;
$$;
revoke all on function public.delete_installation(uuid, text) from public, anon;
grant execute on function public.delete_installation(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Platform admin: archive/restore churn (metadata only)
-- ---------------------------------------------------------------------------

create function public.admin_archive_churn(p_days integer default 30, p_min_cycles integer default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object('organisation_id', x.organisation_id, 'name', o.name, 'slug', o.slug,
                                        'archives', x.archives, 'restores', x.restores)
                     order by x.restores desc, o.name)
      from (
        select h.organisation_id,
               count(*) filter (where h.old_data ->> 'archived_at' is null and h.new_data ->> 'archived_at' is not null) as archives,
               count(*) filter (where h.old_data ->> 'archived_at' is not null and h.new_data ->> 'archived_at' is null) as restores
          from public.activity_history h
         where h.table_name = 'electrical_installations'
           and h.action = 'update'
           and h.created_at > now() - make_interval(days => greatest(1, least(p_days, 365)))
         group by h.organisation_id
      ) x
      join public.organisations o on o.id = x.organisation_id
     where x.restores > p_min_cycles
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.admin_archive_churn(integer, integer) from public, anon;
grant execute on function public.admin_archive_churn(integer, integer) to authenticated;
