-- Phase 5: operating plan — role matrix, tenant isolation, completion → operating log,
-- anchored recurrence, one-time activities, duplicate protection, archived activities.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

-- Fixture activities (as postgres). Dates far in the future are deterministic: they are
-- always "completed early".
insert into public.scheduled_activities
  (id, organisation_id, site_id, electrical_installation_id, title, frequency_type, interval_value, interval_unit, next_due_on, created_by)
values
  ('ac000000-0000-4000-8000-0000000000a1', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'),
   'Kuu ülevaatus', 'recurring', 1, 'month', '2030-01-31', pg_temp.uid('a_admin')),
  ('ac000000-0000-4000-8000-0000000000a2', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'),
   'Ühekordne termograafia', 'once', null, null, '2030-06-01', pg_temp.uid('a_admin')),
  ('ac000000-0000-4000-8000-0000000000a3', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'),
   'Hilinenud kontroll', 'recurring', 1, 'month', '2020-01-15', pg_temp.uid('a_admin')),
  ('ac000000-0000-4000-8000-0000000000a4', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'),
   'Liigaasta', 'recurring', 1, 'year', '2028-02-29', pg_temp.uid('a_admin')),
  ('ac000000-0000-4000-8000-0000000000b1', pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'),
   'B tegevus', 'recurring', 2, 'week', '2030-01-01', pg_temp.uid('b_admin'));

create function pg_temp.act(p text) returns uuid language sql immutable as $$
  select ('ac000000-0000-4000-8000-0000000000' || p)::uuid $$;
grant execute on function pg_temp.act(text) to authenticated, anon;

create function pg_temp.complete(p_act uuid, p_due date) returns uuid language sql as $$
  select public.complete_scheduled_activity(p_act, p_due, 'inspection', now(), null, null, null) $$;
grant execute on function pg_temp.complete(uuid, date) to authenticated, anon;

select plan(46);

-- ===========================================================================
-- Reading
-- ===========================================================================

select pg_temp.login('a_viewer');
select is((select count(*)::int from public.scheduled_activities), 4, 'a viewer reads their organisation''s plan');
select is_empty(
  $$ select 1 from public.scheduled_activities where id = pg_temp.act('b1') or organisation_id = pg_temp.org('b') $$,
  'tenant A cannot read tenant B''s activities'
);
select pg_temp.login('outsider');
select is_empty('select 1 from public.scheduled_activities', 'an outsider reads no activities');
select pg_temp.logout();
select throws_ok('select 1 from public.scheduled_activities', '42501', null, 'anon cannot read activities');

-- ===========================================================================
-- Creating and managing: admins only
-- ===========================================================================

select pg_temp.login('a_admin');
select lives_ok(
  $$ insert into public.scheduled_activities
       (organisation_id, site_id, electrical_installation_id, title, frequency_type, interval_value, interval_unit, next_due_on, priority)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Mõõtmine', 'recurring', 3, 'year', '2031-05-01', 'high') $$,
  'an admin can create an activity'
);
select results_eq(
  $$ select anchor_on, created_by from public.scheduled_activities where title = 'Mõõtmine' $$,
  $$ values ('2031-05-01'::date, pg_temp.uid('a_admin')) $$,
  'the anchor is the first due date; the creator comes from the session'
);
select throws_ok(
  $$ insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('b1'), 'B installation', 'once', '2031-01-01') $$,
  '23503', null,
  'own organisation + B''s installation is rejected'
);
select throws_ok(
  $$ insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on)
     values (pg_temp.org('a'), pg_temp.site('a2'), pg_temp.inst('a1'), 'Wrong site', 'once', '2031-01-01') $$,
  '23503', null,
  'an installation filed under the wrong site is rejected'
);
select throws_ok(
  $$ insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on)
     values (pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'Into B', 'once', '2031-01-01') $$,
  '42501', null,
  'tenant A cannot create activities in tenant B'
);
select throws_ok(
  $$ insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, interval_value, next_due_on)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Half recurring', 'recurring', 1, '2031-01-01') $$,
  '23514', null,
  'a recurring activity needs both interval value and unit'
);
select throws_ok(
  $$ insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, interval_value, interval_unit, next_due_on)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Once with interval', 'once', 1, 'month', '2031-01-01') $$,
  '23514', null,
  'a one-time activity has no interval'
);
select throws_ok(
  $$ insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on, anchor_on)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Anchor', 'once', '2031-01-01', '2020-01-01') $$,
  '42501', null,
  'the anchor is not client-writable'
);
with u as (
  update public.scheduled_activities set next_due_on = '2030-03-15', interval_value = 2
   where id = pg_temp.act('a1') returning anchor_on
)
select is((select anchor_on from u), '2030-03-15'::date, 'changing the schedule re-anchors it');
reset role;
update public.scheduled_activities set next_due_on = '2030-01-31', interval_value = 1 where id = pg_temp.act('a1');
select pg_temp.login('a_admin');
with u as (
  update public.scheduled_activities set title = 'Hijacked' where id = pg_temp.act('b1') returning 1
)
select is(count(*)::int, 0, 'tenant A cannot update tenant B''s activity') from u;
select throws_ok(
  $$ delete from public.scheduled_activities where id = pg_temp.act('a1') $$,
  '42501', null,
  'activities cannot be deleted (archive instead)'
);

select pg_temp.login('a_operator');
select throws_ok(
  $$ insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Operator', 'once', '2031-01-01') $$,
  '42501', null,
  'an operator cannot create activities'
);
with u as (
  update public.scheduled_activities
     set title = 'Operator edit', next_due_on = '2040-01-01', interval_value = 12, priority = 'low'
   where id = pg_temp.act('a1') returning 1
)
select is(count(*)::int, 0, 'an operator cannot change scheduling master data') from u;
with u as (
  update public.scheduled_activities set archived_at = now() where id = pg_temp.act('a1') returning 1
)
select is(count(*)::int, 0, 'an operator cannot archive activities') from u;
select pg_temp.login('a_viewer');
select throws_ok(
  $$ insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Viewer', 'once', '2031-01-01') $$,
  '42501', null,
  'a viewer cannot create activities'
);

-- ===========================================================================
-- Completion
-- ===========================================================================

select pg_temp.login('a_viewer');
select throws_ok(
  $$ select pg_temp.complete(pg_temp.act('a1'), '2030-01-31') $$,
  'P0002', 'not_found',
  'a viewer cannot complete an activity'
);
select pg_temp.login('b_operator');
select throws_ok(
  $$ select pg_temp.complete(pg_temp.act('a1'), '2030-01-31') $$,
  'P0002', 'not_found',
  'tenant B cannot complete tenant A''s activity'
);
select throws_ok(
  $$ select pg_temp.complete(gen_random_uuid(), '2030-01-31') $$,
  'P0002', 'not_found',
  'an unknown activity gives the same error'
);

select pg_temp.login('a_operator');
select lives_ok(
  $$ select set_config('test.entry', pg_temp.complete(pg_temp.act('a1'), '2030-01-31')::text, true) $$,
  'an operator can complete an activity'
);
select results_eq(
  $$ select organisation_id, site_id, electrical_installation_id, scheduled_activity_id, scheduled_due_on, created_by, description
       from public.log_entries where id = current_setting('test.entry')::uuid $$,
  $$ values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), pg_temp.act('a1'),
             '2030-01-31'::date, pg_temp.uid('a_operator'), 'Kuu ülevaatus'::text) $$,
  'completion writes an operating-log entry for the right organisation, site, installation and due date'
);
select is(
  (select next_due_on from public.scheduled_activities where id = pg_temp.act('a1')),
  '2030-02-28'::date,
  'monthly: 31 Jan → 28 Feb'
);
select lives_ok($$ select pg_temp.complete(pg_temp.act('a1'), '2030-02-28') $$, 'second completion');
select is(
  (select next_due_on from public.scheduled_activities where id = pg_temp.act('a1')),
  '2030-03-31'::date,
  'anchored, no drift: 28 Feb → 31 Mar (not 28 Mar)'
);
select throws_ok(
  $$ select pg_temp.complete(pg_temp.act('a1'), '2030-02-28') $$,
  'P0001', 'activity_already_completed',
  'completing an already completed due date is rejected (stale form, double tap)'
);
select is(
  (select count(*)::int from public.log_entries where scheduled_activity_id = pg_temp.act('a1')),
  2,
  'exactly one log entry per completed due date'
);
select is(
  (select anchor_on from public.scheduled_activities where id = pg_temp.act('a1')),
  '2030-01-31'::date,
  'completions do not move the anchor'
);

-- Late completion: missed occurrences are skipped, the schedule stays anchored.
select lives_ok($$ select pg_temp.complete(pg_temp.act('a3'), '2020-01-15') $$, 'completing a long-overdue activity');
select is(
  (select next_due_on from public.scheduled_activities where id = pg_temp.act('a3')),
  (select min(g)::date
     from generate_series('2020-01-15'::date, current_date + interval '3 months', interval '1 month') g
    where g::date > (now() at time zone 'Europe/Tallinn')::date),
  'late completion: next due is the first anchored date after today'
);
select is(
  (select extract(day from next_due_on)::int from public.scheduled_activities where id = pg_temp.act('a3')),
  15,
  'late completion keeps the anchored day of month'
);

-- Leap year anchor.
select pg_temp.complete(pg_temp.act('a4'), '2028-02-29');
select is(
  (select next_due_on from public.scheduled_activities where id = pg_temp.act('a4')),
  '2029-02-28'::date,
  'yearly from 29 Feb → 28 Feb in a common year'
);
select pg_temp.complete(pg_temp.act('a4'), '2029-02-28');
select pg_temp.complete(pg_temp.act('a4'), '2030-02-28');
select pg_temp.complete(pg_temp.act('a4'), '2031-02-28');
select is(
  (select next_due_on from public.scheduled_activities where id = pg_temp.act('a4')),
  '2032-02-29'::date,
  'yearly anchored: back to 29 Feb in the next leap year'
);

-- One-time
select lives_ok($$ select pg_temp.complete(pg_temp.act('a2'), '2030-06-01') $$, 'completing a one-time activity');
select is(
  (select next_due_on from public.scheduled_activities where id = pg_temp.act('a2')),
  null,
  'a completed one-time activity has no next due date (derived state: done)'
);
select throws_ok(
  $$ select pg_temp.complete(pg_temp.act('a2'), '2030-06-01') $$,
  'P0001', 'activity_already_completed',
  'a one-time activity cannot be completed twice'
);

-- Completion records can't be forged or changed.
select throws_ok(
  $$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, scheduled_activity_id, scheduled_due_on)
     values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'Fake', pg_temp.act('a1'), '2030-03-31') $$,
  '42501', null,
  'a completion cannot be written directly into the log'
);
select throws_ok(
  format('update public.log_entries set scheduled_due_on = %L where id = %L', '2030-12-31', current_setting('test.entry')),
  '42501', null,
  'completion history is immutable'
);
select lives_ok(
  format($$ insert into public.log_entries
       (organisation_id, site_id, electrical_installation_id, entry_type, description, correction_of_id, correction_reason)
     values (%L, %L, %L, 'inspection', 'Kuu ülevaatus, kõik korras', %L, 'Täpsustus') $$,
     pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), current_setting('test.entry')),
  'a completion entry can be corrected like any entry'
);
select is(
  (select scheduled_activity_id from public.log_entry_current where id = current_setting('test.entry')::uuid),
  pg_temp.act('a1'),
  'the corrected entry stays linked to the activity'
);

-- Archived
reset role;
update public.scheduled_activities set archived_at = now() where id = pg_temp.act('a4');
select pg_temp.login('a_operator');
select throws_ok(
  $$ select pg_temp.complete(pg_temp.act('a4'), '2032-02-29') $$,
  'P0001', 'activity_archived',
  'an archived activity cannot be completed'
);
select isnt_empty(
  $$ select 1 from public.scheduled_activities where id = pg_temp.act('a4') and archived_at is not null $$,
  'archived activities stay readable'
);

-- History
select pg_temp.login('a_admin');
select ok(
  exists (select 1 from public.activity_history
           where table_name = 'scheduled_activities' and record_id = pg_temp.act('a1') and action = 'update'
             and actor_id = pg_temp.uid('a_operator')),
  'completions advancing the schedule are recorded in history with the operator'
);
select pg_temp.login('b_admin');
select is_empty(
  $$ select 1 from public.activity_history where record_id = pg_temp.act('a1') $$,
  'B cannot read A''s activity history'
);

select * from finish();
rollback;
