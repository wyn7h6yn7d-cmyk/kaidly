-- Archiving without abuse (migration archive_limits): archive cap = active limit, restoring
-- needs a free slot (archive → add → restore fails), trial 10, archived installations are
-- locked, no reminders or reminder e-mails for them, delete_installation (empty / archived
-- with export + name), the history note, admin churn view. Every check runs as the
-- authenticated role — the same path as a direct API request.

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
create function pg_temp.add(p_name text) returns uuid language sql as $$
  insert into public.electrical_installations (organisation_id, site_id, name, installation_type)
  values (pg_temp.org('a'), pg_temp.site('a1'), p_name, 'switchboard') returning id $$;
create function pg_temp.id(p_name text) returns uuid language sql stable as $$
  select id from public.electrical_installations where organisation_id = pg_temp.org('a') and name = p_name $$;
grant execute on function pg_temp.add(text), pg_temp.id(text) to authenticated;
create function pg_temp.root() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end $$;
grant execute on function pg_temp.root() to authenticated, anon;

-- Company A: limit 3 active installations (a1, a2 exist).
update private.organisation_access set installation_limit = 3 where organisation_id = pg_temp.org('a');

select plan(39);

-- ===========================================================================
-- Archive → add → restore: refused at the limit
-- ===========================================================================
select pg_temp.login('a_admin');
select lives_ok($$ select pg_temp.add('K3') $$, 'third active installation (3 / 3)');
select lives_ok($$ update public.electrical_installations set archived_at = now() where id = pg_temp.id('K3') $$, 'archive K3 (2 active)');
select lives_ok($$ select pg_temp.add('K4') $$, 'add K4 in the freed slot (3 active)');
select throws_ok($$ update public.electrical_installations set archived_at = null where id = pg_temp.id('K3') $$,
  'P0001', 'plan_restore_limit', 'restoring K3 is refused: no free active slot');
select is((select archived_at is not null from public.electrical_installations where id = pg_temp.id('K3')), true, 'K3 stays archived');

-- ===========================================================================
-- Archive cap = active limit (3)
-- ===========================================================================
select lives_ok($$ update public.electrical_installations set archived_at = now() where id = pg_temp.id('K4') $$, 'archive K4 (archive 2 / 3)');
select lives_ok($$ select pg_temp.add('K5'); update public.electrical_installations set archived_at = now() where name = 'K5' $$, 'archive K5 (archive 3 / 3)');
select lives_ok($$ select pg_temp.add('K6') $$, 'add K6');
select throws_ok($$ update public.electrical_installations set archived_at = now() where id = pg_temp.id('K6') $$,
  'P0001', 'plan_archive_limit', 'the archive is full: archiving is refused');
select pg_temp.root();
select is(private.installations_archived(pg_temp.org('a')), 3, 'archive holds exactly the limit');

-- A company without limits (legacy) is unaffected.
select pg_temp.login('b_admin');
select lives_ok($$ insert into public.electrical_installations (organisation_id, site_id, name, installation_type)
  select pg_temp.org('b'), pg_temp.site('b1'), 'B' || g, 'switchboard' from generate_series(1, 6) g;
  update public.electrical_installations set archived_at = now() where organisation_id = pg_temp.org('b') and name like 'B%' $$,
  'no limit: archiving and adding are not limited');

-- ===========================================================================
-- An archived installation is locked
-- ===========================================================================
select pg_temp.root();
insert into public.scheduled_activities (id, organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on, reminder_days)
values ('5c270000-0000-4000-8000-000000000001', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Kontroll', 'once', current_date + 5, '{14}');
insert into public.deficiencies (id, organisation_id, site_id, electrical_installation_id, title, description, severity, created_by)
values ('df270000-0000-4000-8000-000000000001', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Puudus', 'x', 'high', pg_temp.uid('a_operator'));
insert into public.log_entries (id, organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
values ('e2700000-0000-4000-8000-000000000001', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'Algne', pg_temp.uid('a_operator'));
insert into public.log_entries (id, organisation_id, site_id, electrical_installation_id, entry_type, description, created_by, correction_of_id, correction_reason)
values ('e2700000-0000-4000-8000-000000000002', pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'Parandus', pg_temp.uid('a_operator'),
        'e2700000-0000-4000-8000-000000000001', 'viga');
update private.organisation_access set installation_limit = null where organisation_id = pg_temp.org('a');
update public.electrical_installations set archived_at = now() where id = pg_temp.inst('a1');

select pg_temp.login('a_admin');
select ok(pg_temp.blocked($$ insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on)
  values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'Uus', 'once', current_date + 3) $$), 'no new activity');
select ok(pg_temp.blocked($$ update public.scheduled_activities set title = 'X' where id = '5c270000-0000-4000-8000-000000000001' $$), 'no activity change');
select ok(pg_temp.blocked($$ select public.complete_scheduled_activity('5c270000-0000-4000-8000-000000000001', current_date, 'inspection', now(), 'Tehtud') $$), 'no completion');
select ok(pg_temp.blocked($$ insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity)
  values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'X', 'X', 'low') $$), 'no new deficiency');
select ok(pg_temp.blocked($$ update public.deficiencies set title = 'X' where id = 'df270000-0000-4000-8000-000000000001' $$), 'no deficiency change');
select ok(pg_temp.blocked($$ select public.resolve_deficiency('df270000-0000-4000-8000-000000000001', 'Lahendatud', 'repair', now()) $$), 'no resolving');
select ok(pg_temp.blocked($$ insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description)
  values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), 'inspection', 'X') $$), 'no log entry');
select ok(pg_temp.blocked($$ insert into public.installation_audits (organisation_id, site_id, electrical_installation_id, audited_on, result, auditor)
  values (pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'), current_date - 1, 'X', 'Y') $$), 'no audit');
select ok(pg_temp.blocked($$ update public.electrical_installations set name = 'Uus nimi' where id = pg_temp.inst('a1') $$), 'the archived installation itself cannot be edited');

-- No reminders, no reminder e-mails.
select pg_temp.root();
-- Reminders created while it was still active are dropped here, then the daily run starts.
delete from public.notifications where scheduled_activity_id = '5c270000-0000-4000-8000-000000000001';
select private.generate_activity_reminders(current_date, null);
select is((select count(*)::int from public.notifications where scheduled_activity_id = '5c270000-0000-4000-8000-000000000001'), 0,
  'an archived installation creates no new reminders');
-- A notification created before archiving is not e-mailed.
insert into public.notifications (user_id, organisation_id, scheduled_activity_id, due_on, threshold_days)
values (pg_temp.uid('a_owner'), pg_temp.org('a'), '5c270000-0000-4000-8000-000000000001', current_date + 5, 14);
delete from private.email_outbox where user_id = pg_temp.uid('a_owner');
insert into private.email_outbox (id, user_id, status) values ('0e270000-0000-4000-8000-000000000001', pg_temp.uid('a_owner'), 'pending');
insert into private.email_outbox_items (notification_id, outbox_id)
select id, '0e270000-0000-4000-8000-000000000001' from public.notifications where scheduled_activity_id = '5c270000-0000-4000-8000-000000000001';
select is(private.email_block_reason('0e270000-0000-4000-8000-000000000001'), 'not_eligible', 'its e-mail is blocked');

-- Deleting history does not happen by accident: system cascades (a user deleted) still work.
select lives_ok($$ delete from auth.users where id = pg_temp.uid('multi') $$, 'foreign-key cascades still work on archived installations');

-- ===========================================================================
-- delete_installation
-- ===========================================================================
select pg_temp.login('a_admin');
select lives_ok($$ select pg_temp.add('Tühi') $$, 'an empty installation');
select lives_ok($$ select public.delete_installation(pg_temp.id('Tühi')) $$, 'an empty installation is deleted directly (active is fine)');
select is((select count(*)::int from public.electrical_installations where name = 'Tühi'), 0, 'gone');

select pg_temp.login('a_operator');
select throws_ok($$ select public.delete_installation(pg_temp.inst('a1'), 'A kilp 1') $$, 'P0002', 'not_found', 'operators cannot delete');
select pg_temp.login('b_admin');
select throws_ok($$ select public.delete_installation(pg_temp.inst('a1'), 'A kilp 1') $$, 'P0002', 'not_found', 'another company cannot delete');

select pg_temp.login('a_admin');
select pg_temp.root();
insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
values (pg_temp.org('a'), pg_temp.site('a2'), pg_temp.inst('a2'), 'inspection', 'Aktiivse kanne', pg_temp.uid('a_operator'));
select pg_temp.login('a_admin');
select throws_ok($$ select public.delete_installation(pg_temp.inst('a2'), 'A kilp 2') $$, 'P0001', 'installation_not_archived',
  'an active installation with history cannot be deleted');
select throws_ok($$ select public.delete_installation(pg_temp.inst('a1'), 'vale nimi') $$, 'P0001', 'confirm_name_mismatch', 'the name must match');
select ok(pg_temp.blocked($$ delete from public.electrical_installations where id = pg_temp.inst('a1') $$), 'no direct delete through the API');
select ok(pg_temp.blocked($$ delete from public.log_entries where electrical_installation_id = pg_temp.inst('a1') $$), 'the log stays append-only outside delete_installation');

select lives_ok($$ select public.delete_installation(pg_temp.inst('a1'), 'A kilp 1') $$, 'archived + name: export-and-delete');
select pg_temp.root();
select is((select count(*)::int from public.log_entries where electrical_installation_id = pg_temp.inst('a1'))
        + (select count(*)::int from public.deficiencies where electrical_installation_id = pg_temp.inst('a1'))
        + (select count(*)::int from public.scheduled_activities where electrical_installation_id = pg_temp.inst('a1')), 0,
  'its records are gone');
select is((select old_data ->> 'name' || ' · ' || (old_data ->> 'site') || ' · ' || (old_data ->> 'log_entries')
             from public.activity_history where record_id = pg_temp.inst('a1') and action = 'delete'),
          'A kilp 1 · A objekt 1 · 2', 'the history keeps one note: name, site, entry count');
select is((select actor_id from public.activity_history where record_id = pg_temp.inst('a1') and action = 'delete'), pg_temp.uid('a_admin'), '… and who deleted it');
select is((select count(*)::int from public.activity_history where record_id = 'df270000-0000-4000-8000-000000000001'), 0, 'no content left in the history');

-- ===========================================================================
-- Admin churn view
-- ===========================================================================
select pg_temp.root();
insert into private.platform_admins (user_id, mfa_required) values (pg_temp.uid('outsider'), false);
insert into public.activity_history (organisation_id, actor_id, table_name, record_id, action, old_data, new_data)
select pg_temp.org('b'), pg_temp.uid('b_admin'), 'electrical_installations', gen_random_uuid(), 'update',
       jsonb_build_object('archived_at', '2026-01-01'), jsonb_build_object('archived_at', null)
  from generate_series(1, 6);
select pg_temp.login('outsider');
select is((public.admin_archive_churn(30, 5) -> 0 ->> 'name'), 'Organisatsioon B', 'admin sees the company with more than 5 restore cycles');
select pg_temp.login('a_owner');
select throws_ok($$ select public.admin_archive_churn(30, 5) $$, 'P0002', 'not_found', 'not for anyone else');

select * from finish();
rollback;
