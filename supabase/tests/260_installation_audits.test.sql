-- Periodic audits (migration installation_audits): history readable by members and the
-- site's viewers only, recorded by owners/admins only, append-only, no future dates,
-- tenants separated; the next-audit deadline is one live 'periodic_audit' activity per
-- installation whose 90/30-day reminders come from the existing generator.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

create function pg_temp.blocked(p_sql text) returns boolean language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n = 0;
exception when others then
  return true;
end $$;
grant execute on function pg_temp.blocked(text) to authenticated;

-- A site viewer on a1 (outsider) and on nothing else.
insert into public.site_viewers (organisation_id, site_id, user_id) values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.uid('outsider'));

select plan(18);

select pg_temp.login('a_admin');
select lives_ok($$ insert into public.installation_audits (organisation_id, site_id, electrical_installation_id, audited_on, result, auditor, document_url)
  values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), current_date - 30, 'Positiivne', 'Auditor OÜ', 'https://drive.example.com/audit') $$,
  'an admin records an audit');
select is((select created_by_name from public.installation_audits limit 1), 'A Admin', 'the author comes from the session');
select lives_ok($$ insert into public.installation_audits (organisation_id, site_id, electrical_installation_id, audited_on, result, auditor)
  values (pg_temp.org('a'), pg_temp.site('a2'), pg_temp.inst('a2'), current_date - 400, 'Puudustega', 'Teine OÜ') $$, 'the document link is optional');
select throws_ok($$ insert into public.installation_audits (organisation_id, site_id, electrical_installation_id, audited_on, result, auditor)
  values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), current_date + 2, 'X', 'Y') $$, 'P0001', 'audit_in_future', 'no audits in the future');
select throws_ok($$ insert into public.installation_audits (organisation_id, site_id, electrical_installation_id, audited_on, result, auditor, document_url)
  values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), current_date, 'X', 'Y', 'http://example.com/x') $$, '23514', null, 'https links only');
select ok(pg_temp.blocked($$ update public.installation_audits set result = 'Muudetud' $$), 'audits are not edited (append-only)');
select ok(pg_temp.blocked($$ delete from public.installation_audits $$), 'audits are not deleted');

select pg_temp.login('a_operator');
select ok(pg_temp.blocked($$ insert into public.installation_audits (organisation_id, site_id, electrical_installation_id, audited_on, result, auditor)
  values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), current_date, 'X', 'Y') $$), 'operators cannot record audits');
select is((select count(*)::int from public.installation_audits), 2, 'members read the history');

select pg_temp.login('b_admin');
select throws_ok($$ insert into public.installation_audits (organisation_id, site_id, electrical_installation_id, audited_on, result, auditor)
  values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), current_date, 'X', 'Y') $$, '42501', 'forbidden', 'another company cannot record (forbidden, no hint)');
select is((select count(*)::int from public.installation_audits), 0, 'another company reads nothing');

select pg_temp.login('outsider');
select results_eq($$ select result from public.installation_audits $$, $$ values ('Positiivne'::text) $$, 'a site viewer reads the audits of their site only');
select ok(pg_temp.blocked($$ insert into public.installation_audits (organisation_id, site_id, electrical_installation_id, audited_on, result, auditor)
  values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), current_date, 'X', 'Y') $$), 'a site viewer cannot record audits');

-- Next audit deadline: one live periodic_audit activity per installation, 90/30 reminders.
select pg_temp.login('a_admin');
select lives_ok($$ insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on, reminder_days, kind)
  values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Korraline audit', 'once', current_date + 80, '{90,30}', 'periodic_audit') $$,
  'an admin sets the next audit deadline');
select throws_ok($$ insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on, reminder_days, kind)
  values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Teine', 'once', current_date + 200, '{90,30}', 'periodic_audit') $$,
  '23505', null, 'only one live deadline per installation');
select throws_ok($$ insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on, kind)
  values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'X', 'once', current_date + 5, 'muu') $$, '23514', null, 'unknown kinds are refused');
reset role;
select private.generate_activity_reminders(current_date, null);
select ok((select count(*) from public.notifications n join public.scheduled_activities a on a.id = n.scheduled_activity_id
            where a.kind = 'periodic_audit' and n.threshold_days = 90) > 0, '80 days before: the 90-day reminder exists');
select is((select count(*)::int from public.notifications n join public.scheduled_activities a on a.id = n.scheduled_activity_id
            where a.kind = 'periodic_audit' and n.threshold_days = 30), 0, 'the 30-day reminder is not due yet');

select * from finish();
rollback;
