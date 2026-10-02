-- CSV import (v1): existing sites and electrical installations of a company, from rows the
-- browser parsed and the user reviewed. Operating history (log entries, deficiency
-- resolutions, documents) is deliberately NOT importable — it needs its own provenance model.
--
-- * public.import_company_data(org, kind, rows, token) — owner/admin of a writable company
--   (private.org_ids('admin'): membership, live session, not deactivated, trial/active).
--   Validates every row again (the browser preview is a convenience) and inserts all rows
--   in one statement: either every row is created or none is. Errors are codes with the
--   1-based row number in DETAIL; never database text.
-- * Idempotent per import attempt: the client sends a random token; a repeated call with
--   the same token (double submit, retry after a lost response) returns the first result
--   and creates nothing.
-- * private.import_batches — who imported what and when (row counts, created ids); no file
--   contents are stored. Not readable through the API.
-- Technical safety limit (not a commercial quota): 1000 rows per import.

create table private.import_batches (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  kind text not null check (kind in ('sites', 'installations')),
  client_token uuid not null,
  row_count int not null check (row_count between 1 and 1000),
  created_ids uuid[] not null default '{}',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organisation_id, client_token)
);

revoke all on table private.import_batches from public, anon, authenticated;

create function private.import_text(p_row jsonb, p_key text, p_max int, p_line int)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := nullif(btrim(coalesce(p_row ->> p_key, '')), '');
begin
  if v is null then
    return null;
  end if;
  if char_length(v) > p_max then
    raise exception 'import_value_too_long' using errcode = 'P0001', detail = p_line::text;
  end if;
  -- Spreadsheet formulas are never stored (exports neutralise them as well).
  if left(v, 1) in ('=', '@') then
    raise exception 'import_formula_value' using errcode = 'P0001', detail = p_line::text;
  end if;
  return v;
end;
$$;

revoke all on function private.import_text(jsonb, text, int, int) from public, anon, authenticated;

create function public.import_company_data(p_org uuid, p_kind text, p_rows jsonb, p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch uuid;
  v_existing private.import_batches%rowtype;
  v_count int;
  v_row jsonb;
  v_line int := 0;
  v_name text;
  v_site_name text;
  v_site uuid;
  v_identifier text;
  v_type text;
  v_date text;
  v_day date;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_seen text[] := '{}';
  v_key text;
begin
  -- Same rule as the RLS insert policies of sites and installations.
  if p_org is null or p_org not in (select private.org_ids('admin')) then
    -- An owner/admin of a read-only (expired or deactivated) company gets a clear reason.
    if p_org in (select private.org_ids('viewer')) and exists (
         select 1 from public.organisation_members m
          where m.organisation_id = p_org and m.user_id = auth.uid() and m.role in ('owner', 'admin')) then
      raise exception 'company_read_only' using errcode = '42501';
    end if;
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_kind not in ('sites', 'installations') then
    raise exception 'import_kind_invalid' using errcode = 'P0001';
  end if;
  if p_token is null then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'import_empty' using errcode = 'P0001';
  end if;
  v_count := jsonb_array_length(p_rows);
  if v_count > 1000 then
    raise exception 'import_too_many_rows' using errcode = 'P0001';
  end if;

  -- One result per attempt: a repeated token returns the first import.
  insert into private.import_batches (organisation_id, kind, client_token, row_count, created_by)
  values (p_org, p_kind, p_token, v_count, auth.uid())
  on conflict (organisation_id, client_token) do nothing
  returning id into v_batch;
  if v_batch is null then
    select * into v_existing from private.import_batches
     where organisation_id = p_org and client_token = p_token;
    return jsonb_build_object('batch', v_existing.id, 'kind', v_existing.kind,
      'created', coalesce(array_length(v_existing.created_ids, 1), 0), 'repeated', true);
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_line := v_line + 1;
    if jsonb_typeof(v_row) <> 'object' then
      raise exception 'invalid_input' using errcode = 'P0001', detail = v_line::text;
    end if;
    v_name := private.import_text(v_row, 'name', 200, v_line);
    if v_name is null then
      raise exception 'import_name_required' using errcode = 'P0001', detail = v_line::text;
    end if;

    if p_kind = 'sites' then
      v_key := lower(v_name);
      if v_key = any (v_seen) then
        raise exception 'import_duplicate_row' using errcode = 'P0001', detail = v_line::text;
      end if;
      v_seen := v_seen || v_key;
      if exists (select 1 from public.sites
                  where organisation_id = p_org and archived_at is null and lower(name) = v_key) then
        raise exception 'import_site_exists' using errcode = 'P0001', detail = v_line::text;
      end if;
      insert into public.sites (organisation_id, name, address, description, responsible_person)
      values (p_org, v_name,
              private.import_text(v_row, 'address', 300, v_line),
              private.import_text(v_row, 'description', 5000, v_line),
              private.import_text(v_row, 'responsible_person', 200, v_line))
      returning id into v_id;
    else
      v_site_name := private.import_text(v_row, 'site', 200, v_line);
      if v_site_name is null then
        raise exception 'import_site_missing' using errcode = 'P0001', detail = v_line::text;
      end if;
      -- Sites are matched by exact name (case-insensitive) within this company only.
      select min(id::text)::uuid, count(*) into v_site, v_count
        from public.sites
       where organisation_id = p_org and archived_at is null and lower(name) = lower(v_site_name);
      if v_count = 0 then
        raise exception 'import_site_missing' using errcode = 'P0001', detail = v_line::text;
      elsif v_count > 1 then
        raise exception 'import_site_ambiguous' using errcode = 'P0001', detail = v_line::text;
      end if;

      v_identifier := private.import_text(v_row, 'identifier', 50, v_line);
      if v_identifier is not null then
        v_key := v_site::text || '/' || lower(v_identifier);
        if v_key = any (v_seen) then
          raise exception 'import_duplicate_identifier' using errcode = 'P0001', detail = v_line::text;
        end if;
        v_seen := v_seen || v_key;
        if exists (select 1 from public.electrical_installations
                    where site_id = v_site and lower(identifier) = lower(v_identifier)) then
          raise exception 'import_identifier_exists' using errcode = 'P0001', detail = v_line::text;
        end if;
      end if;

      v_type := lower(coalesce(private.import_text(v_row, 'type', 30, v_line), 'other'));
      if v_type not in (select e.enumlabel from pg_catalog.pg_enum e
                         where e.enumtypid = 'public.installation_type'::regtype) then
        raise exception 'import_type_invalid' using errcode = 'P0001', detail = v_line::text;
      end if;

      v_date := private.import_text(v_row, 'commissioned_on', 10, v_line);
      v_day := null;
      if v_date is not null then
        if v_date !~ '^\d{4}-\d{2}-\d{2}$' then
          raise exception 'import_date_invalid' using errcode = 'P0001', detail = v_line::text;
        end if;
        begin
          v_day := v_date::date;
        exception when others then
          raise exception 'import_date_invalid' using errcode = 'P0001', detail = v_line::text;
        end;
        if v_day not between '1900-01-01' and '2100-12-31' then
          raise exception 'import_date_invalid' using errcode = 'P0001', detail = v_line::text;
        end if;
      end if;

      insert into public.electrical_installations
        (organisation_id, site_id, name, identifier, installation_type, location, commissioned_on,
         responsible_person, notes)
      values (p_org, v_site, v_name, v_identifier, v_type::public.installation_type,
              private.import_text(v_row, 'location', 200, v_line), v_day,
              private.import_text(v_row, 'responsible_person', 200, v_line),
              private.import_text(v_row, 'notes', 5000, v_line))
      returning id into v_id;
    end if;
    v_ids := v_ids || v_id;
  end loop;

  update private.import_batches set created_ids = v_ids where id = v_batch;
  return jsonb_build_object('batch', v_batch, 'kind', p_kind, 'created', array_length(v_ids, 1), 'repeated', false);
end;
$$;

revoke all on function public.import_company_data(uuid, text, jsonb, uuid) from public, anon;
grant execute on function public.import_company_data(uuid, text, jsonb, uuid) to authenticated;
