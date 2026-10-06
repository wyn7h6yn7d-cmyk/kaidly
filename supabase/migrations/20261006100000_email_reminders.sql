-- KAIDLY: optional e-mail delivery for deadline reminders (docs/EMAIL_NOTIFICATIONS.md).
--
-- The in-app reminder (public.notifications, written only by
-- private.generate_activity_reminders) stays the source of truth. E-mail is an extra,
-- best-effort channel built on top of it:
--
--   notification inserted ──trigger──▶ private.email_outbox (+ item per notification)
--   pg_cron every 5 min ──▶ private.process_email_outbox()
--        reconcile earlier requests ▸ recover stale ones ▸ claim due rows (SKIP LOCKED)
--        ▸ recheck preference + eligibility ▸ pg_net POST to Resend (Idempotency-Key)
--
-- * Generic content only (private.email_templates): no company, site, installation,
--   activity, date or other operational detail ever leaves the database by e-mail.
-- * Recipient: the user's own confirmed Auth e-mail, read at send time. Nothing in this
--   migration is callable by anon or authenticated; there is no API that sends mail.
-- * Idempotency: a notification belongs to at most one outbox row (unique item key), and
--   notifications are already unique per (user, activity, occurrence, threshold, channel).
--   Every request carries Idempotency-Key = outbox id, so a retry after a lost response
--   cannot produce a second e-mail at Resend.
-- * Coalescing: notifications created for one user before the next run share one pending
--   e-mail (a daily run with several due activities sends one message, not several).
-- * Failure of anything here never blocks the in-app notification (exception-guarded
--   trigger) or the reminder job (separate cron job).
-- * Sending is OFF by default (private.email_settings.enabled = false) and needs the Vault
--   secret 'RESEND_API_KEY'; local, CI and the development project never send.

-- ---------------------------------------------------------------------------
-- User preference (own row only; no row = enabled)
-- ---------------------------------------------------------------------------

-- A separate table, not a profiles column: co-members can read each other's profiles.
create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email_deadline_reminders boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.notification_preferences is
  'Per-user notification preferences. No row = defaults (deadline reminder e-mails on). '
  'Controls only optional KAIDLY reminder e-mails, never Auth/security e-mails.';

alter table public.notification_preferences enable row level security;

create policy "users read their own notification preferences" on public.notification_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "users create their own notification preferences" on public.notification_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "users change their own notification preferences" on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select on table public.notification_preferences to authenticated;
grant insert (user_id, email_deadline_reminders), update (email_deadline_reminders)
  on table public.notification_preferences to authenticated;

create function private.touch_notification_preferences()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger notification_preferences_touch
  before update on public.notification_preferences
  for each row execute function private.touch_notification_preferences();

-- ---------------------------------------------------------------------------
-- Settings and templates (private: no API access)
-- ---------------------------------------------------------------------------

create extension if not exists pg_net;

create table private.email_settings (
  id boolean primary key default true check (id),
  -- Real sending happens only when this is true AND the Vault secret exists.
  enabled boolean not null default false,
  api_url text not null default 'https://api.resend.com/emails',
  from_address text not null default 'KAIDLY <notifications@kaidly.ee>',
  site_url text not null default 'https://kaidly.ee' check (site_url ~ '^https?://[^/?#]+$'),
  batch_size integer not null default 50 check (batch_size between 1 and 500),
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  updated_at timestamptz not null default now()
);
insert into private.email_settings default values;

comment on table private.email_settings is
  'E-mail outbox configuration (one row). The Resend API key is NOT here: Vault secret '
  '''RESEND_API_KEY''. docs/EMAIL_NOTIFICATIONS.md.';

create table private.email_templates (
  template text not null,
  locale text not null check (locale in ('et', 'en', 'ru')),
  subject text not null,
  html text not null,
  text text not null,
  updated_at timestamptz not null default now(),
  primary key (template, locale)
);

-- ---------------------------------------------------------------------------
-- Outbox
-- ---------------------------------------------------------------------------

create table private.email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  template text not null default 'deadline_reminder' check (template in ('deadline_reminder')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'retry', 'sent', 'failed', 'cancelled')),
  -- Language actually used (fixed at the first attempt, so retries send the same request).
  locale text check (locale in ('et', 'en', 'ru')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  request_id bigint,
  sent_at timestamptz,
  -- A short category (e.g. 'rate_limited', 'preference_off'), never provider text.
  last_error text check (char_length(last_error) <= 60),
  provider_message_id text check (char_length(provider_message_id) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One open (not yet attempted) e-mail per user: new reminders join it.
create unique index email_outbox_one_pending_per_user on private.email_outbox (user_id) where status = 'pending';
create index email_outbox_due_idx on private.email_outbox (next_attempt_at) where status in ('pending', 'retry');
create index email_outbox_processing_idx on private.email_outbox (claimed_at) where status = 'processing';
create index email_outbox_user_idx on private.email_outbox (user_id);

create table private.email_outbox_items (
  -- A notification is e-mailed at most once, ever.
  notification_id uuid primary key references public.notifications (id) on delete cascade,
  outbox_id uuid not null references private.email_outbox (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index email_outbox_items_outbox_idx on private.email_outbox_items (outbox_id);

comment on table private.email_outbox is
  'Deadline reminder e-mails. One row = at most one e-mail. Holds no operational content.';

-- ---------------------------------------------------------------------------
-- Enqueue: after an in-app reminder is created
-- ---------------------------------------------------------------------------

-- Statement-level and set-based: the daily run inserts thousands of reminders at once
-- (measured: a per-row trigger made a 30,000-reminder run 10x slower).
create function private.enqueue_reminder_emails()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    with eligible as (
      select n.id, n.user_id
        from new_notifications n
        join auth.users u on u.id = n.user_id and u.email is not null and u.email_confirmed_at is not null
       where n.channel = 'in_app' and n.type = 'activity_reminder'
         and not exists (select 1 from public.notification_preferences p
                          where p.user_id = n.user_id and not p.email_deadline_reminders)
    ),
    outbox as (
      insert into private.email_outbox (user_id)
      select distinct user_id from eligible
      on conflict (user_id) where status = 'pending' do update set updated_at = now()
      returning id, user_id
    )
    insert into private.email_outbox_items (notification_id, outbox_id)
    select e.id, o.id from eligible e join outbox o on o.user_id = e.user_id
    on conflict (notification_id) do nothing;
  exception when others then
    -- The in-app notifications must never fail because of the e-mail channel.
    raise warning 'kaidly email: enqueue skipped (sqlstate %)', sqlstate;
  end;
  return null;
end;
$$;

create trigger notifications_enqueue_email
  after insert on public.notifications
  referencing new table as new_notifications
  for each statement execute function private.enqueue_reminder_emails();

-- Turning the preference off cancels e-mails that have not been handed to the provider.
create function private.cancel_reminder_emails_on_opt_out()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.email_deadline_reminders then
    update private.email_outbox
       set status = 'cancelled', last_error = 'preference_off', updated_at = now()
     where user_id = new.user_id and status in ('pending', 'retry');
  end if;
  return null;
end;
$$;

create trigger notification_preferences_opt_out
  after insert or update of email_deadline_reminders on public.notification_preferences
  for each row execute function private.cancel_reminder_emails_on_opt_out();

-- ---------------------------------------------------------------------------
-- Eligibility at send time
-- ---------------------------------------------------------------------------

-- Why an outbox row must not be sent (null = send). Mirrors the in-app recipient rule of
-- private.generate_activity_reminders: owner/admin/operator member of an organisation that
-- is not deactivated, user not disabled. Commercial access state (trial/expired) is not a
-- criterion there either, so it is not one here. Unread items only: a reminder already
-- opened in KAIDLY needs no e-mail.
create function private.email_block_reason(p_outbox uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from private.email_outbox o
                   join public.notification_preferences p on p.user_id = o.user_id
                  where o.id = p_outbox and not p.email_deadline_reminders) then 'preference_off'
    when not exists (select 1 from private.email_outbox o join auth.users u on u.id = o.user_id
                      where o.id = p_outbox and u.email is not null and u.email_confirmed_at is not null) then 'no_email'
    when exists (select 1 from private.email_outbox o join auth.users u on u.id = o.user_id
                  where o.id = p_outbox and u.banned_until is not null and u.banned_until > now()) then 'user_disabled'
    when not exists (
      select 1
        from private.email_outbox o
        join private.email_outbox_items it on it.outbox_id = o.id
        join public.notifications n on n.id = it.notification_id and n.user_id = o.user_id
        join public.organisations org on org.id = n.organisation_id and org.deactivated_at is null
        join public.organisation_members m
          on m.organisation_id = n.organisation_id and m.user_id = o.user_id
         and m.role in ('owner', 'admin', 'operator')
       where o.id = p_outbox and n.read_at is null) then 'not_eligible'
  end
$$;

-- ---------------------------------------------------------------------------
-- Processing (pg_cron)
-- ---------------------------------------------------------------------------

-- Retryable answer categories; anything else from the provider is permanent.
create function private.email_response_category(p_status integer, p_timed_out boolean, p_error text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_status between 200 and 299 then 'ok'
    when p_status is null and (coalesce(p_timed_out, false) or p_error is not null) then 'retry:network'
    when p_status is null then 'retry:no_response'
    when p_status = 429 then 'retry:rate_limited'
    when p_status = 409 then 'retry:idempotency_conflict'
    when p_status >= 500 then 'retry:provider_5xx'
    else 'fail:provider_' || p_status::text
  end
$$;

create function private.process_email_outbox()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s private.email_settings;
  v_key text;
  r record;
  v_resp record;
  v_cat text;
  v_reason text;
  v_email text;
  v_locale text;
  v_tpl private.email_templates;
  v_request bigint;
  v_message text;
  v_sent int := 0; v_retry int := 0; v_failed int := 0; v_cancelled int := 0; v_dispatched int := 0;
begin
  -- One processor at a time (overlapping cron runs simply skip).
  if not pg_try_advisory_xact_lock(hashtext('kaidly-email-outbox')) then
    return jsonb_build_object('skipped', 'locked');
  end if;
  select * into s from private.email_settings;

  -- 1. Results of earlier requests.
  for r in select * from private.email_outbox
            where status = 'processing' and request_id is not null
            order by claimed_at for update skip locked loop
    select status_code, timed_out, error_msg, content into v_resp
      from net._http_response where id = r.request_id;
    if not found then
      -- No answer yet. After 15 minutes the request is considered lost; the retry uses
      -- the same Idempotency-Key, so Resend will not send it twice.
      if r.claimed_at < now() - interval '15 minutes' then
        v_cat := 'retry:stale';
      else
        continue;
      end if;
    else
      v_cat := private.email_response_category(v_resp.status_code, v_resp.timed_out, v_resp.error_msg);
    end if;

    if v_cat = 'ok' then
      begin
        v_message := left(v_resp.content::jsonb ->> 'id', 100);
      exception when others then
        v_message := null; -- accepted is accepted, even with an unreadable body
      end;
      update private.email_outbox
         set status = 'sent', sent_at = now(), last_error = null, updated_at = now(), provider_message_id = v_message
       where id = r.id;
      v_sent := v_sent + 1;
      raise log 'kaidly email: outbox % sent (attempt %)', r.id, r.attempt_count;
    elsif v_cat like 'retry:%' and r.attempt_count < s.max_attempts then
      update private.email_outbox
         set status = 'retry', last_error = substr(v_cat, 7), updated_at = now(),
             next_attempt_at = now() + interval '5 minutes' * power(2, greatest(r.attempt_count - 1, 0))
       where id = r.id;
      v_retry := v_retry + 1;
      raise log 'kaidly email: outbox % retry (attempt %, %)', r.id, r.attempt_count, substr(v_cat, 7);
    else
      update private.email_outbox
         set status = 'failed', updated_at = now(),
             last_error = case when v_cat like 'retry:%' then 'exhausted:' || substr(v_cat, 7) else substr(v_cat, 6) end
       where id = r.id;
      v_failed := v_failed + 1;
      raise warning 'kaidly email: outbox % failed (attempt %, %)', r.id, r.attempt_count, v_cat;
    end if;
  end loop;

  -- 2. Reminder e-mails are only useful while fresh: never send a backlog older than two
  --    days (e.g. after sending was switched on). Finished rows are kept for 90 days.
  update private.email_outbox
     set status = 'cancelled', last_error = 'expired', updated_at = now()
   where status in ('pending', 'retry') and created_at < now() - interval '2 days';
  delete from private.email_outbox
   where status in ('sent', 'failed', 'cancelled') and updated_at < now() - interval '90 days';

  -- 3. New attempts — only when sending is configured.
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'RESEND_API_KEY' limit 1;
  if not s.enabled or v_key is null or v_key = '' then
    return jsonb_build_object('sent', v_sent, 'retry', v_retry, 'failed', v_failed, 'dispatched', 0,
                              'cancelled', 0, 'sending', 'disabled');
  end if;

  for r in select * from private.email_outbox
            where status in ('pending', 'retry') and next_attempt_at <= now()
            order by next_attempt_at, id
            limit s.batch_size
            for update skip locked loop
    -- Recheck immediately before sending: preference, address, access.
    v_reason := private.email_block_reason(r.id);
    if v_reason is not null then
      update private.email_outbox set status = 'cancelled', last_error = v_reason, updated_at = now() where id = r.id;
      v_cancelled := v_cancelled + 1;
      raise log 'kaidly email: outbox % cancelled (%)', r.id, v_reason;
      continue;
    end if;

    select u.email into v_email from auth.users u where u.id = r.user_id;
    v_locale := coalesce(r.locale, (select p.preferred_locale from public.profiles p where p.id = r.user_id), 'et');
    select * into v_tpl from private.email_templates t where t.template = r.template and t.locale = v_locale;
    if not found then
      select * into v_tpl from private.email_templates t where t.template = r.template and t.locale = 'et';
      v_locale := 'et';
    end if;

    v_request := net.http_post(
      url := s.api_url,
      body := jsonb_build_object(
        'from', s.from_address,
        'to', jsonb_build_array(v_email),
        'subject', v_tpl.subject,
        'html', replace(v_tpl.html, '{{site_url}}', s.site_url),
        'text', replace(v_tpl.text, '{{site_url}}', s.site_url)),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key,
        'Idempotency-Key', 'kaidly-outbox-' || r.id::text),
      timeout_milliseconds := 10000);

    update private.email_outbox
       set status = 'processing', locale = v_locale, attempt_count = attempt_count + 1,
           claimed_at = now(), request_id = v_request, updated_at = now()
     where id = r.id;
    v_dispatched := v_dispatched + 1;
  end loop;

  return jsonb_build_object('sent', v_sent, 'retry', v_retry, 'failed', v_failed,
                            'dispatched', v_dispatched, 'cancelled', v_cancelled, 'sending', 'enabled');
end;
$$;

revoke all on function private.touch_notification_preferences() from public, anon, authenticated;
revoke all on function private.enqueue_reminder_emails() from public, anon, authenticated;
revoke all on function private.cancel_reminder_emails_on_opt_out() from public, anon, authenticated;
revoke all on function private.email_block_reason(uuid) from public, anon, authenticated;
revoke all on function private.email_response_category(integer, boolean, text) from public, anon, authenticated;
revoke all on function private.process_email_outbox() from public, anon, authenticated;

-- Every 5 minutes; does nothing until sending is enabled and the key is in Vault.
select cron.schedule('kaidly-email-outbox', '*/5 * * * *', 'select private.process_email_outbox()');

-- Templates (generic; see scripts/email-templates.mjs).
-- >>> GENERATED by scripts/email-templates.mjs --sql (do not edit by hand)
insert into private.email_templates (template, locale, subject, html, text) values
  ('deadline_reminder', 'et',
   $kaidly_email$KAIDLY | Sul on uus tähtajaga seotud teavitus$kaidly_email$,
   $kaidly_email$<!doctype html><html lang="et"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KAIDLY | Sul on uus tähtajaga seotud teavitus</title></head><body style="margin:0;padding:0;background:#E7E5E1;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#E7E5E1;">
  <tr>
    <td align="center" style="padding:28px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border:1px solid #D6D3CD;border-radius:6px;">
        <tr><td style="height:4px;line-height:4px;font-size:0;background:#22D07A;border-radius:6px 6px 0 0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:22px 28px 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td width="12" height="24" bgcolor="#22D07A" style="width:12px;height:24px;background:#22D07A;font-size:0;line-height:0;">&nbsp;</td>
              <td width="10" style="width:10px;font-size:0;line-height:0;">&nbsp;</td>
              <td style="vertical-align:middle;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:20px;font-weight:800;letter-spacing:1px;color:#0F3D32;">KAIDLY</td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 28px;">
            <h1 style="margin:0 0 14px;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:22px;line-height:1.3;font-weight:700;color:#111827;">Sul on uus teavitus</h1>
            <p style="margin:0 0 14px;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:16px;line-height:1.55;color:#4B5563;">KAIDLYs on sulle uus tähtajaga seotud teavitus.</p>
            <p style="margin:0 0 14px;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:16px;line-height:1.55;color:#4B5563;">Täpsema info vaatamiseks logi KAIDLYsse.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 18px;"><tr><td style="border-radius:4px;background:#22D07A;"><a href="{{site_url}}/teavitused" style="display:inline-block;padding:14px 26px;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:16px;font-weight:700;line-height:1.2;color:#0F3D32;text-decoration:none;border-radius:4px;">Vaata teavitusi</a></td></tr></table>
            <p style="margin:0 0 6px;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:13px;line-height:1.5;color:#4B5563;">Kui nupp ei tööta, ava see link:</p>
            <p style="margin:0 0 18px;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:13px;line-height:1.5;word-break:break-all;"><a href="{{site_url}}/teavitused" style="color:#0F3D32;text-decoration:underline;">{{site_url}}/teavitused</a></p>
            <p style="margin:18px 0 0;padding-top:16px;border-top:1px solid #D6D3CD;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:14px;line-height:1.5;color:#4B5563;"><a href="{{site_url}}/konto#teavitused" style="color:#0F3D32;text-decoration:underline;">Muuda e-posti teavitusi KAIDLY seadetes.</a></p>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td style="padding:16px 8px 0;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:12px;line-height:1.6;color:#4B5563;text-align:center;">
            <strong style="color:#0F3D32;">KAIDLY</strong> · Elektripaigaldise käit. Lihtsalt. · <a href="https://kaidly.ee" style="color:#0F3D32;text-decoration:none;">kaidly.ee</a><br>See on automaatne KAIDLY teavitus.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table></body></html>$kaidly_email$,
   $kaidly_email$KAIDLY

Sul on uus teavitus

KAIDLYs on sulle uus tähtajaga seotud teavitus.
Täpsema info vaatamiseks logi KAIDLYsse.

Vaata teavitusi: {{site_url}}/teavitused

Muuda e-posti teavitusi KAIDLY seadetes. {{site_url}}/konto#teavitused

KAIDLY · Elektripaigaldise käit. Lihtsalt. · kaidly.ee
See on automaatne KAIDLY teavitus.$kaidly_email$),
  ('deadline_reminder', 'en',
   $kaidly_email$KAIDLY | You have a new deadline notification$kaidly_email$,
   $kaidly_email$<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KAIDLY | You have a new deadline notification</title></head><body style="margin:0;padding:0;background:#E7E5E1;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#E7E5E1;">
  <tr>
    <td align="center" style="padding:28px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border:1px solid #D6D3CD;border-radius:6px;">
        <tr><td style="height:4px;line-height:4px;font-size:0;background:#22D07A;border-radius:6px 6px 0 0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:22px 28px 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td width="12" height="24" bgcolor="#22D07A" style="width:12px;height:24px;background:#22D07A;font-size:0;line-height:0;">&nbsp;</td>
              <td width="10" style="width:10px;font-size:0;line-height:0;">&nbsp;</td>
              <td style="vertical-align:middle;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:20px;font-weight:800;letter-spacing:1px;color:#0F3D32;">KAIDLY</td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 28px;">
            <h1 style="margin:0 0 14px;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:22px;line-height:1.3;font-weight:700;color:#111827;">You have a new notification</h1>
            <p style="margin:0 0 14px;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:16px;line-height:1.55;color:#4B5563;">KAIDLY has a new deadline-related notification for you.</p>
            <p style="margin:0 0 14px;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:16px;line-height:1.55;color:#4B5563;">Sign in to KAIDLY to view the details.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 18px;"><tr><td style="border-radius:4px;background:#22D07A;"><a href="{{site_url}}/teavitused" style="display:inline-block;padding:14px 26px;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:16px;font-weight:700;line-height:1.2;color:#0F3D32;text-decoration:none;border-radius:4px;">View notifications</a></td></tr></table>
            <p style="margin:0 0 6px;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:13px;line-height:1.5;color:#4B5563;">If the button doesn't work, open this link:</p>
            <p style="margin:0 0 18px;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:13px;line-height:1.5;word-break:break-all;"><a href="{{site_url}}/teavitused" style="color:#0F3D32;text-decoration:underline;">{{site_url}}/teavitused</a></p>
            <p style="margin:18px 0 0;padding-top:16px;border-top:1px solid #D6D3CD;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:14px;line-height:1.5;color:#4B5563;"><a href="{{site_url}}/konto#teavitused" style="color:#0F3D32;text-decoration:underline;">Change email notifications in your KAIDLY settings.</a></p>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td style="padding:16px 8px 0;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:12px;line-height:1.6;color:#4B5563;text-align:center;">
            <strong style="color:#0F3D32;">KAIDLY</strong> · Electrical installation operation, simply. · <a href="https://kaidly.ee" style="color:#0F3D32;text-decoration:none;">kaidly.ee</a><br>This is an automatic KAIDLY notification.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table></body></html>$kaidly_email$,
   $kaidly_email$KAIDLY

You have a new notification

KAIDLY has a new deadline-related notification for you.
Sign in to KAIDLY to view the details.

View notifications: {{site_url}}/teavitused

Change email notifications in your KAIDLY settings. {{site_url}}/konto#teavitused

KAIDLY · Electrical installation operation, simply. · kaidly.ee
This is an automatic KAIDLY notification.$kaidly_email$),
  ('deadline_reminder', 'ru',
   $kaidly_email$KAIDLY | У вас новое уведомление о сроке$kaidly_email$,
   $kaidly_email$<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KAIDLY | У вас новое уведомление о сроке</title></head><body style="margin:0;padding:0;background:#E7E5E1;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#E7E5E1;">
  <tr>
    <td align="center" style="padding:28px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border:1px solid #D6D3CD;border-radius:6px;">
        <tr><td style="height:4px;line-height:4px;font-size:0;background:#22D07A;border-radius:6px 6px 0 0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:22px 28px 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td width="12" height="24" bgcolor="#22D07A" style="width:12px;height:24px;background:#22D07A;font-size:0;line-height:0;">&nbsp;</td>
              <td width="10" style="width:10px;font-size:0;line-height:0;">&nbsp;</td>
              <td style="vertical-align:middle;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:20px;font-weight:800;letter-spacing:1px;color:#0F3D32;">KAIDLY</td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 28px;">
            <h1 style="margin:0 0 14px;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:22px;line-height:1.3;font-weight:700;color:#111827;">У вас новое уведомление</h1>
            <p style="margin:0 0 14px;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:16px;line-height:1.55;color:#4B5563;">В KAIDLY для вас есть новое уведомление, связанное со сроком.</p>
            <p style="margin:0 0 14px;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:16px;line-height:1.55;color:#4B5563;">Чтобы посмотреть подробности, войдите в KAIDLY.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 18px;"><tr><td style="border-radius:4px;background:#22D07A;"><a href="{{site_url}}/teavitused" style="display:inline-block;padding:14px 26px;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:16px;font-weight:700;line-height:1.2;color:#0F3D32;text-decoration:none;border-radius:4px;">Открыть уведомления</a></td></tr></table>
            <p style="margin:0 0 6px;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:13px;line-height:1.5;color:#4B5563;">Если кнопка не работает, откройте ссылку:</p>
            <p style="margin:0 0 18px;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:13px;line-height:1.5;word-break:break-all;"><a href="{{site_url}}/teavitused" style="color:#0F3D32;text-decoration:underline;">{{site_url}}/teavitused</a></p>
            <p style="margin:18px 0 0;padding-top:16px;border-top:1px solid #D6D3CD;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:14px;line-height:1.5;color:#4B5563;"><a href="{{site_url}}/konto#teavitused" style="color:#0F3D32;text-decoration:underline;">Настроить уведомления по электронной почте можно в настройках KAIDLY.</a></p>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td style="padding:16px 8px 0;font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:12px;line-height:1.6;color:#4B5563;text-align:center;">
            <strong style="color:#0F3D32;">KAIDLY</strong> · Эксплуатация электроустановок — просто. · <a href="https://kaidly.ee" style="color:#0F3D32;text-decoration:none;">kaidly.ee</a><br>Это автоматическое уведомление KAIDLY.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table></body></html>$kaidly_email$,
   $kaidly_email$KAIDLY

У вас новое уведомление

В KAIDLY для вас есть новое уведомление, связанное со сроком.
Чтобы посмотреть подробности, войдите в KAIDLY.

Открыть уведомления: {{site_url}}/teavitused

Настроить уведомления по электронной почте можно в настройках KAIDLY. {{site_url}}/konto#teavitused

KAIDLY · Эксплуатация электроустановок — просто. · kaidly.ee
Это автоматическое уведомление KAIDLY.$kaidly_email$)
on conflict (template, locale) do update
  set subject = excluded.subject, html = excluded.html, text = excluded.text, updated_at = now();
-- <<< GENERATED
