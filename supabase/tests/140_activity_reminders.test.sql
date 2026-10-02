-- Deadline reminders on top of the operating plan: thresholds, the tightest-reached rule,
-- idempotency, recurrence, recipients (roles, removed members, disabled users,
-- deactivated organisations), tenant isolation of notifications, and the Tallinn
-- business date around midnight.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

select plan(45);

-- Due dates far in the future, so the insert-time evaluation (real today) creates nothing;
-- generation is then driven with explicit "today" values.
insert into public.scheduled_activities (id, organisation_id, site_id, electrical_installation_id, title, frequency_type,
                                         interval_value, interval_unit, next_due_on, reminder_days, created_by)
values
  ('ae000000-0000-4000-8000-000000000001', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Mitme meeldetuletusega',
   'recurring', 1, 'year', '2030-06-30', '{30,14,7,1}', pg_temp.uid('a_admin')),
  ('ae000000-0000-4000-8000-000000000002', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Tähtaja päeval',
   'once', null, null, '2030-06-30', '{0}', pg_temp.uid('a_admin')),
  ('ae000000-0000-4000-8000-000000000003', pg_temp.org('a'), pg_temp.site('a2'), pg_temp.inst('a2'), 'Vaikimisi',
   'once', null, null, '2030-06-30', default, pg_temp.uid('a_admin')),
  ('ae000000-0000-4000-8000-000000000004', pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'B tegevus',
   'once', null, null, '2033-06-30', '{14}', pg_temp.uid('b_admin'));

create function pg_temp.n(p_activity text, p_threshold int default null) returns int language sql as $$
  select count(*)::int from public.notifications
   where scheduled_activity_id = ('ae000000-0000-4000-8000-00000000000' || p_activity)::uuid
     and (p_threshold is null or threshold_days = p_threshold)
$$;

select is(pg_temp.n('1') + pg_temp.n('2') + pg_temp.n('3') + pg_temp.n('4'), 0, 'far-future activities create no reminders');
select is((select reminder_days from public.scheduled_activities where id = 'ae000000-0000-4000-8000-000000000003'), '{14}'::smallint[],
  'the default threshold is 14 days');

-- Thresholds
select private.generate_activity_reminders('2030-05-30', 'ae000000-0000-4000-8000-000000000001');
select is(pg_temp.n('1'), 0, '31 days before: nothing yet');
select private.generate_activity_reminders('2030-05-31', 'ae000000-0000-4000-8000-000000000001');
select is(pg_temp.n('1', 30), 4, '30 days before: one reminder each for owner, admin and the two operators');
select is((select count(*)::int from public.notifications where user_id = pg_temp.uid('a_viewer')), 0, 'viewers are not notified');
select is(private.generate_activity_reminders('2030-05-31', 'ae000000-0000-4000-8000-000000000001'), 0, 'running again the same day creates nothing');
select is(private.generate_activity_reminders('2030-06-02', 'ae000000-0000-4000-8000-000000000001'), 0, 'nor on later days before the next threshold');
select private.generate_activity_reminders('2030-06-16');
select is(pg_temp.n('1', 14), 4, '14 days before');
select private.generate_activity_reminders('2030-06-23');
select is(pg_temp.n('1', 7), 4, '7 days before');
select private.generate_activity_reminders('2030-06-29');
select is(pg_temp.n('1', 1), 4, '1 day before');
select is(pg_temp.n('1'), 16, 'four thresholds × four recipients, no duplicates');
select is(pg_temp.n('2'), 0, 'threshold 0 waits for the due date');
select private.generate_activity_reminders('2030-06-30');
select is(pg_temp.n('2', 0), 4, 'threshold 0 fires on the due date (Tähtaeg täna)');
select is(pg_temp.n('1'), 16, 'due today adds nothing once every threshold has fired');
select is(pg_temp.n('3', 14), 4, 'a missed run catches up: the default 14-day reminder still comes, on the due date');

-- Overdue, and the tightest-reached rule on a late first evaluation.
update public.scheduled_activities set reminder_days = '{30,14,7}' where id = 'ae000000-0000-4000-8000-000000000003';
select is(pg_temp.n('3'), 4, 'changing thresholds keeps existing reminders');
insert into public.scheduled_activities (id, organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on, reminder_days, created_by)
values ('ae000000-0000-4000-8000-000000000005', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Hilja lisatud', 'once', '2030-06-30', '{30,14,7}', pg_temp.uid('a_admin'));
select private.generate_activity_reminders('2030-06-25');
select is(pg_temp.n('5'), 4, 'evaluated late (5 days before): only one reminder per person…');
select is(pg_temp.n('5', 7), 4, '…for the tightest threshold reached (7), not 30, 14 and 7 at once');
insert into public.scheduled_activities (id, organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on, reminder_days, created_by)
values ('ae000000-0000-4000-8000-000000000006', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Üle tähtaja', 'once', '2030-06-30', '{14}', pg_temp.uid('a_admin'));
select private.generate_activity_reminders('2030-07-03');
select is(pg_temp.n('6', 14), 4, 'an overdue activity without a reminder gets one');

-- Recurring completion: old occurrence's reminders become history, the new occurrence starts fresh.
select pg_temp.login('a_operator');
select public.complete_scheduled_activity('ae000000-0000-4000-8000-000000000001', '2030-06-30', 'inspection', now(), null, null, null);
select pg_temp.logout();
reset role;
select is((select next_due_on from public.scheduled_activities where id = 'ae000000-0000-4000-8000-000000000001'), '2031-06-30'::date,
  'completion advances by the anchored recurrence');
select is((select count(*)::int from public.notifications where scheduled_activity_id = 'ae000000-0000-4000-8000-000000000001' and read_at is null), 0,
  'unread reminders of the completed occurrence are marked read');
select is(pg_temp.n('1'), 16, 'and kept as history (not deleted, not copied forward)');
select private.generate_activity_reminders('2031-06-16');
select is((select count(*)::int from public.notifications where scheduled_activity_id = 'ae000000-0000-4000-8000-000000000001' and due_on = '2031-06-30'), 4,
  'the next occurrence gets its own reminders (the first threshold reached is 14)');
select is((select count(*)::int from public.notifications where scheduled_activity_id = 'ae000000-0000-4000-8000-000000000001' and due_on = '2031-06-30' and threshold_days = 14), 4,
  'identity includes the due occurrence');

-- Recipients: removed members, disabled users, deactivated organisations.
delete from public.organisation_members where organisation_id = pg_temp.org('a') and user_id = pg_temp.uid('multi');
update auth.users set banned_until = now() + interval '100 years' where id = pg_temp.uid('a_admin');
update public.scheduled_activities set next_due_on = '2032-01-31' where id = 'ae000000-0000-4000-8000-000000000003';
select private.generate_activity_reminders('2032-01-20');
select results_eq(
  $$ select p.email from public.notifications n join public.profiles p on p.id = n.user_id
      where n.scheduled_activity_id = 'ae000000-0000-4000-8000-000000000003' and n.due_on = '2032-01-31' order by 1 $$,
  $$ values ('a.operator@example.ee'), ('a.owner@example.ee') $$,
  'removed members and disabled accounts receive no new reminders'
);
update public.organisations set deactivated_at = now() where id = pg_temp.org('b');
select private.generate_activity_reminders('2033-06-20');
select is(pg_temp.n('4'), 0, 'a deactivated organisation generates no reminders');
update public.organisations set deactivated_at = null where id = pg_temp.org('b');
select private.generate_activity_reminders('2033-06-20');
select is(pg_temp.n('4', 14), 3, 'company B: owner, admin, operator (multi is only a viewer there)');

-- ===========================================================================
-- Access
-- ===========================================================================

select pg_temp.login('b_owner');
select is((select count(*)::int from public.notifications where organisation_id = pg_temp.org('a')), 0, 'B cannot read A notifications');
with u as (update public.notifications set read_at = now() where organisation_id = pg_temp.org('a') returning 1)
select is(count(*)::int, 0, 'B cannot mark A notifications read') from u;
select is((public.my_notifications()->>'total')::int, (select count(*)::int from public.notifications), 'my_notifications lists only own rows');
select ok((select bool_and(r->>'company' = 'Organisatsioon B') from jsonb_array_elements(public.my_notifications(false, 100, 0)->'rows') r),
  'and only for the own company');

select pg_temp.login('multi');
select is((select count(*)::int from public.notifications where organisation_id = pg_temp.org('a')), 0,
  'a removed member no longer sees that company''s old reminders');

select pg_temp.login('a_owner');
select throws_ok($$ insert into public.notifications (user_id, organisation_id, scheduled_activity_id, due_on, threshold_days)
                    values (auth.uid(), pg_temp.org('a'), 'ae000000-0000-4000-8000-000000000002', '2030-06-30', 3) $$,
  '42501', null, 'users cannot create notifications');
select throws_ok($$ update public.notifications set user_id = pg_temp.uid('b_owner') where user_id = auth.uid() $$,
  '42501', null, 'only read_at is writable');
select throws_ok($$ delete from public.notifications where user_id = auth.uid() $$, '42501', null, 'notifications cannot be deleted by users');
with u as (update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null returning 1)
select ok(count(*) > 0, 'mark all read works on own rows') from u;
select is((public.my_notifications()->>'unread')::int, 0, 'unread count follows');
select throws_ok($$ select private.generate_activity_reminders() $$, '42501', null, 'users cannot run the generator');

-- Reminder configuration: admins and owners only.
select pg_temp.login('a_operator');
with u as (update public.scheduled_activities set reminder_days = '{1}' where id = 'ae000000-0000-4000-8000-000000000002' returning 1)
select is(count(*)::int, 0, 'operators cannot change reminder thresholds') from u;
select pg_temp.login('a_viewer');
with u as (update public.scheduled_activities set reminder_days = '{1}' where id = 'ae000000-0000-4000-8000-000000000002' returning 1)
select is(count(*)::int, 0, 'viewers cannot change reminder thresholds') from u;
select pg_temp.login('a_owner');
select throws_ok($$ update public.scheduled_activities set reminder_days = '{400}' where id = 'ae000000-0000-4000-8000-000000000002' $$,
  '23514', null, 'thresholds are 0–365 days');

-- ===========================================================================
-- Scheduler and business date
-- ===========================================================================

select pg_temp.logout();
reset role;
select is((select schedule from cron.job where jobname = 'kaidly-activity-reminders'), '15 3 * * *', 'the generator runs daily via pg_cron');
select is(private.business_date('2026-10-01 20:59:59+00'), '2026-10-01'::date, 'summer: 23:59:59 in Tallinn is still the same day');
select is(private.business_date('2026-10-01 21:00:00+00'), '2026-10-02'::date, 'summer: midnight in Tallinn (21:00 UTC) is the next day');
select is(private.business_date('2026-12-31 22:00:00+00'), '2027-01-01'::date, 'winter: midnight in Tallinn is 22:00 UTC');

select * from finish();
rollback;
