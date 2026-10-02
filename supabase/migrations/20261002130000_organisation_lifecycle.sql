-- KAIDLY: organisation lifecycle — owners can delete an empty organisation and deactivate
-- (and reactivate) one that has operational history.
--
-- Retention and privacy-erasure rules are not decided yet (docs/IMPLEMENTATION_PLAN.md), so
-- an organisation with operational history is never physically deleted:
--   * delete_organisation(org, typed name) — owner only; refused with
--     'organisation_has_history' if the organisation has any operating-log entry (incl.
--     activity completions), deficiency or document. Otherwise everything is removed in one
--     transaction; user accounts are untouched.
--   * deactivate_organisation(org, typed name) — owner only; sets deactivated_at. All data
--     stays; members can still read it, but every write is refused because org_ids() (the
--     helper behind every write policy and RPC role check) no longer returns the
--     organisation for any role above viewer. New members can't join.
--   * reactivate_organisation(org) — owner only; undoes deactivation.
-- The typed-name confirmation is checked in the database, not only in the UI.

alter table public.organisations
  add column deactivated_at timestamptz,
  add column deactivated_by uuid references public.profiles (id) on delete set null;

comment on column public.organisations.deactivated_at is
  'Set by deactivate_organisation(): no writes allowed (org_ids excludes it above viewer); data preserved and readable.';

-- Deactivated organisations grant read access only.
create or replace function private.org_ids(min_role public.org_role default 'viewer')
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organisation_id
    from public.organisation_members m
    join public.organisations o on o.id = m.organisation_id
   where m.user_id = (select auth.uid())
     and private.role_rank(m.role) >= private.role_rank(min_role)
     and (min_role = 'viewer' or o.deactivated_at is null)
$$;

create or replace function private.record_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 set search_path = ''
AS $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
begin
  -- The organisation is being deleted (delete_organisation): its history goes with it.
  if coalesce(current_setting('kaidly.deleting_organisation', true), '') <> ''
     and current_setting('kaidly.deleting_organisation', true) =
         (case when tg_table_name = 'organisations' then coalesce(to_jsonb(new), to_jsonb(old)) ->> 'id'
               else coalesce(to_jsonb(new), to_jsonb(old)) ->> 'organisation_id' end) then
    return null;
  end if;
  -- Secrets never enter history.
  if tg_op <> 'INSERT' then v_old := to_jsonb(old) - 'token_hash'; end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new) - 'token_hash'; end if;

  if tg_op = 'UPDATE' and (v_old - 'updated_at') = (v_new - 'updated_at') then
    return null;
  end if;

  v_row := coalesce(v_new, v_old);

  insert into public.activity_history
    (organisation_id, actor_id, table_name, record_id, action, old_data, new_data)
  values (
    (case when tg_table_name = 'organisations' then v_row ->> 'id'
          else v_row ->> 'organisation_id' end)::uuid,
    auth.uid(),
    tg_table_name,
    (v_row ->> 'id')::uuid,
    lower(tg_op),
    v_old,
    v_new
  );
  return null;
end;
$$;

create or replace function private.protect_last_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 set search_path = ''
AS $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    -- The organisation itself is being deleted (delete_organisation, or cascade): nothing to protect.
    if current_setting('kaidly.deleting_organisation', true) = old.organisation_id::text then
      return case when tg_op = 'DELETE' then old else new end;
    end if;
    if not exists (select 1 from public.organisations where id = old.organisation_id) then
      return case when tg_op = 'DELETE' then old else new end;
    end if;

    -- Serialise concurrent ownership changes in the same organisation.
    perform 1 from public.organisations where id = old.organisation_id for update;

    if not exists (
      select 1
        from public.organisation_members
       where organisation_id = old.organisation_id
         and role = 'owner'
         and user_id <> old.user_id
    ) then
      raise exception 'last_owner'
        using errcode = 'P0001',
              detail = 'An organisation must always have at least one owner.';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Nobody joins a deactivated organisation (invitations are accepted through a definer RPC).
create function private.organisation_member_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.organisations where id = new.organisation_id and deactivated_at is not null) then
    raise exception 'organisation_deactivated' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger organisation_member_before_insert
  before insert on public.organisation_members
  for each row execute function private.organisation_member_before_insert();

-- Owner check that ignores deactivation (an owner must be able to reactivate).
create function private.is_owner(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organisation_members
     where organisation_id = org and user_id = (select auth.uid()) and role = 'owner'
  )
$$;

create function public.delete_organisation(p_organisation_id uuid, p_confirm_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select name into v_name from public.organisations where id = p_organisation_id for update;
  if not found or not private.is_owner(p_organisation_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if btrim(coalesce(p_confirm_name, '')) <> v_name then
    raise exception 'confirmation_mismatch' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.log_entries where organisation_id = p_organisation_id)
     or exists (select 1 from public.deficiencies where organisation_id = p_organisation_id)
     or exists (select 1 from public.documents where organisation_id = p_organisation_id) then
    raise exception 'organisation_has_history' using errcode = 'P0001';
  end if;

  -- Transaction-local marker honoured by record_history and protect_last_owner for this
  -- organisation only.
  perform set_config('kaidly.deleting_organisation', p_organisation_id::text, true);
  delete from public.scheduled_activities where organisation_id = p_organisation_id;
  delete from public.organisation_invitations where organisation_id = p_organisation_id;
  delete from public.organisation_members where organisation_id = p_organisation_id;
  -- Sites, installations and change history cascade.
  delete from public.organisations where id = p_organisation_id;
  perform set_config('kaidly.deleting_organisation', '', true);
end;
$$;

create function public.deactivate_organisation(p_organisation_id uuid, p_confirm_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select name into v_name from public.organisations where id = p_organisation_id for update;
  if not found or not private.is_owner(p_organisation_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if btrim(coalesce(p_confirm_name, '')) <> v_name then
    raise exception 'confirmation_mismatch' using errcode = 'P0001';
  end if;
  update public.organisations
     set deactivated_at = coalesce(deactivated_at, now()), deactivated_by = coalesce(deactivated_by, auth.uid())
   where id = p_organisation_id;
end;
$$;

create function public.reactivate_organisation(p_organisation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organisations where id = p_organisation_id)
     or not private.is_owner(p_organisation_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.organisations set deactivated_at = null, deactivated_by = null where id = p_organisation_id;
end;
$$;

revoke all on function private.organisation_member_before_insert(), private.is_owner(uuid) from public;
revoke all on function public.delete_organisation(uuid, text), public.deactivate_organisation(uuid, text),
  public.reactivate_organisation(uuid) from public;
grant execute on function public.delete_organisation(uuid, text), public.deactivate_organisation(uuid, text),
  public.reactivate_organisation(uuid) to authenticated;
