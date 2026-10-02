-- Phase 2: organisations, memberships, profiles, history — role matrix and tenant isolation.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql

select plan(48);

-- ===========================================================================
-- organisations: visibility
-- ===========================================================================

select pg_temp.login('a_viewer');
select results_eq(
  'select id from public.organisations',
  $$ select pg_temp.org('a') $$,
  'a member sees only their own organisation'
);

select pg_temp.login('multi');
select results_eq(
  'select id from public.organisations order by name',
  $$ values (pg_temp.org('a')), (pg_temp.org('b')) $$,
  'a user in two organisations sees both'
);

select pg_temp.login('outsider');
select is_empty('select 1 from public.organisations', 'an outsider sees no organisations');

select pg_temp.login('a_owner');
select is_empty(
  $$ select 1 from public.organisations where id = pg_temp.org('b') $$,
  'A cannot read organisation B even with its id'
);
select is_empty(
  $$ select 1 from public.organisations where slug = 'org-b-test' $$,
  'A cannot read organisation B by slug'
);

-- ===========================================================================
-- organisations: changes
-- ===========================================================================

select pg_temp.login('a_owner');
with u as (
  update public.organisations set name = 'Hijacked' where id = pg_temp.org('b') returning 1
)
select is(count(*)::int, 0, 'A owner cannot update organisation B') from u;

select pg_temp.login('a_admin');
with u as (
  update public.organisations set name = 'Admin rename' where id = pg_temp.org('a') returning 1
)
select is(count(*)::int, 1, 'an admin can change organisation settings') from u;

select pg_temp.login('a_owner');
with u as (
  update public.organisations set name = 'Organisatsioon A2', registry_code = '12345678'
   where id = pg_temp.org('a') returning 1
)
select is(count(*)::int, 1, 'an owner can change name and registry code') from u;

select throws_ok(
  $$ update public.organisations set slug = 'new-slug' where id = pg_temp.org('a') $$,
  '42501', null,
  'the slug cannot be changed (stable URLs)'
);
select throws_ok(
  $$ insert into public.organisations (name, slug) values ('X', 'x-org-test') $$,
  '42501', null,
  'organisations cannot be inserted directly'
);
select throws_ok(
  $$ delete from public.organisations where id = pg_temp.org('a') $$,
  '42501', null,
  'organisations cannot be deleted through the API'
);

reset role;
select is(
  (select name from public.organisations where id = pg_temp.org('b')),
  'Organisatsioon B',
  'organisation B is unchanged'
);

-- ===========================================================================
-- organisation_members
-- ===========================================================================

select pg_temp.login('a_viewer');
select is(
  (select count(*)::int from public.organisation_members),
  5,
  'a member sees exactly the memberships of their own organisation'
);
select is_empty(
  $$ select 1 from public.organisation_members where organisation_id = pg_temp.org('b') $$,
  'A cannot see organisation B memberships'
);

-- Admin manages non-owner members.
select pg_temp.login('a_admin');
with u as (
  update public.organisation_members set role = 'viewer'
   where organisation_id = pg_temp.org('a') and user_id = pg_temp.uid('a_operator') returning 1
)
select is(count(*)::int, 1, 'an admin can change an operator''s role') from u;

select throws_ok(
  $$ update public.organisation_members set role = 'owner'
      where organisation_id = pg_temp.org('a') and user_id = pg_temp.uid('a_operator') $$,
  '42501', null,
  'an admin cannot promote anyone to owner'
);
select throws_ok(
  $$ update public.organisation_members set role = 'owner'
      where organisation_id = pg_temp.org('a') and user_id = pg_temp.uid('a_admin') $$,
  '42501', null,
  'an admin cannot promote themselves to owner'
);

with u as (
  update public.organisation_members set role = 'viewer'
   where organisation_id = pg_temp.org('a') and user_id = pg_temp.uid('a_owner') returning 1
)
select is(count(*)::int, 0, 'an admin cannot demote an owner') from u;

with d as (
  delete from public.organisation_members
   where organisation_id = pg_temp.org('a') and user_id = pg_temp.uid('a_owner') returning 1
)
select is(count(*)::int, 0, 'an admin cannot remove an owner') from d;

with u as (
  update public.organisation_members set role = 'viewer'
   where organisation_id = pg_temp.org('b') returning 1
)
select is(count(*)::int, 0, 'A admin cannot change roles in organisation B') from u;

with d as (
  delete from public.organisation_members where organisation_id = pg_temp.org('b') returning 1
)
select is(count(*)::int, 0, 'A admin cannot remove members of organisation B') from d;

select throws_ok(
  $$ update public.organisation_members set user_id = pg_temp.uid('outsider')
      where user_id = pg_temp.uid('a_viewer') $$,
  '42501', null,
  'membership user cannot be rewritten'
);
select throws_ok(
  $$ update public.organisation_members set organisation_id = pg_temp.org('b')
      where user_id = pg_temp.uid('a_viewer') $$,
  '42501', null,
  'membership cannot be moved to another organisation'
);

select pg_temp.login('a_operator');
with u as (
  update public.organisation_members set role = 'admin'
   where user_id = pg_temp.uid('a_viewer') returning 1
)
select is(count(*)::int, 0, 'an operator cannot change roles') from u;

select throws_ok(
  $$ insert into public.organisation_members (organisation_id, user_id, role)
     values (pg_temp.org('a'), pg_temp.uid('outsider'), 'viewer') $$,
  '42501', null,
  'memberships cannot be inserted directly (invitations only)'
);

select pg_temp.login('outsider');
select throws_ok(
  $$ insert into public.organisation_members (organisation_id, user_id, role)
     values (pg_temp.org('b'), pg_temp.uid('outsider'), 'owner') $$,
  '42501', null,
  'an outsider cannot add themselves to an organisation'
);

-- Leaving and the last owner.
select pg_temp.login('a_viewer');
with d as (
  delete from public.organisation_members
   where organisation_id = pg_temp.org('a') and user_id = pg_temp.uid('a_viewer') returning 1
)
select is(count(*)::int, 1, 'a member can leave an organisation') from d;

select pg_temp.login('a_owner');
select throws_ok(
  $$ delete from public.organisation_members
      where organisation_id = pg_temp.org('a') and user_id = pg_temp.uid('a_owner') $$,
  'P0001', 'last_owner',
  'the last owner cannot leave'
);
select throws_ok(
  $$ update public.organisation_members set role = 'admin'
      where organisation_id = pg_temp.org('a') and user_id = pg_temp.uid('a_owner') $$,
  'P0001', 'last_owner',
  'the last owner cannot demote themselves'
);

select lives_ok(
  $$ update public.organisation_members set role = 'owner'
      where organisation_id = pg_temp.org('a') and user_id = pg_temp.uid('a_admin') $$,
  'an owner can promote an admin to owner'
);
select lives_ok(
  $$ update public.organisation_members set role = 'admin'
      where organisation_id = pg_temp.org('a') and user_id = pg_temp.uid('a_owner') $$,
  'with another owner present, an owner can step down'
);

-- ===========================================================================
-- profiles
-- ===========================================================================

select pg_temp.login('a_operator');
select ok(
  exists (select 1 from public.profiles where id = pg_temp.uid('a_owner'))
  and exists (select 1 from public.profiles where id = pg_temp.uid('multi')),
  'members see profiles of people in their organisation'
);
select is_empty(
  $$ select 1 from public.profiles where id in (pg_temp.uid('b_owner'), pg_temp.uid('outsider')) $$,
  'members cannot see profiles of people outside their organisations'
);

select pg_temp.login('outsider');
select results_eq(
  'select id from public.profiles',
  $$ select pg_temp.uid('outsider') $$,
  'an outsider sees only their own profile'
);

-- ===========================================================================
-- Joins cannot reach another tenant
-- ===========================================================================

select pg_temp.login('a_owner');
select is_empty(
  $$ select o.name, p.email
       from public.organisation_members m
       join public.organisations o on o.id = m.organisation_id
       join public.profiles p on p.id = m.user_id
      where m.organisation_id = pg_temp.org('b') or o.id = pg_temp.org('b') $$,
  'joining members, organisations and profiles reveals nothing about B'
);
select is(
  (select count(*)::int from public.profiles p
     left join public.organisation_members m on m.user_id = p.id
    where p.id = pg_temp.uid('b_owner')),
  0,
  'a left join from profiles cannot surface B users'
);

-- ===========================================================================
-- create_organisation
-- ===========================================================================

select pg_temp.login('outsider');
select matches(
  public.create_organisation('Õunapuu Äri OÜ', '87654321'),
  '^ounapuu-ari-ou-[a-z2-9]{6}$',
  'create_organisation returns a slug from the name with a random suffix'
);
select is(
  (select m.role::text from public.organisation_members m
     join public.organisations o on o.id = m.organisation_id
    where o.name = 'Õunapuu Äri OÜ' and m.user_id = pg_temp.uid('outsider')),
  'owner',
  'the creator becomes the owner'
);
select throws_ok(
  $$ select public.create_organisation('   ') $$,
  '23514', null,
  'an empty organisation name is rejected'
);
select isnt(
  public.create_organisation('Sama Nimi'),
  public.create_organisation('Sama Nimi'),
  'two organisations with the same name get different slugs'
);

select pg_temp.logout();
select throws_ok(
  $$ select public.create_organisation('Anon Org') $$,
  '42501', null,
  'anon cannot create organisations'
);

-- ===========================================================================
-- activity_history
-- ===========================================================================

select pg_temp.login('a_admin');
select ok(
  exists (select 1 from public.activity_history
           where organisation_id = pg_temp.org('a')
             and table_name = 'organisation_members' and action = 'update'
             and actor_id = pg_temp.uid('a_admin')),
  'role changes are recorded with the acting user'
);
select is_empty(
  $$ select 1 from public.activity_history where organisation_id <> pg_temp.org('a') $$,
  'admins see only their own organisation''s history'
);
select throws_ok(
  $$ insert into public.activity_history (organisation_id, table_name, record_id, action)
     values (pg_temp.org('a'), 'x', gen_random_uuid(), 'insert') $$,
  '42501', null,
  'history cannot be written through the API'
);
select throws_ok(
  $$ delete from public.activity_history $$,
  '42501', null,
  'history cannot be deleted through the API'
);

select pg_temp.login('a_operator');
select is_empty('select 1 from public.activity_history', 'operators cannot read history');

-- ===========================================================================
-- private helpers
-- ===========================================================================

select pg_temp.login('a_owner');
select throws_ok(
  $$ select private.has_org_role(pg_temp.org('b'), 'viewer') $$,
  '42501', null,
  'internal helper has_org_role is not callable by users'
);

select pg_temp.login('multi');
select results_eq(
  $$ select private.org_ids('operator') $$,
  $$ select pg_temp.org('a') $$,
  'org_ids respects the minimum role per organisation'
);

select * from finish();
rollback;
