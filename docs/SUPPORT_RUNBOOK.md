# KAIDLY — Support runbook

What to check when a user reports a problem. Production Supabase project
`xakpbtmksxvjmsbipwmj` (msbi), Development `gdpzavhkblbcxivoaqax`. No secret values here.

Ground rules:

- **Look first in `/admin`** (Platform Admin, your own account). It shows metadata only —
  no document or log content, no passwords. Every admin change is audited (`/admin/audit`).
- **SQL only read-only** unless a step below says otherwise, in Supabase → SQL Editor of the
  **Production** project (check the project name in the header). Never `db reset`, never
  `--linked` against Production from the CLI except for a release step (RELEASE_RUNBOOK.md).
- Never ask for, view or set a user's password; no impersonation. Ask the user for the
  **error digest** shown on the error page (a short code) and the time — it matches the log line.
- Do not copy customer content (log entries, documents) into tickets, chats or e-mails.

## 1. Where to look

| What | Where |
|---|---|
| Is the service up, which commit runs | `https://kaidly.ee/api/health` → `app`, `auth`, `storage` = `ok`, `version` = commit |
| Application errors | Vercel → Project → Logs (Production), or `npx vercel logs --environment production --since 1h --level error`; one JSON line per server error (`event: request_error`, digest, route, method — no query strings, tokens or bodies) |
| Auth (sign-up, sign-in, mails sent by Auth, rate limits) | Supabase → Logs → **Auth**; Authentication → Users (confirmed?, last sign-in, banned?) |
| Database errors, slow queries | Supabase → Logs → **Postgres** |
| Scheduled jobs | `select jobname, schedule, active from cron.job;` → `kaidly-activity-reminders` (03:15), `kaidly-upload-events-cleanup` (03:40), `kaidly-email-outbox` (every 5 min). Runs: `select jobid, status, return_message, start_time from cron.job_run_details order by start_time desc limit 20;` |
| Reminder e-mail outbox | `private.email_outbox` (status, attempts, `last_error`, `provider_message_id`) — EMAIL_NOTIFICATIONS.md §7 |
| Resend delivery | Resend → Emails: search by the `provider_message_id` from the outbox (reminders) or by recipient (Auth mails via SMTP) |
| Company access, plan, limits, usage | `/admin/tellimused` → company (status, plan, users x / y, installations x / y, trial end, paid until, history) |
| A user's companies, sessions, disabled state | `/admin/users` → user |
| Personal trial | `select started_at, ends_at, first_organisation_id from private.user_trials where user_id = '<user id>';` |
| Upload limits | `private.upload_limits`, `private.upload_events` (per-user counters) |
| Admin actions taken | `/admin/audit` |

Look up a user id by e-mail (read-only): `select id, email_confirmed_at, last_sign_in_at, banned_until from auth.users where lower(email) = lower('<address>');`

## 2. Symptom → check → safe action

| Symptom | Check | Safe action |
|---|---|---|
| **Confirmation e-mail missing** after sign-up | Auth logs for the address (sent? rate limited? bounced?); Resend → Emails for the recipient; spam folder; Authentication → Users: does the user exist, `email_confirmed_at` empty? | Ask the user to check spam, then sign up again with the same address after a few minutes (Auth rate limits; there is no separate resend button). If SMTP fails for everyone: Authentication → SMTP settings, Resend domain status. Do not confirm accounts by hand unless you have verified the address belongs to the person |
| **Reminder e-mail missing** | User's preference on? (Konto → Teavitused; `public.notification_preferences`, no row = on); is there an in-app reminder for that activity (bell)? `private.email_outbox` rows for the user: `pending` / `retry` / `failed` + `last_error`; `private.email_settings.enabled`; `kaidly-email-outbox` job runs | E-mails only follow in-app reminders (never computed separately). `failed:provider_401/403` → Vault secret `RESEND_API_KEY` wrong/revoked → replace, then retry one row (EMAIL_NOTIFICATIONS.md §7). Reminders older than 2 days are dropped by design |
| **Password code not received** (Secure password change) | Auth logs: reauthentication mail sent? Resend → Emails for the recipient | Ask the user to wait 60 s and use "Saada uus kood", check spam. If Reauthentication mails fail for everyone: switch Secure password change **off** temporarily (Authentication → Providers → Email) — nothing else depends on it (EMAIL_TEMPLATES.md §6) |
| **Cannot invite a member** | `/admin/tellimused` → company: users x / y (members **plus open invitations** count); company status (expired/deactivated = read-only); inviter's role (owner/admin only) | Explain the seat count; an open invitation that is not needed can be revoked by the company (frees the seat at once). More seats = a plan change in Tellimused after the customer agrees and is invoiced |
| **Installation creation blocked** | Installations x / y (archived ones do not count); status | Archiving an installation frees a slot immediately; otherwise a plan change. Trial: 5 active installations |
| **Company unexpectedly read-only** | `/admin/tellimused` → status: `expired` (trial ended or paid period ended) or `deactivated`; paid-until date; history (who changed what) | If payment is agreed: activate/extend in Tellimused (**Vaata üle → Kinnita ja rakenda**). A new company by a user whose personal trial is used starts read-only by design (docs/SUBSCRIPTIONS.md §3) |
| **"My new company has no trial"** | `private.user_trials` for the user: `ends_at` in the past? | Explain: one 14-day trial per person; a second company shares the remaining time; deleting a company does not reset it. Extending is an admin decision (`/admin/tellimused` → trial extension) |
| **Subscription activation not reflected** | Tellimused history shows the change? Status `active`, paid-until correct? User reloaded the page / signed in again? | Status is derived on every request (no cache). If history lacks the change, it was not saved (a stale preview saves nothing) — repeat it |
| **Document won't open** | Error digest in Vercel logs; document page notice "Faili ei õnnestunud praegu avada…" = metadata exists but the file is missing in Storage; Storage health in `/api/health` | Missing file: check whether a restore happened (RECOVERY_RUNBOOK.md §3); `supabase/maintenance/storage_report.sql` lists DB ↔ Storage mismatches. Signed links last 60 s — reopening from the app gives a fresh one |
| **Upload refused** | Size (max 25 MB), type (PDF/DOCX/XLSX — **images are refused by design** since 2026-10-08), per-user upload limit (`private.upload_events`) | The message names the reason; limits are deliberate abuse protection. Photos: the user adds a *Fotode link* (folder/album, https) to the log entry or deficiency instead |
| **"Cannot delete an image"** | Role (operators: images on log entries/deficiencies; admins: general documents; viewers never); company read-only? Document page shows "Pilt kustutatud" + "Lõpeta kustutamine" = file removal unfinished; `storage_report.sql` query 4 | Ask the user to press "Lõpeta kustutamine". Never delete documents rows or Storage objects by hand; the trace row stays by design (DATABASE.md §5j) |
| **Storage filling up** | `storage_report.sql` query 5 (images that could still be deleted, per company), Supabase → Storage usage | Images can be deleted by the companies themselves; new images are no longer stored. Do not delete customer files on their behalf without a written request |
| **Report fails** (PDF/CSV) | Vercel logs for `/o/[org]/aruanded/…/eksport` with the digest; period with no rows gives an empty report, not an error | Narrow the period and retry; persistent errors with a digest → investigate the log line |
| **Cannot sign in** | Authentication → Users: confirmed? banned/disabled (`/admin/users`)? Auth logs (wrong password vs. rate limit) | Point to "Unustasid parooli?" — never reset passwords yourself. A disabled account is re-enabled only from `/admin/users` after deciding why it was disabled |
| **Invitation link "invalid"** | Invitation expired, revoked, already accepted, or opened with a different e-mail address | The company admin creates a new invitation (copyable link; KAIDLY sends no invitation e-mail) |
| **Error page with a digest** | Vercel logs: search the digest | Fix forward; if a release caused it: promote the previous deployment (DEPLOYMENT.md §7) |
| **Site down / health not ok** | `/api/health` which field fails; Vercel status; Supabase status page | `auth`/`storage` failing = Supabase side; `app` failing = deployment → promote the previous deployment |

## 3. Things support must not do

- No direct `update`/`delete` on customer tables to "fix" data — the operating log is
  append-only, deficiencies are never deleted, history is written by triggers. Data fixes are
  reviewed migrations or scripts (RECOVERY_RUNBOOK.md).
- No service-role key, ever; no copying Production data into Development.
- No viewing customer documents or log content "to help" — ask the user for what you need.
- Plan, limits, price, paid period: only through Tellimused (audited), never by SQL.
