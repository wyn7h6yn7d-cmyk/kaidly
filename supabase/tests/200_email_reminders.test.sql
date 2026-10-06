-- Deadline reminder e-mails (docs/EMAIL_NOTIFICATIONS.md): the user preference and its RLS,
-- enqueueing from in-app reminders, idempotency, coalescing, the processor (dispatch,
-- reconcile, retry, failure, exhaustion, stale recovery, expiry), the recheck before
-- sending (preference, address, membership, role, deactivation, read), the recipient and
-- the generic, operational-data-free payload. Nothing leaves the database: the requests
-- queued with pg_net are rolled back with the test, and the URL is an unreachable local one.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql
\ir helpers/sites.psql

select plan(82);

-- Sensitive operational data that must never appear in an e-mail.
update public.organisations set name = 'Secret Factory' where id = pg_temp.org('a');
update public.electrical_installations set name = 'Main Switchboard PK-01', identifier = 'PK-01' where id = pg_temp.inst('a1');
update public.sites set name = 'Hidden Site Tallinn' where id = pg_temp.site('a1');
update public.profiles set preferred_locale = 'en' where id = pg_temp.uid('a_operator');
update public.profiles set preferred_locale = 'ru' where id = pg_temp.uid('multi');

create function pg_temp.activity(p_n int, p_title text, p_due date) returns uuid language sql as $$
  insert into public.scheduled_activities (id, organisation_id, site_id, electrical_installation_id, title, description,
                                           frequency_type, next_due_on, reminder_days, responsible_person_name, created_by)
  values (('ee000000-0000-4000-8000-00000000000' || p_n)::uuid, pg_temp.org('a'), pg_temp.site('a1'), pg_temp.inst('a1'),
          p_title, 'Critical deficiency in the main cabinet', 'once', p_due, '{14}', 'Responsible Person Name', pg_temp.uid('a_admin'))
  returning id $$;
-- Generation limited to this file's activities (the local demo seed has its own).
create function pg_temp.gen(p_today date) returns int language sql as $$
  select coalesce(sum(private.generate_activity_reminders(p_today, a.id)), 0)::int
    from public.scheduled_activities a where a.id::text like 'ee000000-%' $$;
create function pg_temp.status_for(p_user text, p_activity int, p_due date) returns text language sql as $$
  select o.status || coalesce(':' || o.last_error, '')
    from public.notifications n
    join private.email_outbox_items it on it.notification_id = n.id
    join private.email_outbox o on o.id = it.outbox_id
   where n.user_id = pg_temp.uid(p_user) and n.due_on = p_due
     and n.scheduled_activity_id = ('ee000000-0000-4000-8000-00000000000' || p_activity)::uuid $$;
create function pg_temp.outbox(p_user text) returns setof private.email_outbox language sql as $$
  select * from private.email_outbox where user_id = pg_temp.uid(p_user) order by created_at, id $$;
create function pg_temp.items(p_user text) returns int language sql as $$
  select count(*)::int from private.email_outbox_items it join private.email_outbox o on o.id = it.outbox_id
   where o.user_id = pg_temp.uid(p_user) $$;
create function pg_temp.status(p_user text) returns text language sql as $$
  select string_agg(status || coalesce(':' || last_error, ''), ',' order by created_at, id) from private.email_outbox where user_id = pg_temp.uid(p_user) $$;
create function pg_temp.request(p_user text) returns bigint language sql as $$
  select request_id from private.email_outbox where user_id = pg_temp.uid(p_user) and status = 'processing' $$;
create function pg_temp.body(p_request bigint) returns text language sql as $$
  select convert_from(body, 'utf8') from net.http_request_queue where id = p_request $$;
create function pg_temp.respond(p_request bigint, p_status int, p_content text default null, p_timed_out boolean default null) returns void language sql as $$
  insert into net._http_response (id, status_code, content, timed_out, error_msg)
  values (p_request, p_status, p_content, p_timed_out, case when p_timed_out then 'Timeout was reached' end) $$;
create function pg_temp.queued() returns int language sql as $$
  select count(*)::int from net.http_request_queue where url = 'http://127.0.0.1:9/kaidly-test' $$;

-- The local demo seed queues its own reminder e-mails; they are out of scope here.
delete from private.email_outbox where user_id not in (select id from test_users);

-- ---------------------------------------------------------------------------
-- Preference: own row only
-- ---------------------------------------------------------------------------

select pg_temp.login('a_owner');
select is((select count(*)::int from public.notification_preferences), 0, 'no preference row yet: the default (on) applies');
insert into public.notification_preferences (user_id, email_deadline_reminders) values (pg_temp.uid('a_owner'), false);
select is((select email_deadline_reminders from public.notification_preferences where user_id = pg_temp.uid('a_owner')), false,
  'a user can store and read their own preference');
select throws_ok($$ insert into public.notification_preferences (user_id, email_deadline_reminders) values (pg_temp.uid('a_admin'), false) $$,
  '42501', null, 'a user cannot create a preference for someone else');
select pg_temp.login('a_admin');
insert into public.notification_preferences (user_id) values (pg_temp.uid('a_admin'));
select pg_temp.login('a_owner');
select is((select count(*)::int from public.notification_preferences where user_id = pg_temp.uid('a_admin')), 0,
  'a co-member cannot read another user''s preference');
update public.notification_preferences set email_deadline_reminders = false where user_id = pg_temp.uid('a_admin');
select throws_ok($$ update public.notification_preferences set user_id = pg_temp.uid('a_admin') $$, '42501', null,
  'the owner of a preference row cannot be changed');
select throws_ok($$ select * from private.email_outbox $$, '42501', null, 'users cannot read the outbox');
select throws_ok($$ insert into private.email_outbox (user_id) values (pg_temp.uid('a_owner')) $$, '42501', null, 'users cannot forge outbox rows');
select throws_ok($$ select private.process_email_outbox() $$, '42501', null, 'users cannot run the sender');
select throws_ok($$ insert into public.notifications (user_id, organisation_id, scheduled_activity_id, due_on, threshold_days)
                    values (pg_temp.uid('a_owner'), pg_temp.org('a'), gen_random_uuid(), current_date, 1) $$, '42501', null,
  'users cannot forge notifications (the e-mail source)');
select throws_ok($$ update public.profiles set email = 'attacker@example.com' where id = pg_temp.uid('a_owner') $$, '42501', null,
  'users cannot redirect their profile e-mail');
select pg_temp.logout();
select throws_ok($$ select * from public.notification_preferences $$, '42501', null, 'anon cannot read preferences');
reset role;
select is((select email_deadline_reminders from public.notification_preferences where user_id = pg_temp.uid('a_admin')), true,
  'another user''s preference was not changed');

-- ---------------------------------------------------------------------------
-- Enqueue from in-app reminders
-- ---------------------------------------------------------------------------

select pg_temp.activity(1, 'Annual inspection', '2030-10-12');
select pg_temp.gen('2030-09-28');
select is((select count(*)::int from public.notifications where user_id = pg_temp.uid('a_owner')), 1,
  'preference OFF: the in-app notification is still created');
select is(pg_temp.items('a_owner'), 0, 'preference OFF: no e-mail is queued');
select is(pg_temp.items('a_admin'), 1, 'preference ON: one e-mail item for the reminder');
select is(pg_temp.status('a_admin'), 'pending', 'queued as pending');
select is(pg_temp.items('a_operator') + pg_temp.items('multi'), 2, 'every in-app recipient with the preference on is queued');
select is((select count(*)::int from public.notifications where user_id = pg_temp.uid('a_viewer')), 0, 'viewers get no in-app reminder…');
select is(pg_temp.items('a_viewer'), 0, '…and no e-mail (same recipient rule)');
select is(pg_temp.items('b_owner'), 0, 'other companies are untouched');
select is(pg_temp.gen('2030-09-28'), 0, 'the reminder job running twice creates nothing new…');
select is(pg_temp.items('a_admin'), 1, '…and queues no second e-mail');

select pg_temp.activity(2, 'Second inspection', '2030-10-10');
select pg_temp.gen('2030-09-28');
select is((select count(*)::int from pg_temp.outbox('a_admin')), 1, 'two reminders before the next run share one e-mail');
select is(pg_temp.items('a_admin'), 2, 'both reminders are attached to it');

-- A broken e-mail channel never blocks the in-app reminder.
alter table private.email_outbox_items add constraint test_break check (false) not valid;
select pg_temp.activity(3, 'Third inspection', '2030-10-11');
select lives_ok($$ select private.generate_activity_reminders('2030-09-28', 'ee000000-0000-4000-8000-000000000003') $$,
  'the reminder job does not fail when the e-mail channel does');
select is((select count(*)::int from public.notifications where scheduled_activity_id = 'ee000000-0000-4000-8000-000000000003'), 4,
  'the in-app reminders were created anyway');
select is((select count(*)::int from private.email_outbox_items it join public.notifications n on n.id = it.notification_id
            where n.scheduled_activity_id = 'ee000000-0000-4000-8000-000000000003'), 0, 'and simply have no e-mail');
alter table private.email_outbox_items drop constraint test_break;

-- Unconfirmed address: not queued.
update auth.users set email_confirmed_at = null where id = pg_temp.uid('b_operator');
insert into public.scheduled_activities (id, organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on, reminder_days, created_by)
values ('ee000000-0000-4000-8000-0000000000b1', pg_temp.org('b'), pg_temp.site('b1'), pg_temp.inst('b1'), 'B', 'once', '2030-10-12', '{14}', pg_temp.uid('b_admin'));
select pg_temp.gen('2030-09-28');
select is(pg_temp.items('b_operator'), 0, 'no confirmed e-mail: nothing queued');
select is(pg_temp.items('b_owner'), 1, 'colleagues with an address are queued');

-- ---------------------------------------------------------------------------
-- Processor: disabled by default
-- ---------------------------------------------------------------------------

select is(private.process_email_outbox() ->> 'sending', 'disabled', 'sending is off by default (no key, not enabled)');
select is(pg_temp.status('a_admin'), 'pending', 'nothing was attempted');
update private.email_settings set enabled = true, api_url = 'http://127.0.0.1:9/kaidly-test';
select is(private.process_email_outbox() ->> 'sending', 'disabled', 'enabled without the Vault key still sends nothing');
select vault.create_secret('re_test_placeholder_not_a_key', 'RESEND_API_KEY');

-- ---------------------------------------------------------------------------
-- Dispatch
-- ---------------------------------------------------------------------------

update public.profiles set email = 'attacker@example.com' where id = pg_temp.uid('a_admin'); -- as the database owner
select is((private.process_email_outbox() ->> 'dispatched')::int, 5, 'one request per queued user (admin, operator, multi, b_owner, b_admin)');
select is(pg_temp.queued(), 5, 'five requests handed to pg_net');
select is(pg_temp.status('a_admin'), 'processing', 'claimed rows are processing');
select is((select attempt_count from pg_temp.outbox('a_admin')), 1, 'first attempt counted');
select is((private.process_email_outbox() ->> 'dispatched')::int, 0, 'a second run does not send in-flight e-mails again');
select is(pg_temp.queued(), 5, 'still five requests');

select is(pg_temp.body(pg_temp.request('a_admin'))::jsonb -> 'to', '["a.admin@example.ee"]'::jsonb,
  'recipient: the user''s Auth e-mail only (not a profile or client value)');
select is(pg_temp.body(pg_temp.request('a_admin'))::jsonb ->> 'from', 'KAIDLY <notifications@kaidly.ee>', 'sender');
select is(pg_temp.body(pg_temp.request('a_admin'))::jsonb ->> 'subject', 'KAIDLY | Sul on uus tähtajaga seotud teavitus', 'Estonian by default');
select is(pg_temp.body(pg_temp.request('a_operator'))::jsonb ->> 'subject', 'KAIDLY | You have a new deadline notification', 'English for an English user');
select is(pg_temp.body(pg_temp.request('multi'))::jsonb ->> 'subject', 'KAIDLY | У вас новое уведомление о сроке', 'Russian for a Russian user');
select is((select locale from pg_temp.outbox('multi')), 'ru', 'the language used is recorded');
select ok(pg_temp.body(pg_temp.request('a_admin'))::jsonb ->> 'html' like '%href="https://kaidly.ee/teavitused"%', 'CTA: the notification centre');
select ok(pg_temp.body(pg_temp.request('a_admin')) not like '%{{%', 'no unfilled placeholder');
select is((select headers ->> 'Idempotency-Key' from net.http_request_queue where id = pg_temp.request('a_admin')),
  'kaidly-outbox-' || (select id from pg_temp.outbox('a_admin'))::text, 'idempotency key = outbox id');

-- Privacy: nothing operational in the outgoing request.
select is_empty($$
  select v from unnest(array['Secret Factory', 'Main Switchboard PK-01', 'PK-01', 'Hidden Site Tallinn', 'Annual inspection',
                             'Second inspection', 'Critical deficiency', 'Responsible Person Name', '2030-10-12', '12.10.2030',
                             'org-a-test', 'ee000000', '0a000000', '1a000000', '5a000000', 'attacker@']) v
   where exists (select 1 from net.http_request_queue q where q.url = 'http://127.0.0.1:9/kaidly-test'
                    and (convert_from(q.body, 'utf8') ilike '%' || v || '%' or q.headers::text ilike '%' || v || '%')) $$,
  'no company, site, installation, activity, date, id or foreign address in any request');
select ok((select bool_and(convert_from(body, 'utf8') not ilike '%' || n.id::text || '%')
             from net.http_request_queue, public.notifications n where url = 'http://127.0.0.1:9/kaidly-test'),
  'no notification id in any request');

-- ---------------------------------------------------------------------------
-- Results, retries, failures
-- ---------------------------------------------------------------------------

select pg_temp.respond(pg_temp.request('a_admin'), 200, '{"id":"msg_test_1"}');
select pg_temp.respond(pg_temp.request('a_operator'), 429, '{"name":"rate_limit_exceeded"}');
select pg_temp.respond(pg_temp.request('multi'), 503, 'unavailable');
select pg_temp.respond(pg_temp.request('b_owner'), null, null, true);
select pg_temp.respond(pg_temp.request('b_admin'), 422, '{"name":"validation_error"}');
select private.process_email_outbox();
select is(pg_temp.status('a_admin'), 'sent', '2xx: sent');
select is((select provider_message_id from pg_temp.outbox('a_admin')), 'msg_test_1', 'provider message id stored');
select is(pg_temp.status('a_operator'), 'retry:rate_limited', '429: retry');
select is(pg_temp.status('multi'), 'retry:provider_5xx', '5xx: retry');
select is(pg_temp.status('b_owner'), 'retry:network', 'timeout: retry');
select is(pg_temp.status('b_admin'), 'failed:provider_422', 'other 4xx: failed permanently');
select ok((select next_attempt_at between now() + interval '4 minutes' and now() + interval '6 minutes' from pg_temp.outbox('a_operator')),
  'first retry after about 5 minutes');
select is(pg_temp.queued(), 5, 'retries wait for their time');

update private.email_outbox set next_attempt_at = now() - interval '1 second' where user_id = pg_temp.uid('a_operator');
select private.process_email_outbox();
select is((select attempt_count from pg_temp.outbox('a_operator')), 2, 'retried: second attempt');
select is((select headers ->> 'Idempotency-Key' from net.http_request_queue where id = pg_temp.request('a_operator')),
  'kaidly-outbox-' || (select id from pg_temp.outbox('a_operator'))::text, 'a retry reuses the idempotency key');
select is(pg_temp.body(pg_temp.request('a_operator'))::jsonb ->> 'subject', 'KAIDLY | You have a new deadline notification',
  'a retry sends the same message');

select pg_temp.respond(pg_temp.request('a_operator'), 500, null);
select private.process_email_outbox();
select ok((select next_attempt_at between now() + interval '9 minutes' and now() + interval '11 minutes' from pg_temp.outbox('a_operator')),
  'backoff doubles (10 minutes)');

update private.email_outbox set attempt_count = 4, next_attempt_at = now() - interval '1 second' where user_id = pg_temp.uid('a_operator');
select private.process_email_outbox();
select pg_temp.respond(pg_temp.request('a_operator'), 502, null);
select private.process_email_outbox();
select is(pg_temp.status('a_operator'), 'failed:exhausted:provider_5xx', 'after the fifth attempt: failed, no endless retries');

-- Lost request (no response, e.g. worker restart): recovered as a retry.
update private.email_outbox set next_attempt_at = now() - interval '1 second' where user_id = pg_temp.uid('multi');
select private.process_email_outbox();
update private.email_outbox set claimed_at = now() - interval '20 minutes' where user_id = pg_temp.uid('multi');
select private.process_email_outbox();
select is(pg_temp.status('multi'), 'retry:stale', 'stale processing row goes back to retry');
update private.email_outbox set claimed_at = now() - interval '1 minute', status = 'processing' where user_id = pg_temp.uid('multi');
select private.process_email_outbox();
select is((select status from pg_temp.outbox('multi')), 'processing', 'a recent request without an answer is left alone');

-- A failed or sent e-mail never creates more in-app notifications.
select is((select count(*)::int from public.notifications where user_id = pg_temp.uid('a_operator')), 3,
  'in-app notifications are unchanged by e-mail failures');

-- ---------------------------------------------------------------------------
-- Recheck immediately before sending
-- ---------------------------------------------------------------------------

-- ON → OFF after queueing: the opt-out cancels what has not been sent.
select pg_temp.activity(4, 'Fourth', '2030-10-12');
select pg_temp.gen('2030-09-28');
select is((select count(*)::int from pg_temp.outbox('a_admin') where status = 'pending'), 1, 'new reminder queued for a_admin');
select pg_temp.login('a_admin');
update public.notification_preferences set email_deadline_reminders = false where user_id = pg_temp.uid('a_admin');
reset role;
select is((select status || ':' || last_error from pg_temp.outbox('a_admin') where status <> 'sent'), 'cancelled:preference_off',
  'turning the preference off cancels the queued e-mail');
select is((select count(*)::int from public.notifications where user_id = pg_temp.uid('a_admin') and read_at is null), 4,
  'in-app notifications stay');

-- Preference off without the trigger (e.g. a race): the sender itself refuses.
update public.notification_preferences set email_deadline_reminders = true where user_id = pg_temp.uid('a_admin');
select pg_temp.activity(5, 'Fifth', '2030-10-12');
select pg_temp.gen('2030-09-28');
set local session_replication_role = replica;
update public.notification_preferences set email_deadline_reminders = false where user_id = pg_temp.uid('a_admin');
set local session_replication_role = origin;
select private.process_email_outbox();
select is((select count(*)::int from pg_temp.outbox('a_admin') where status = 'cancelled' and last_error = 'preference_off'), 2,
  'preference rechecked at send time: cancelled, not sent');
update public.notification_preferences set email_deadline_reminders = true where user_id = pg_temp.uid('a_admin');

create function pg_temp.fresh(p_n int) returns void language sql as $$
  select pg_temp.activity(p_n, 'Fresh ' || p_n, '2030-10-12');
  select pg_temp.gen('2030-09-28');
$$;

-- Removed membership.
select pg_temp.fresh(6);
delete from public.organisation_members where organisation_id = pg_temp.org('a') and user_id = pg_temp.uid('multi');
select private.process_email_outbox();
select is(pg_temp.status_for('multi', 6, '2030-10-12'), 'cancelled:not_eligible', 'removed from the company before sending: not sent');

-- Downgraded to viewer.
select pg_temp.fresh(7);
update public.organisation_members set role = 'viewer' where organisation_id = pg_temp.org('a') and user_id = pg_temp.uid('a_admin');
select private.process_email_outbox();
select is(pg_temp.status_for('a_admin', 7, '2030-10-12'), 'cancelled:not_eligible', 'lost the role before sending: not sent');
update public.organisation_members set role = 'admin' where organisation_id = pg_temp.org('a') and user_id = pg_temp.uid('a_admin');

-- Address removed / unconfirmed after queueing.
select pg_temp.fresh(8);
update auth.users set email_confirmed_at = null where id = pg_temp.uid('a_admin');
select private.process_email_outbox();
select is(pg_temp.status_for('a_admin', 8, '2030-10-12'), 'cancelled:no_email', 'no confirmed address at send time: not sent');
update auth.users set email_confirmed_at = now() where id = pg_temp.uid('a_admin');

-- Disabled user.
update public.scheduled_activities set next_due_on = '2030-10-11' where id = 'ee000000-0000-4000-8000-000000000008';
select pg_temp.gen('2030-09-28');
update auth.users set banned_until = now() + interval '1 year' where id = pg_temp.uid('a_admin');
select private.process_email_outbox();
select is(pg_temp.status_for('a_admin', 8, '2030-10-11'), 'cancelled:user_disabled', 'disabled user: not sent');
update auth.users set banned_until = null where id = pg_temp.uid('a_admin');

-- Already read in KAIDLY.
update public.scheduled_activities set next_due_on = '2030-10-10' where id = 'ee000000-0000-4000-8000-000000000008';
select pg_temp.gen('2030-09-28');
update public.notifications set read_at = now() where user_id = pg_temp.uid('a_admin');
select private.process_email_outbox();
select is(pg_temp.status_for('a_admin', 8, '2030-10-10'), 'cancelled:not_eligible', 'reminder already read in KAIDLY: no e-mail');

-- Expired (read-only) company: in-app reminders continue, so e-mails do too.
update private.organisation_access set trial_started_at = now() - interval '30 days', trial_ends_at = now() - interval '1 day'
 where organisation_id = pg_temp.org('a');
update public.scheduled_activities set next_due_on = '2030-10-09' where id = 'ee000000-0000-4000-8000-000000000008';
select pg_temp.gen('2030-09-28');
select private.process_email_outbox();
select is(pg_temp.status_for('a_admin', 8, '2030-10-09'), 'processing', 'expired trial: sent like the in-app reminder (documented policy)');

-- Deactivated company: queued e-mails are not sent.
update public.scheduled_activities set next_due_on = '2030-10-08' where id = 'ee000000-0000-4000-8000-000000000008';
select pg_temp.gen('2030-09-28');
update public.organisations set deactivated_at = now() where id = pg_temp.org('a');
select private.process_email_outbox();
select is(pg_temp.status_for('a_owner', 8, '2030-10-08') is null and pg_temp.status_for('a_admin', 8, '2030-10-08') = 'cancelled:not_eligible', true,
  'deactivated company: not sent');
select is(pg_temp.gen('2030-10-07'), 0, 'and no new reminders are generated for it');
update public.organisations set deactivated_at = null where id = pg_temp.org('a');

-- Old backlog is never sent.
insert into private.email_outbox (user_id, status, created_at) values (pg_temp.uid('a_owner'), 'retry', now() - interval '3 days');
select private.process_email_outbox();
select is(pg_temp.status('a_owner'), 'cancelled:expired', 'e-mails older than two days are dropped, not sent late');

-- Deleting a user removes their queued e-mails with them.
select is((select count(*)::int from private.email_outbox where user_id = pg_temp.uid('b_admin')) > 0, true, 'b_admin has e-mail history');
delete from auth.users where id = pg_temp.uid('b_admin');
select is((select count(*)::int from private.email_outbox where user_id = pg_temp.uid('b_admin')), 0, 'outbox rows go with the account');

-- The schedule exists once.
select is((select count(*)::int from cron.job where jobname = 'kaidly-email-outbox' and schedule = '*/5 * * * *'), 1,
  'the sender runs every 5 minutes');
select is((select count(*)::int from cron.job where jobname = 'kaidly-activity-reminders' and schedule = '15 3 * * *'), 1,
  'the reminder job is unchanged');

select * from finish();
rollback;
