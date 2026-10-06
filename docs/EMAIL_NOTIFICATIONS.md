# KAIDLY — Deadline reminder e-mails (operations)

Optional e-mail copy of the in-app deadline reminders. The in-app notification
(`public.notifications`, written only by `private.generate_activity_reminders`) stays the
source of truth; e-mail is best-effort and never blocks it. Migration
`20261006100000_email_reminders.sql`; tests `supabase/tests/200_email_reminders.test.sql`,
`scripts/test-email-concurrency.mjs`, `e2e/account-email.spec.ts`.

## 1. Flow

```
pg_cron 03:15  private.generate_activity_reminders()      (unchanged deadline logic)
      │  inserts public.notifications (unique per user, activity, occurrence, threshold)
      ▼
statement trigger  private.enqueue_reminder_emails()      (exception-guarded)
      │  preference on + confirmed Auth e-mail → private.email_outbox (+ one item per notification)
      ▼
pg_cron */5 min  private.process_email_outbox()
      1. reconcile earlier requests (net._http_response) → sent / retry / failed
      2. drop backlog older than 2 days; delete finished rows after 90 days
      3. if enabled and the Vault key exists: claim due rows (FOR UPDATE SKIP LOCKED, batch 50),
         recheck, POST https://api.resend.com/emails via pg_net (Idempotency-Key = outbox id)
```

**Why in the database and not an Edge Function:** the reminder engine already runs inside
Postgres (pg_cron, no HTTP endpoint, no service key). An Edge Function would need a
privileged database credential (service_role / DB URL — KAIDLY uses neither anywhere) or a
shared secret that, if leaked, would let anyone make the function send mail. pg_net from the
database needs neither: there is no endpoint to call, and the key stays in Supabase Vault.

## 2. What the e-mail contains

Generic text only, in the user's language (`profiles.preferred_locale`, fallback Estonian):
"KAIDLY | Sul on uus tähtajaga seotud teavitus" → button "Vaata teavitusi" →
`https://kaidly.ee/teavitused` (the notification centre; sign-in first if needed, the login
`next` is allowlisted), plus "Muuda e-posti teavitusi KAIDLY seadetes" →
`https://kaidly.ee/konto#teavitused`. No company, site, address, installation, activity,
date, days, deficiency, document, person or id — the template has no data placeholders at
all (only `{{site_url}}`), and a pgTAP test checks the real outgoing request against a
sensitive fixture. Same image-free design as the Auth mails; HTML + plain text; no tracking.
Templates: `scripts/email-templates.mjs` (`APP_TEMPLATES`) → `--sql` → `private.email_templates`.

Several reminders created for one user before the next run share **one** e-mail (the
content is identical anyway): the daily run sends at most one message per user.

## 3. Who receives it

Exactly the in-app recipients: owner / admin / operator members of an organisation that is
not deactivated, user not disabled — and additionally:

- preference **on** (`public.notification_preferences.email_deadline_reminders`; no row = on);
- a confirmed Auth e-mail (`auth.users.email`, read at send time — never a client value).

Rechecked immediately before sending (cancelled with a reason otherwise): preference, address,
disabled user, still owner/admin/operator of a non-deactivated organisation for at least one
unread reminder in the mail. A reminder already opened in KAIDLY gets no e-mail.

**Expired / read-only trial:** in-app reminders are still generated for expired companies
(their users can still read them), so e-mails are sent too. **Deactivated company:** no new
reminders and queued e-mails are cancelled. Viewers: never (same as in-app).

## 4. User setting

`/konto` → section **Teavitused** → switch **Tähtaegade e-posti teavitused**. Default **on**
(no row needed; existing users are unaffected by the migration). Off cancels unsent e-mails
at once (trigger) and is rechecked at send time. It never affects Auth/security mail
(sign-up, password reset, e-mail change, reauthentication, security notifications) or the
in-app notifications. RLS: each user reads/creates/changes only their own row; company
admins and platform admins have no access.

## 5. Status, retry, idempotency

| Status | Meaning |
|---|---|
| `pending` | queued, not attempted (one open row per user; new reminders join it) |
| `processing` | handed to pg_net, waiting for the answer |
| `retry` | temporary failure; `next_attempt_at` = +5, 10, 20, 40 min |
| `sent` | Resend accepted it (`provider_message_id`) |
| `failed` | permanent 4xx, or 5 attempts used (`exhausted:<category>`) |
| `cancelled` | `preference_off`, `no_email`, `user_disabled`, `not_eligible`, `expired` |

Retry: 429, 409 (idempotency in progress), 5xx, timeout/network, no answer after 15 min
(stale recovery). Every attempt of a row uses `Idempotency-Key: kaidly-outbox-<id>`, so a
retry after a lost answer cannot produce a second e-mail at Resend (24 h window). A
notification can belong to one outbox row only (`email_outbox_items` primary key). Two
processors never run at once (advisory lock; `FOR UPDATE SKIP LOCKED` as well).

Logs (Postgres log, Supabase → Logs → Postgres): `kaidly email: outbox <id> sent|retry|failed|
cancelled (attempt n, category)` — no addresses, no content, never the key.

## 6. Turning sending on (Production) — MANUAL

Sending is **off** after the migration: `private.email_settings.enabled = false` and no key.

1. Resend → API Keys → create a key with **Sending access** only, domain `kaidly.ee`.
   In Resend → Domains → kaidly.ee: **Click tracking OFF, Open tracking OFF**.
2. Supabase (Production `xakpbtmksxvjmsbipwmj`) → **Integrations → Vault → Add new secret** (older dashboards: Project Settings → Vault):
   name `RESEND_API_KEY`, value = the key. (Never in git, env files or chat.)
3. Supabase → SQL Editor:
   ```sql
   update private.email_settings set enabled = true;
   ```
4. Test with your own account only (complete, validated SQL: `docs/PRODUCTION_EMAIL_TEST.sql`;
   done 2026-10-06 — delivered, outbox `sent` with a provider message id, kept as evidence): turn your preference on, give yourself an activity due
   within its first threshold in the test company (e.g. due in 3 days, reminder 7) — the
   in-app reminder appears immediately and the e-mail within 5 minutes. Check:
   ```sql
   select status, attempt_count, last_error, provider_message_id, locale, created_at, sent_at
     from private.email_outbox order by created_at desc limit 20;
   ```
   Resend → Emails: from `KAIDLY <notifications@kaidly.ee>`, the subject above, link to
   `https://kaidly.ee/teavitused`, no tracking.

## 7. Operating

```sql
-- health: counts per status in the last day
select status, last_error, count(*) from private.email_outbox
 where created_at > now() - interval '1 day' group by 1, 2 order by 1;
-- failed recently
select id, attempt_count, last_error, updated_at from private.email_outbox
 where status = 'failed' order by updated_at desc limit 50;
-- disable sending at once (queue keeps filling; backlog older than 2 days is dropped)
update private.email_settings set enabled = false;
-- retry one failed row deliberately (same idempotency key)
update private.email_outbox set status = 'retry', next_attempt_at = now(), attempt_count = 0
 where id = '<id>';
```
A wrong/revoked key gives `failed:provider_401`/`403` — replace the Vault secret, then retry.

## 8. Testing without real e-mail

Local stack, CI and the development project never send: no Vault key, `enabled = false`.
pgTAP enables sending inside a rolled-back transaction with an unreachable URL
(`http://127.0.0.1:9/...`) and fake provider answers in `net._http_response`; nothing is
committed, so pg_net never sends. Preview: `node scripts/email-templates.mjs --preview` →
`.email-preview/app-deadline_reminder.<et|en|ru>.html|.txt`.

## 9. Volume (local, 100 companies, 501 users, 15,057 activities)

A daily run creating 30,036 reminders for 410 users: 2.4 s including the e-mail enqueue
(0.7 s without; the first, per-row trigger took 6.0 s and was replaced by a set-based
statement trigger). Claim query (index `email_outbox_due_idx`) 12 ms for a 500-row batch;
dispatching 410 e-mails 121 ms; reconcile via `email_outbox_processing_idx` < 1 ms.

## 10. Residual risk

pg_net keeps the outgoing request (including the `Authorization` header) in
`net.http_request_queue` until its worker sends it (normally well under a second). That table
is owned by Supabase (`supabase_admin`) and granted to PUBLIC by the extension; the `net`
schema is **not** exposed through the Data API, so browser/API roles cannot reach it (E2E
`security-api` checks this). Anyone with SQL access to the database could also read Vault.
