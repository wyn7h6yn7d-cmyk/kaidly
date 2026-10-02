-- KAIDLY release hardening (launch blockers):
--
-- 1. Upload abuse protection, enforced in the database so direct API calls can't bypass it.
--    Every document registration (the step before a browser may upload to Storage) is
--    counted in private.upload_events — including ones later abandoned or deleted, so
--    failed or cleaned-up attempts still count. Limits live in one config row
--    (private.upload_limits) and can be changed with SQL, without a deploy. This is
--    abuse/resource protection, not a commercial storage quota (not decided yet).
-- 2. Session revocation: private.org_ids() and private.org_ids_readable() — the base of
--    every tenant read and write policy and every RPC role check — now require that the
--    caller's Auth session still exists and the account is not banned. Revoking sessions,
--    "sign out other devices", a password change or a platform-admin disable therefore
--    cuts data access at once, instead of when the access token expires.

-- ---------------------------------------------------------------------------
-- 1. Upload limits
-- ---------------------------------------------------------------------------

create table private.upload_limits (
  id boolean primary key default true check (id),
  per_user_hour integer not null check (per_user_hour > 0),
  per_user_day integer not null check (per_user_day > 0),
  bytes_per_user_day bigint not null check (bytes_per_user_day > 0),
  pending_per_user integer not null check (pending_per_user > 0),
  per_org_day integer not null check (per_org_day > 0),
  bytes_per_org_day bigint not null check (bytes_per_org_day > 0)
);

-- A technician photographing a switchboard room uploads tens of files in an hour; a whole
-- company rarely more than a few hundred a day. These leave ample room for that and stop
-- scripted floods (25 MB per file is the bucket limit).
insert into private.upload_limits values (true, 100, 400, 4::bigint * 1024 * 1024 * 1024, 30, 1500, 15::bigint * 1024 * 1024 * 1024);

create table private.upload_events (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  organisation_id uuid not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);
create index upload_events_user_idx on private.upload_events (user_id, created_at);
create index upload_events_org_idx on private.upload_events (organisation_id, created_at);

revoke all on table private.upload_limits, private.upload_events from public, anon, authenticated;

-- Runs after document_before_insert (alphabetical order), so uploaded_by is the session user.
create function private.document_upload_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l private.upload_limits;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return new; -- seed / maintenance without a session
  end if;
  select * into l from private.upload_limits;
  -- Serialise registrations of one user so parallel requests can't race past the limits.
  perform pg_advisory_xact_lock(hashtext('kaidly-upload:' || v_user::text));
  if (select count(*) from private.upload_events where user_id = v_user and created_at > now() - interval '1 hour') >= l.per_user_hour
     or (select count(*) from private.upload_events where user_id = v_user and created_at > now() - interval '24 hours') >= l.per_user_day
     or (select coalesce(sum(size_bytes), 0) from private.upload_events where user_id = v_user and created_at > now() - interval '24 hours') + new.size_bytes > l.bytes_per_user_day
     or (select count(*) from public.documents where uploaded_by = v_user and status = 'pending') >= l.pending_per_user
     or (select count(*) from private.upload_events where organisation_id = new.organisation_id and created_at > now() - interval '24 hours') >= l.per_org_day
     or (select coalesce(sum(size_bytes), 0) from private.upload_events where organisation_id = new.organisation_id and created_at > now() - interval '24 hours') + new.size_bytes > l.bytes_per_org_day
  then
    raise exception 'upload_rate_limited' using errcode = 'P0001';
  end if;
  insert into private.upload_events (user_id, organisation_id, size_bytes) values (v_user, new.organisation_id, new.size_bytes);
  return new;
end;
$$;

revoke all on function private.document_upload_limits() from public, anon, authenticated;

create trigger zz_document_upload_limits
  before insert on public.documents
  for each row execute function private.document_upload_limits();

-- Counters only need the last 24 hours.
select cron.schedule('kaidly-upload-events-cleanup', '40 3 * * *', $$delete from private.upload_events where created_at < now() - interval '3 days'$$);

-- ---------------------------------------------------------------------------
-- 2. Revoked sessions and disabled accounts lose access immediately
-- ---------------------------------------------------------------------------

-- True when the request's Auth session still exists and the account is not banned.
-- Tokens issued by Supabase Auth always carry session_id; requests without one (database
-- maintenance, tests that set claims directly) have no session to check.
create function private.session_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
      coalesce((select auth.jwt() ->> 'session_id'), '') = ''
      or exists (
        select 1 from auth.sessions s
         where s.id = ((select auth.jwt() ->> 'session_id'))::uuid
           and s.user_id = (select auth.uid())
           and (s.not_after is null or s.not_after > now())
      )
    )
    and not exists (select 1 from auth.users u where u.id = (select auth.uid()) and u.banned_until > now())
$$;

revoke all on function private.session_active() from public, anon, authenticated;

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
     and (select private.session_active())
     and private.role_rank(m.role) >= private.role_rank(min_role)
     and (min_role = 'viewer' or (o.deactivated_at is null and private.can_company_write(o.id)))
$$;

create or replace function private.org_ids_readable(min_role public.org_role default 'viewer')
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
     and (select private.session_active())
     and private.role_rank(m.role) >= private.role_rank(min_role)
     and (min_role = 'viewer' or o.deactivated_at is null)
$$;
