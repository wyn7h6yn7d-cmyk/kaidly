-- Company settings: owners and admins edit the company details; operators and viewers read
-- them; the slug never changes (name = display data, slug = stable route identifier).

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql

select plan(11);

select pg_temp.login('a_admin');
with u as (
  update public.organisations
     set name = 'Uus Nimi OÜ', registry_code = '87654321', contact_email = 'info@firma.ee',
         contact_phone = '+372 5555 5555', address = 'Tööstuse 1, Tallinn', notes = 'Võtmed valvelauas'
   where id = pg_temp.org('a') returning slug
)
select is(slug, 'org-a-test', 'an admin edits every company detail; the slug stays the same') from u;

select pg_temp.login('a_owner');
with u as (update public.organisations set contact_phone = null where id = pg_temp.org('a') returning 1)
select is(count(*)::int, 1, 'an owner edits company details') from u;

select pg_temp.login('a_operator');
with u as (update public.organisations set contact_email = 'x@y.ee' where id = pg_temp.org('a') returning 1)
select is(count(*)::int, 0, 'an operator cannot edit company details') from u;
select is(
  (select contact_email from public.organisations where id = pg_temp.org('a')),
  'info@firma.ee', 'an operator reads the company details'
);

select pg_temp.login('a_viewer');
with u as (update public.organisations set notes = 'x' where id = pg_temp.org('a') returning 1)
select is(count(*)::int, 0, 'a viewer cannot edit company details') from u;
select is(
  (select address from public.organisations where id = pg_temp.org('a')),
  'Tööstuse 1, Tallinn', 'a viewer reads the company details'
);

select pg_temp.login('a_admin');
with u as (update public.organisations set notes = 'x' where id = pg_temp.org('b') returning 1)
select is(count(*)::int, 0, 'an admin of A cannot edit company B') from u;
select throws_ok(
  $$ update public.organisations set slug = 'muu' where id = pg_temp.org('a') $$,
  '42501', null, 'an admin cannot change the slug'
);
select throws_ok(
  $$ update public.organisations set deactivated_at = now() where id = pg_temp.org('a') $$,
  '42501', null, 'lifecycle columns are not writable (owner-only RPCs)'
);
select throws_ok(
  $$ update public.organisations set contact_email = 'pole-e-post' where id = pg_temp.org('a') $$,
  '23514', null, 'the contact email is validated in the database'
);

-- A deactivated company is read-only for its admins too.
select pg_temp.logout();
reset role;
update public.organisations set deactivated_at = now() where id = pg_temp.org('a');
select pg_temp.login('a_admin');
with u as (update public.organisations set notes = 'y' where id = pg_temp.org('a') returning 1)
select is(count(*)::int, 0, 'an admin cannot edit a deactivated company') from u;

select * from finish();
rollback;
