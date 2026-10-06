-- Launch pricing (docs/SUBSCRIPTIONS.md): fixed plan defaults, custom plans, user seats
-- (members of every role + pending invitations), active installation limits, paid periods
-- (calendar months, renewal from paid-until, restart after expiry), read-only expiry and
-- restore, the customer view without admin fields, and that only platform admins can read
-- or change subscriptions.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

select plan(122);

insert into test_users (name, id, email) values ('platform', 'c0000000-0000-4000-8000-0000000000ad', 'platvorm@example.ee');
insert into auth.users (id, email, email_confirmed_at, aud, role)
values ('c0000000-0000-4000-8000-0000000000ad', 'platvorm@example.ee', now(), 'authenticated', 'authenticated');
select private.bootstrap_platform_admin('platvorm@example.ee');

-- Company C for seat tests: only its owner to begin with.
insert into test_users (name, id, email) values
  ('c_owner', 'e0000000-0000-4000-8000-000000000001', 'c.owner@example.ee'),
  ('c_two',   'e0000000-0000-4000-8000-000000000002', 'c.two@example.ee'),
  ('c_three', 'e0000000-0000-4000-8000-000000000003', 'c.three@example.ee'),
  ('c_four',  'e0000000-0000-4000-8000-000000000004', 'c.four@example.ee');
insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, email, now(), 'authenticated', 'authenticated' from test_users where name like 'c\_%';
insert into public.organisations (id, name, slug) values ('0c000000-0000-4000-8000-00000000000c', 'Kohtade OÜ', 'kohtade-ou-test');
insert into public.organisation_members (organisation_id, user_id, role) values ('0c000000-0000-4000-8000-00000000000c', pg_temp.uid('c_owner'), 'owner');
insert into test_orgs (name, id) values ('c', '0c000000-0000-4000-8000-00000000000c');
insert into public.sites (id, organisation_id, name) values ('5c000000-0000-4000-8000-0000000000c1', pg_temp.org('c'), 'C objekt');

-- Back to the database owner with no user claims (auth.uid() is null again).
create function pg_temp.root() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end $$;
grant execute on function pg_temp.root() to authenticated, anon;

create function pg_temp.access(p_org uuid) returns private.organisation_access language sql as $$
  select * from private.organisation_access where organisation_id = p_org $$;
create function pg_temp.status(p_org uuid) returns text language sql as $$
  select status from private.organisation_access_state(p_org) $$;
create function pg_temp.paid_until(p_org uuid) returns date language sql as $$
  select private.day_from_until(full_access_until) from private.organisation_access where organisation_id = p_org $$;
-- Platform admin call: sets a subscription and returns to the database owner.
create function pg_temp.sub(p_org uuid, p_plan text, p_months int default null, p_until date default null,
                            p_label text default null, p_price numeric default null, p_users int default null,
                            p_inst int default null, p_start date default null) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  perform pg_temp.login('platform');
  v := public.admin_set_subscription(p_org, p_plan, p_label, p_price, p_users, p_inst, p_months, p_until, p_start);
  perform pg_temp.root();
  return v;
end $$;
create function pg_temp.invite(p_org uuid, p_email text) returns void language plpgsql as $$
begin
  perform pg_temp.login(case when p_org = pg_temp.org('c') then 'c_owner' else 'a_owner' end);
  perform public.create_invitation(p_org, p_email, 'operator');
  perform pg_temp.root();
end $$;
create function pg_temp.install(p_org uuid, p_name text) returns uuid language sql as $$
  insert into public.electrical_installations (organisation_id, site_id, name, installation_type)
  values (p_org, case when p_org = pg_temp.org('c') then '5c000000-0000-4000-8000-0000000000c1'::uuid else pg_temp.site('a1') end,
          p_name, 'switchboard') returning id $$;
grant execute on function pg_temp.install(uuid, text) to authenticated;

-- ===========================================================================
-- Defaults: trials and existing companies have no limits
-- ===========================================================================

-- Companies created by the database owner (seed, fixtures, companies that existed before
-- the plans): no limits.
select ok((pg_temp.access(pg_temp.org('c'))).plan is null and (pg_temp.access(pg_temp.org('c'))).user_limit is null
          and (pg_temp.access(pg_temp.org('c'))).installation_limit is null, 'owner-created / existing companies: no plan and no limits');

-- ===========================================================================
-- Trial: a company created by a user has every feature, 1 user and 5 active installations
-- ===========================================================================

select pg_temp.login('outsider');
create temporary table trial_org as select public.create_organisation('Proovi OÜ') as slug;
select pg_temp.root();
grant select on trial_org to authenticated;
create function pg_temp.t() returns uuid language sql stable as $$
  select o.id from public.organisations o join trial_org t on t.slug = o.slug $$;
grant execute on function pg_temp.t() to authenticated;
select is(pg_temp.status(pg_temp.t()), 'trial', 'a new company starts its trial');
select is((select trial_ends_at - trial_started_at from private.organisation_access where organisation_id = pg_temp.t()),
  interval '14 days', 'the trial lasts 14 days');
select is(array[(pg_temp.access(pg_temp.t())).user_limit, (pg_temp.access(pg_temp.t())).installation_limit], array[1, 5],
  'trial limits: 1 user, 5 active installations');
select is((pg_temp.access(pg_temp.t())).plan, null, 'no plan during the trial');
select is(private.seats_used(pg_temp.t()), 1, 'the owner is the one user');
select pg_temp.login('outsider');
select throws_ok($$ select public.create_invitation(pg_temp.t(), 'kolleeg@example.ee', 'operator') $$, 'P0001', 'plan_user_limit',
  'trial: no second user can be invited');
insert into public.sites (organisation_id, name) values (pg_temp.t(), 'Proovi objekt');
create function pg_temp.trial_install(p_name text) returns uuid language sql as $$
  insert into public.electrical_installations (organisation_id, site_id, name, installation_type)
  select pg_temp.t(), s.id, p_name, 'switchboard' from public.sites s where s.organisation_id = pg_temp.t() limit 1
  returning id $$;
grant execute on function pg_temp.trial_install(text) to authenticated;
select lives_ok($$ select pg_temp.trial_install('P1'); select pg_temp.trial_install('P2'); select pg_temp.trial_install('P3');
                   select pg_temp.trial_install('P4'); select pg_temp.trial_install('P5') $$, 'trial: 5 active installations');
select throws_ok($$ select pg_temp.trial_install('P6') $$, 'P0001', 'plan_installation_limit', 'trial: the 6th is refused');
update public.electrical_installations set archived_at = now() where organisation_id = pg_temp.t() and name = 'P1';
select lives_ok($$ select pg_temp.trial_install('P6') $$, 'trial: archiving frees a slot');
-- Every feature works in the trial (here: operating log, plan, deficiency).
select lives_ok($$
  insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description)
  select pg_temp.t(), site_id, id, 'inspection', 'Proovi sissekanne' from public.electrical_installations where organisation_id = pg_temp.t() and archived_at is null limit 1;
  insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on)
  select pg_temp.t(), site_id, id, 'Proovi kontroll', 'once', current_date + 30 from public.electrical_installations where organisation_id = pg_temp.t() and archived_at is null limit 1;
  insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity)
  select pg_temp.t(), site_id, id, 'Proovi puudus', 'Kirjeldus', 'low' from public.electrical_installations where organisation_id = pg_temp.t() and archived_at is null limit 1
$$, 'trial: log, plan and deficiencies all work (no feature gating)');
select pg_temp.root();
select pg_temp.sub(pg_temp.t(), 'team');
select is(array[(pg_temp.access(pg_temp.t())).user_limit, (pg_temp.access(pg_temp.t())).installation_limit], array[3, 10],
  'assigning a plan replaces the trial limits');
select is(pg_temp.status(pg_temp.t()), 'trial', '(the trial period itself is unchanged by a plan-only change)');
select pg_temp.login('outsider');
select lives_ok($$ select public.create_invitation(pg_temp.t(), 'kolleeg@example.ee', 'operator') $$, 'after the plan change a colleague can be invited');
select pg_temp.root();

-- ===========================================================================
-- Fixed plans: the database sets price and limits, whatever the request says
-- ===========================================================================

select pg_temp.sub(pg_temp.org('b'), 'start', null, null, 'ignored', 1, 999, 999);
select is(array[(pg_temp.access(pg_temp.org('b'))).monthly_price, (pg_temp.access(pg_temp.org('b'))).user_limit,
                (pg_temp.access(pg_temp.org('b'))).installation_limit]::numeric[], array[19, 1, 5]::numeric[], 'Start: 19 € / 1 user / 5 installations');
select is((pg_temp.access(pg_temp.org('b'))).plan_label, null, 'fixed plans carry no custom label');
select pg_temp.sub(pg_temp.org('b'), 'team');
select is(array[(pg_temp.access(pg_temp.org('b'))).monthly_price, (pg_temp.access(pg_temp.org('b'))).user_limit,
                (pg_temp.access(pg_temp.org('b'))).installation_limit]::numeric[], array[29, 3, 10]::numeric[], 'Team: 29 € / 3 / 10');
select pg_temp.sub(pg_temp.org('b'), 'pro');
select is(array[(pg_temp.access(pg_temp.org('b'))).monthly_price, (pg_temp.access(pg_temp.org('b'))).user_limit,
                (pg_temp.access(pg_temp.org('b'))).installation_limit]::numeric[], array[39, 5, 25]::numeric[], 'Pro: 39 € / 5 / 25');
select pg_temp.sub(pg_temp.org('b'), 'business');
select is(array[(pg_temp.access(pg_temp.org('b'))).monthly_price, (pg_temp.access(pg_temp.org('b'))).user_limit,
                (pg_temp.access(pg_temp.org('b'))).installation_limit]::numeric[], array[89, 15, 100]::numeric[], 'Business: 89 € / 15 / 100');
select pg_temp.sub(pg_temp.org('b'), 'custom', null, null, 'Raamleping 2027', 149.5, 40, 300);
select is(array[(pg_temp.access(pg_temp.org('b'))).monthly_price, (pg_temp.access(pg_temp.org('b'))).user_limit,
                (pg_temp.access(pg_temp.org('b'))).installation_limit]::numeric[], array[149.5, 40, 300]::numeric[], 'Custom: the entered price and limits');
select is((pg_temp.access(pg_temp.org('b'))).plan_label, 'Raamleping 2027', 'Custom: the entered label');
select throws_ok($$ select pg_temp.sub(pg_temp.org('b'), 'custom', null, null, null, 10, 5, 5) $$, '22023', null, 'Custom needs a label');
select throws_ok($$ select pg_temp.sub(pg_temp.org('b'), 'custom', null, null, 'X', 10, 0, 5) $$, '22023', null, 'Custom needs at least one user');
select throws_ok($$ select pg_temp.sub(pg_temp.org('b'), 'gold') $$, '22023', null, 'unknown plans are refused');
select is(pg_temp.status(pg_temp.org('b')), 'trial', 'changing the plan alone does not activate or end anything');

-- ===========================================================================
-- Seats: owner counts, pending invitations reserve, removal/revoke/expiry frees
-- ===========================================================================

select pg_temp.sub(pg_temp.org('c'), 'start');
select is(private.seats_used(pg_temp.org('c')), 1, 'the owner counts as a user');
select throws_ok($$ select pg_temp.invite(pg_temp.org('c'), 'uus@example.ee') $$, 'P0001', 'plan_user_limit', 'Start: exactly one user — no invitations');
select is((select count(*)::int from public.organisation_invitations where organisation_id = pg_temp.org('c')), 0, 'nothing was stored');

select pg_temp.sub(pg_temp.org('c'), 'team');
select lives_ok($$ select pg_temp.invite(pg_temp.org('c'), 'c.two@example.ee') $$, 'Team: second user invited');
select lives_ok($$ select pg_temp.invite(pg_temp.org('c'), 'c.three@example.ee') $$, 'Team: third user invited');
select is(private.seats_used(pg_temp.org('c')), 3, 'owner + 2 pending invitations = 3 / 3');
select throws_ok($$ select pg_temp.invite(pg_temp.org('c'), 'c.four@example.ee') $$, 'P0001', 'plan_user_limit', 'Team: a fourth is refused (pending invitations reserve seats)');
select lives_ok($$ select pg_temp.invite(pg_temp.org('c'), 'c.three@example.ee') $$, 're-inviting the same person replaces the invitation, no extra seat');
select is(private.seats_used(pg_temp.org('c')), 3, 'still 3 / 3');

update public.organisation_invitations set revoked_at = now() where organisation_id = pg_temp.org('c') and email = 'c.three@example.ee' and revoked_at is null;
select is(private.seats_used(pg_temp.org('c')), 2, 'a cancelled invitation frees its seat');
select lives_ok($$ select pg_temp.invite(pg_temp.org('c'), 'c.four@example.ee') $$, 'and the seat can be used again');
update public.organisation_invitations set created_at = now() - interval '9 days', expires_at = now() - interval '1 day'
 where organisation_id = pg_temp.org('c') and email = 'c.four@example.ee' and revoked_at is null;
select is(private.seats_used(pg_temp.org('c')), 2, 'an expired invitation frees its seat');

-- Accepting fills the reserved seat; a member never exceeds the limit.
create function pg_temp.accept_as(p_user text, p_email text) returns text language plpgsql as $$
declare v_token text; v text;
begin
  perform pg_temp.login('c_owner');
  select token into v_token from public.create_invitation(pg_temp.org('c'), p_email, 'operator');
  perform pg_temp.login(p_user);
  v := public.accept_invitation(v_token);
  perform pg_temp.root();
  return v;
end $$;
select is(pg_temp.accept_as('c_three', 'c.three@example.ee'), 'kohtade-ou-test', 'an invited user joins');
select is((select count(*)::int from public.organisation_members where organisation_id = pg_temp.org('c')), 2, 'two members');
select is(private.seats_used(pg_temp.org('c')), 3, 'with c.two still pending: 3 / 3');

-- The limit is lowered while an invitation is pending: accepting it is refused safely.
select pg_temp.sub(pg_temp.org('c'), 'custom', null, null, 'Väike', 0, 2, 5);
update public.organisation_invitations set revoked_at = now() where organisation_id = pg_temp.org('c') and email = 'c.two@example.ee' and revoked_at is null;
select throws_ok($$ insert into public.organisation_invitations (organisation_id, email, role, token_hash, invited_by, expires_at)
                    values (pg_temp.org('c'), 'c.two@example.ee', 'operator', private.invitation_token_hash('known-token-c-two-0000000000000000000000'),
                            pg_temp.uid('c_owner'), now() + interval '7 days') $$, 'P0001', 'plan_user_limit', 'direct inserts are limited too (2 members, limit 2)');
select pg_temp.sub(pg_temp.org('c'), 'custom', null, null, 'Väike', 0, 3, 5);
insert into public.organisation_invitations (organisation_id, email, role, token_hash, invited_by, expires_at)
values (pg_temp.org('c'), 'c.two@example.ee', 'operator', private.invitation_token_hash('known-token-c-two-0000000000000000000000'),
        pg_temp.uid('c_owner'), now() + interval '7 days');
select pg_temp.sub(pg_temp.org('c'), 'custom', null, null, 'Väike', 0, 2, 5);
select pg_temp.login('c_two');
select throws_ok($$ select public.accept_invitation('known-token-c-two-0000000000000000000000') $$, 'P0001', 'plan_user_limit',
  'accepting after the company became full is refused');
select pg_temp.root();
select is((select count(*)::int from public.organisation_members where organisation_id = pg_temp.org('c')), 2, 'no member was added');
select is((select accepted_at from public.organisation_invitations where token_hash = private.invitation_token_hash('known-token-c-two-0000000000000000000000')), null,
  'the invitation stays unaccepted');

-- Removing a member frees the seat; their records stay.
insert into public.electrical_installations (id, organisation_id, site_id, name, installation_type, created_by)
values ('1c000000-0000-4000-8000-0000000000c1', pg_temp.org('c'), '5c000000-0000-4000-8000-0000000000c1', 'C kilp', 'switchboard', pg_temp.uid('c_three'));
insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
values (pg_temp.org('c'), '5c000000-0000-4000-8000-0000000000c1', '1c000000-0000-4000-8000-0000000000c1', 'inspection', 'C kolme kirje', pg_temp.uid('c_three'));
update public.organisation_invitations set revoked_at = now() where organisation_id = pg_temp.org('c') and accepted_at is null and revoked_at is null;
delete from public.organisation_members where organisation_id = pg_temp.org('c') and user_id = pg_temp.uid('c_three');
select is(private.seats_used(pg_temp.org('c')), 1, 'a removed member frees the seat at once');
select is((select count(*)::int from public.log_entries where created_by = pg_temp.uid('c_three')), 1, 'their log entry stays');
select is((select created_by from public.electrical_installations where id = '1c000000-0000-4000-8000-0000000000c1'), pg_temp.uid('c_three'),
  'and the authorship of what they created');
select throws_ok($$ delete from public.organisation_members where organisation_id = pg_temp.org('c') and user_id = pg_temp.uid('c_owner') $$,
  'P0001', 'last_owner', 'the last owner can still never be removed');
select lives_ok($$ select pg_temp.invite(pg_temp.org('c'), 'c.three@example.ee') $$, 'the freed seat can be used');

-- Pro and Business allow exactly 5 and 15 (members of every role and invitations count).
select pg_temp.sub(pg_temp.org('a'), 'pro');
select is(private.seats_used(pg_temp.org('a')), 5, 'company A: owner, admin, operator, viewer and multi = 5');
select throws_ok($$ select pg_temp.invite(pg_temp.org('a'), 'kuues@example.ee') $$, 'P0001', 'plan_user_limit', 'Pro: a sixth user is refused');
update public.organisation_members set role = 'viewer' where organisation_id = pg_temp.org('a') and user_id = pg_temp.uid('a_operator');
select is(private.seats_used(pg_temp.org('a')), 5, 'changing a role does not change the count');
select pg_temp.sub(pg_temp.org('a'), 'business');
create function pg_temp.invite_many(p_n int) returns int language plpgsql as $$
declare i int;
begin
  for i in 1..p_n loop perform pg_temp.invite(pg_temp.org('a'), 'lisa' || i || '@example.ee'); end loop;
  return private.seats_used(pg_temp.org('a'));
end $$;
select is(pg_temp.invite_many(10), 15, 'Business: 15 users');
select throws_ok($$ select pg_temp.invite(pg_temp.org('a'), 'liiga@example.ee') $$, 'P0001', 'plan_user_limit', 'Business: the 16th is refused');
update public.organisation_invitations set revoked_at = now() where organisation_id = pg_temp.org('a') and email like 'lisa%';

-- ===========================================================================
-- Active installations
-- ===========================================================================

select is(private.installations_active(pg_temp.org('a')), 2, 'company A has 2 active installations');
create function pg_temp.fill(p_org uuid, p_n int) returns int language plpgsql as $$
declare i int;
begin
  for i in 1..p_n loop perform pg_temp.install(p_org, 'Täide ' || i); end loop;
  return private.installations_active(p_org);
end $$;
select pg_temp.sub(pg_temp.org('a'), 'start');
select is(pg_temp.fill(pg_temp.org('a'), 3), 5, 'Start: up to 5 active installations');
select pg_temp.login('a_admin');
select throws_ok($$ select pg_temp.install(pg_temp.org('a'), 'Kuues') $$, 'P0001', 'plan_installation_limit', 'Start: the 6th is refused (admin, through RLS)');
select pg_temp.root();
select is(private.installations_active(pg_temp.org('a')), 5, 'nothing was added');
select lives_ok($$ update public.electrical_installations set name = name || ' (muudetud)' where id = pg_temp.inst('a1') $$,
  'existing installations keep working at the limit');

update public.electrical_installations set archived_at = now() where id = pg_temp.inst('a2');
select is(private.installations_active(pg_temp.org('a')), 4, 'archived installations do not count');
select lives_ok($$ select pg_temp.install(pg_temp.org('a'), 'Vaba koht') $$, 'archiving frees capacity');
select throws_ok($$ update public.electrical_installations set archived_at = null where id = pg_temp.inst('a2') $$, 'P0001', 'plan_installation_limit',
  'bringing an archived installation back checks the limit');
select is((select archived_at is not null from public.electrical_installations where id = pg_temp.inst('a2')), true, 'it stays archived');

select pg_temp.sub(pg_temp.org('a'), 'team');
select is(pg_temp.fill(pg_temp.org('a'), 5), 10, 'Team: 10');
select throws_ok($$ select pg_temp.install(pg_temp.org('a'), 'X') $$, 'P0001', 'plan_installation_limit', 'Team: the 11th is refused');
select pg_temp.sub(pg_temp.org('a'), 'pro');
select is(pg_temp.fill(pg_temp.org('a'), 15), 25, 'Pro: 25');
select throws_ok($$ select pg_temp.install(pg_temp.org('a'), 'X') $$, 'P0001', 'plan_installation_limit', 'Pro: the 26th is refused');
select pg_temp.sub(pg_temp.org('a'), 'business');
select is(pg_temp.fill(pg_temp.org('a'), 75), 100, 'Business: 100');
select throws_ok($$ select pg_temp.install(pg_temp.org('a'), 'X') $$, 'P0001', 'plan_installation_limit', 'Business: the 101st is refused');
update public.electrical_installations set archived_at = now() where organisation_id = pg_temp.org('a') and name = 'Täide 1' and archived_at is null;
select lives_ok($$ update public.electrical_installations set archived_at = null where id = pg_temp.inst('a2') $$, 'reactivation fits after another is archived');

-- Another tenant learns nothing from the limit.
select pg_temp.login('b_admin');
select throws_ok($$ select pg_temp.install(pg_temp.org('a'), 'Võõras') $$, '42501', 'forbidden', 'a non-member gets forbidden, not a plan message');
select pg_temp.root();

-- Custom limits are the enforced limits.
select pg_temp.sub(pg_temp.org('c'), 'custom', null, null, 'Üks kilp', 0, 3, 1);
select is(private.installations_active(pg_temp.org('c')), 1, 'company C has 1 active installation');
select throws_ok($$ select pg_temp.install(pg_temp.org('c'), 'Teine') $$, 'P0001', 'plan_installation_limit', 'Custom: installation limit 1 enforced');

-- ===========================================================================
-- Paid periods
-- ===========================================================================

create function pg_temp.today() returns date language sql as $$ select private.business_date() $$;

select is((pg_temp.sub(pg_temp.org('c'), 'pro', 1)) ->> 'mode', 'activate', '1 month from a trial: activation');
select is(pg_temp.status(pg_temp.org('c')), 'active', 'active at once');
select is(pg_temp.paid_until(pg_temp.org('c')), private.add_months(pg_temp.today(), 1), 'paid until today + 1 month');
select is((pg_temp.sub(pg_temp.org('c'), 'pro', 3)) ->> 'mode', 'extend', 'adding months to an active subscription extends it');
select is(pg_temp.paid_until(pg_temp.org('c')), private.add_months(private.add_months(pg_temp.today(), 1), 3), '… from the current paid-until day');
select pg_temp.sub(pg_temp.org('c'), 'pro', 6);
select pg_temp.sub(pg_temp.org('c'), 'pro', 12);
select pg_temp.sub(pg_temp.org('c'), 'pro', 24);
select is(pg_temp.paid_until(pg_temp.org('c')),
  private.add_months(private.add_months(private.add_months(private.add_months(private.add_months(pg_temp.today(), 1), 3), 6), 12), 24),
  '6, 12 and 24 months extend in turn');
select throws_ok($$ select pg_temp.sub(pg_temp.org('c'), 'pro', 2) $$, '22023', null, 'only 1, 3, 6, 12 or 24 months');

-- The brief's example: paid until 31.12.2026, + 6 months = 30.06.2027.
select pg_temp.sub(pg_temp.org('b'), 'pro', null, '2026-12-31');
select is(pg_temp.paid_until(pg_temp.org('b')), '2026-12-31'::date, 'custom paid-until date');
select is(pg_temp.status(pg_temp.org('b')), 'active', 'activated with an exact date');
select is((pg_temp.sub(pg_temp.org('b'), 'pro', 6)) ->> 'paid_until', '2027-06-30', '31.12.2026 + 6 months = 30.06.2027');
select is(private.add_months('2026-10-06', 6), '2027-04-06'::date, '06.10.2026 + 6 months = 06.04.2027');
select is(private.add_months('2026-11-30', 1), '2026-12-31'::date, 'a month-end stays a month-end');
select is(private.add_months('2027-01-31', 1), '2027-02-28'::date, '31.01 + 1 month = 28.02');
select is(private.add_months('2028-01-31', 1), '2028-02-29'::date, 'leap year');
select is(private.until_from_day('2027-06-30'), '2027-06-30 21:00:00+00'::timestamptz, 'valid until the end of the day in Tallinn (summer)');
select is(private.until_from_day('2027-01-31'), '2027-01-31 22:00:00+00'::timestamptz, 'and in winter');
select is((pg_temp.sub(pg_temp.org('b'), 'pro', null, '2027-01-15')) ->> 'mode', 'set_until', 'paid-until can be changed by hand');
select is(pg_temp.paid_until(pg_temp.org('b')), '2027-01-15'::date, 'to the exact day');
select throws_ok($$ select pg_temp.sub(pg_temp.org('b'), 'pro', 6, '2027-01-15') $$, '22023', null, 'months and a date at once are refused');
select throws_ok($$ select pg_temp.sub(pg_temp.org('b'), 'pro', null, current_date - 2) $$, '22023', null, 'a paid-until in the past is refused');

-- Expiry → read-only; renewal of an expired subscription starts from the activation date.
update private.organisation_access
   set trial_started_at = now() - interval '60 days', trial_ends_at = now() - interval '46 days',
       full_access_from = now() - interval '40 days', full_access_until = now() - interval '1 day'
 where organisation_id = pg_temp.org('c');
select is(pg_temp.status(pg_temp.org('c')), 'expired', 'paid period over: expired');
select pg_temp.login('c_owner');
select throws_ok($$ select pg_temp.install(pg_temp.org('c'), 'Aegunud') $$, '42501', null, 'expired: read-only (no new installations)');
select is((select count(*)::int from public.electrical_installations where organisation_id = pg_temp.org('c')), 1, 'expired: data still readable');
select pg_temp.root();
select is((pg_temp.sub(pg_temp.org('c'), 'team', 3)) ->> 'mode', 'activate', 'renewing an expired subscription is a new activation');
select is(pg_temp.paid_until(pg_temp.org('c')), private.add_months(pg_temp.today(), 3), '… counted from today, not from the old end');
select is(pg_temp.status(pg_temp.org('c')), 'active', 'write access is back');
select pg_temp.login('c_owner');
select lives_ok($$ select pg_temp.install(pg_temp.org('c'), 'Taastatud') $$, 'and the owner can add installations again');
select pg_temp.root();

-- A plan change without a period leaves the dates alone.
select is((pg_temp.sub(pg_temp.org('b'), 'pro', null, null)) ->> 'mode', 'plan_only', 'plan without a period: plan only');

-- ===========================================================================
-- Who can see and change what
-- ===========================================================================

select pg_temp.login('a_owner');
select throws_ok($$ select public.admin_set_subscription(pg_temp.org('a'), 'business', null, null, null, null, 12, null, null) $$,
  'P0002', 'not_found', 'an owner cannot change the plan or period');
select throws_ok($$ select public.admin_subscription_preview(pg_temp.org('a'), 'business', null, null, null, null, 12, null, null) $$,
  'P0002', 'not_found', 'an owner cannot preview');
select throws_ok($$ select public.admin_subscriptions(null, null, 50, 0) $$, 'P0002', 'not_found', 'an owner cannot list subscriptions');
select throws_ok($$ select public.admin_subscription(pg_temp.org('a')) $$, 'P0002', 'not_found', 'an owner cannot read the admin view');
select throws_ok($$ select * from private.organisation_access $$, '42501', null, 'an owner cannot read the access table (notes, price)');
select throws_ok($$ select * from private.subscription_plans $$, '42501', null, 'nor the plan table directly');
select throws_ok($$ select private.seats_used(pg_temp.org('a')) $$, '42501', null, 'nor the private helpers');
select ok(public.organisation_plan(pg_temp.org('a')) ?& array['plan', 'user_limit', 'installation_limit', 'seats_used', 'installations_active', 'paid_until'],
  'an owner sees plan, limits, usage and expiry');
select ok(not (public.organisation_plan(pg_temp.org('a')) ?| array['admin_notes', 'invoice_reference', 'monthly_price', 'activated_by']),
  'but no notes, invoice reference, price or admin');
select pg_temp.login('a_viewer');
select is(public.organisation_plan(pg_temp.org('a')) ->> 'plan', 'business', 'every member can see the plan');
select pg_temp.login('b_owner');
select throws_ok($$ select public.organisation_plan(pg_temp.org('a')) $$, 'P0002', 'not_found', 'other companies cannot see it');
select pg_temp.logout();
select throws_ok($$ select public.organisation_plan(pg_temp.org('a')) $$, '42501', null, 'anon cannot call it');
select pg_temp.root();

-- Platform admin: list, detail with history.
select pg_temp.login('platform');
select ok((public.admin_subscriptions('Kohtade', null, 50, 0) -> 'rows' -> 0 ->> 'name') = 'Kohtade OÜ', 'search by name');
select is((public.admin_subscriptions(null, 'custom', 50, 0) ->> 'total')::int, 0, 'filter by plan');
select is((public.admin_subscriptions('Kohtade', null, 50, 0) -> 'rows' -> 0 ->> 'seats_used')::int, 2, 'usage in the list');
select ok(jsonb_array_length(public.admin_subscription(pg_temp.org('c')) -> 'history') >= 5, 'subscription history in the detail');
select is(public.admin_subscription(pg_temp.org('c')) -> 'history' -> 0 -> 'before' ->> 'plan', 'pro', 'history: previous plan');
select is(public.admin_subscription(pg_temp.org('c')) -> 'history' -> 0 -> 'after' ->> 'plan', 'team', 'history: new plan');
select ok((public.admin_subscription(pg_temp.org('c')) -> 'history' -> 0 -> 'after' ->> 'paid_until') is not null, 'history: new paid-until');
select is(public.admin_subscription(pg_temp.org('c')) -> 'history' -> 0 ->> 'by', 'platvorm@example.ee', 'history: changed by');
select is(jsonb_array_length(public.admin_subscription(pg_temp.org('c')) -> 'plans'), 4, 'the four fixed plans for the form');
select pg_temp.root();

select * from finish();
rollback;
