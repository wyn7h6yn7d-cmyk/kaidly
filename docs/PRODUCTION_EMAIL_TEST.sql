-- KAIDLY — Production reminder-email test (docs/EMAIL_NOTIFICATIONS.md §6)
--
-- Production project: xakpbtmksxvjmsbipwmj — Supabase Dashboard → SQL Editor.
-- Run ONE statement at a time, in order, and compare with the "Expected" notes.
-- Scope: organisation 'Enefit OÜ (TEST)', activity title 'KAIDLY e-posti test' only.
-- Validated against the local stack (all statements, in order, rolled back) on 2026-10-06.

-- 1. Recipient eligibility check
-- Expected: your address, role owner, email_confirmed = true, email_reminders_on = true.
-- Every owner/admin/operator with email_reminders_on = true receives the e-mail:
-- stop here if anyone other than you is listed that way.
select u.email,
       m.role,
       u.email_confirmed_at is not null as email_confirmed,
       coalesce(p.email_deadline_reminders, true) as email_reminders_on
  from public.organisations o
  join public.organisation_members m on m.organisation_id = o.id
  join auth.users u on u.id = m.user_id
  left join public.notification_preferences p on p.user_id = m.user_id
 where o.name = 'Enefit OÜ (TEST)'
   and o.deactivated_at is null
 order by m.role, u.email;

-- 2. Email sender / Vault readiness check
-- Expected: enabled = true, from_address = KAIDLY <notifications@kaidly.ee>,
-- site_url = https://kaidly.ee, resend_key_present = 1, sender_job_active = 1.
select s.enabled,
       s.from_address,
       s.site_url,
       (select count(*) from vault.secrets v where v.name = 'RESEND_API_KEY') as resend_key_present,
       (select count(*) from cron.job j where j.jobname = 'kaidly-email-outbox' and j.active) as sender_job_active
  from private.email_settings s;

-- 3. Create exactly one test activity
-- Due in 3 days (Tallinn date), reminder threshold 7 days: the in-app reminder is created
-- immediately. Idempotent: inserts nothing while an unarchived test activity exists.
-- Expected: one row (or zero rows on a repeat run).
insert into public.scheduled_activities
  (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on, reminder_days)
select o.id,
       s.id,
       i.id,
       'KAIDLY e-posti test',
       'once',
       private.business_date() + 3,
       '{7}'::smallint[]
  from public.organisations o
  join public.sites s on s.organisation_id = o.id and s.archived_at is null
  join public.electrical_installations i on i.site_id = s.id and i.organisation_id = o.id and i.archived_at is null
 where o.name = 'Enefit OÜ (TEST)'
   and o.deactivated_at is null
   and not exists (
     select 1 from public.scheduled_activities a
      where a.organisation_id = o.id and a.title = 'KAIDLY e-posti test' and a.archived_at is null)
 order by s.created_at, s.id, i.created_at, i.id
 limit 1
returning id, organisation_id, next_due_on, reminder_days;

-- 4. Check notification + email outbox
-- Expected: one row per recipient — threshold_days = 7, read_at empty, outbox_id set,
-- status = pending, attempt_count = 0. Do NOT open the reminder in KAIDLY before the
-- e-mail is sent (an already-read reminder is cancelled instead of e-mailed).
select u.email,
       n.threshold_days,
       n.due_on,
       n.read_at,
       ob.id as outbox_id,
       ob.status,
       ob.attempt_count,
       ob.last_error
  from public.scheduled_activities a
  join public.organisations o on o.id = a.organisation_id
  join public.notifications n on n.scheduled_activity_id = a.id and n.organisation_id = a.organisation_id
  join auth.users u on u.id = n.user_id
  left join private.email_outbox_items it on it.notification_id = n.id
  left join private.email_outbox ob on ob.id = it.outbox_id
 where o.name = 'Enefit OÜ (TEST)'
   and a.title = 'KAIDLY e-posti test'
 order by u.email;

-- 5. Run reminder generator only if necessary (only if step 4 returned no rows)
-- Scoped to the test activity. Expected: 0 when step 3 already created the reminder.
select private.generate_activity_reminders(
         null,
         (select a.id
            from public.scheduled_activities a
            join public.organisations o on o.id = a.organisation_id
           where o.name = 'Enefit OÜ (TEST)'
             and a.title = 'KAIDLY e-posti test'
             and a.archived_at is null
           order by a.created_at desc
           limit 1)
       ) as reminders_created;

-- 6. Check cron / optionally run sender
-- 6a. Sender job runs (every 5 minutes, at :00, :05, ...). Expected: status = succeeded.
select d.status, d.return_message, d.start_time, d.end_time
  from cron.job_run_details d
  join cron.job j on j.jobid = d.jobid
 where j.jobname = 'kaidly-email-outbox'
 order by d.start_time desc
 limit 5;

-- 6b. OPTIONAL instead of waiting: run the sender once by hand. It does exactly what the
-- scheduled job does (all queued e-mails, not only the test). Expected: "sending": "enabled",
-- "dispatched": 1. The next run (≈5 min later) records Resend's answer.
select private.process_email_outbox() as sender_result;

-- 7. Check final outbox result (≈10 minutes after step 3)
-- Expected: status = sent, attempt_count = 1, last_error empty, provider_message_id set,
-- sent_at set. retry = temporary (automatic); failed + provider_401/403 = key problem;
-- failed + provider_422 = request rejected by Resend; cancelled = reason in last_error.
-- Then Resend → Emails → the message with this provider_message_id: from
-- KAIDLY <notifications@kaidly.ee>, subject "KAIDLY | Sul on uus tähtajaga seotud teavitus",
-- button → https://kaidly.ee/teavitused, no operational details, tracking off.
select distinct ob.id as outbox_id,
       ob.status,
       ob.attempt_count,
       ob.last_error,
       ob.provider_message_id,
       ob.locale,
       ob.created_at,
       ob.sent_at
  from private.email_outbox ob
  join private.email_outbox_items it on it.outbox_id = ob.id
  join public.notifications n on n.id = it.notification_id
  join public.scheduled_activities a on a.id = n.scheduled_activity_id and a.organisation_id = n.organisation_id
  join public.organisations o on o.id = a.organisation_id
 where o.name = 'Enefit OÜ (TEST)'
   and a.title = 'KAIDLY e-posti test';

-- 8. Archive the test activity
-- Expected: one row; its reminder is marked read.
update public.scheduled_activities a
   set archived_at = now()
  from public.organisations o
 where o.id = a.organisation_id
   and o.name = 'Enefit OÜ (TEST)'
   and a.title = 'KAIDLY e-posti test'
   and a.archived_at is null
returning a.id, a.archived_at;

-- 9. Optional safe cleanup
-- Deletes only outbox rows whose every reminder belongs to the test activity (their items
-- go with them). Deletes nothing if any other reminder shares the e-mail.
-- Expected: one row (the test e-mail). Finished rows are also removed after 90 days.
delete from private.email_outbox ob
 where ob.id in (
         select it.outbox_id
           from private.email_outbox_items it
           join public.notifications n on n.id = it.notification_id
           join public.scheduled_activities a on a.id = n.scheduled_activity_id and a.organisation_id = n.organisation_id
           join public.organisations o on o.id = a.organisation_id
          where o.name = 'Enefit OÜ (TEST)'
            and a.title = 'KAIDLY e-posti test')
   and not exists (
         select 1
           from private.email_outbox_items it2
           join public.notifications n2 on n2.id = it2.notification_id
           join public.scheduled_activities a2 on a2.id = n2.scheduled_activity_id and a2.organisation_id = n2.organisation_id
           join public.organisations o2 on o2.id = a2.organisation_id
          where it2.outbox_id = ob.id
            and not (o2.name = 'Enefit OÜ (TEST)' and a2.title = 'KAIDLY e-posti test'))
returning ob.id, ob.status;
