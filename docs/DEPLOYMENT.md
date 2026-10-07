# KAIDLY — Deployment and production runbook

Companion to [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) (the launch source of truth) and
[BACKUP_RECOVERY.md](BACKUP_RECOVERY.md).

## 1. Environments — never shared

| Environment | Git | Vercel environment | Supabase project | Indexed |
|---|---|---|---|---|
| Local | any | `npm run dev:local` | local CLI stack (Docker) | no |
| **Development / Preview** | feature branches | Preview | **`gdpzavhkblbcxivoaqax`** ("kaidly", DEVELOPMENT ONLY) | no |
| **Production** | `main` | Production | **`xakpbtmksxvjmsbipwmj`** ("KAIDLY Production", eu-west-1 Ireland) | yes, only on the custom domain |

Production must never point at the development project, and the development project's data
(Preview users, test companies, audit rows) is never copied to production. Project refs are
configuration (environment variables), never hard-coded in application code.

> **Status 2026-10-07 — controlled pre-launch live on https://kaidly.ee:** 26 migrations
> (latest `20261007100000_subscription_plans`); Production deployed from `main` (`5b930a0`
> on 2026-10-07 — the deployed commit is always `/api/health` → `version`). Auth e-mail via
> custom SMTP (Resend), reminder e-mails on, Secure password change on, Google/Bing set up,
> manual backups taken. Not a public commercial launch; v1.0.0 not tagged
> (LAUNCH_STATUS.md). Releases: RELEASE_RUNBOOK.md.

Check which project the CLI targets before any `--linked` command: `npm run db:target`
(development is the default; production is linked only for a release step and re-linked
to development right after).

Supabase-managed objects present in production but not created by KAIDLY: the event
trigger `ensure_rls` with function `public.rls_auto_enable()` (Supabase's "enable RLS on new
tables" safeguard; an `event_trigger` function cannot be called through the API).

## 2. Environment variables

| Variable | Preview | Production | Kind | Purpose |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | required (development project URL) | required (**production** project URL) | config, public | Supabase API origin; also allowed in the CSP |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | required (development key) | required (**production** key) | config, public | publishable (anon) key; RLS protects data |
| `KAIDLY_SITE_URL` | **not set** | required: `https://kaidly.ee` | config | canonical URLs, Open Graph, sitemap; with `VERCEL_ENV=production` it switches indexing on |
| `KAIDLY_CONTACT_EMAIL` | optional (a test address) | required (real KAIDLY address, e.g. `info@kaidly.ee`) | config | "Soovin jätkata" and account-deletion request links (validated `mailto:`) |
| `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_GIT_COMMIT_SHA` | automatic | automatic | system | environment detection, health version |

No secret is needed by the application: there is **no service-role key** anywhere (platform
administration and background jobs run as reviewed database functions). Never add
`SUPABASE_SERVICE_ROLE_KEY` or any `NEXT_PUBLIC_*` secret.

Audit: `vercel env ls` (names/scopes); compare values without printing them:
`vercel env pull /tmp/x.env --environment=production` and check the URL contains the
production ref, then delete the file.

## 3. Production Supabase from zero (runbook)

0. **Build guard** (`lib/env-guard.ts`, run by `next.config.ts`): a Production build fails
   unless `NEXT_PUBLIC_SUPABASE_URL` is the production project; a Preview build fails if it
   is. Refs: development `gdpzavhkblbcxivoaqax`, production `xakpbtmksxvjmsbipwmj`.
1. Supabase Dashboard → **New project** → **EU region** (the existing Production project is
   eu-west-1 Ireland; development is eu-west-2 London), strong DB password stored in a
   password manager. Plan: see BACKUP_RECOVERY.md (a paid plan adds daily backups). For a
   recovery, the new project is filled from a backup (PRODUCTION_BACKUP_RECOVERY.md §5).
2. Record the ref in this file (§1) and RELEASE_CHECKLIST.md.
3. Link and dry-run — **check the ref twice, it must be PRODUCTION**:
   ```bash
   npx supabase link --project-ref <PRODUCTION_REF>
   npx supabase migration list --linked      # remote column must be empty
   npx supabase db push --dry-run            # lists every migration in order, no seed
   npx supabase db push                      # never --include-seed
   npx supabase link --project-ref gdpzavhkblbcxivoaqax   # re-link development afterwards
   ```
4. Verify (SQL editor or `npx supabase db query --linked`): 12 public tables with RLS,
   `private` schema tables (platform_admins, admin_audit_log, organisation_access,
   upload_limits, upload_events), views `log_entry_current` / `site_attention`
   (`security_invoker`), pg_cron jobs `kaidly-activity-reminders` (`15 3 * * *`) and
   `kaidly-upload-events-cleanup` (`40 3 * * *`), bucket `documents` private with 25 MB and
   the MIME list, the three storage policies. The pgTAP suite documents the expected state.
5. **Auth settings** (Dashboard → Authentication):
   - URL configuration: **Site URL `https://kaidly.ee`**; Redirect URLs **only**
     `https://kaidly.ee/**` (no wildcards for other hosts, no vercel.app).
   - Email confirmation on; minimum password length 10; secure email change on.
   - JWT expiry: default 3600 s is acceptable — data access is revoked immediately in the
     database (DATABASE.md §5f); the expiry only bounds how long an already signed-out
     device still *shows* an (empty) signed-in frame.
   - Email templates and security notifications: docs/EMAIL_TEMPLATES.md §6 (file → template
     mapping, subjects, which notifications to enable).
   - SMTP: see §5.
6. Vercel → Settings → Environment Variables → **Production** scope: replace both
   `NEXT_PUBLIC_SUPABASE_*` with the production values; add `KAIDLY_SITE_URL` and
   `KAIDLY_CONTACT_EMAIL`. Preview scope keeps the development values.
7. Platform admin bootstrap (after the account below exists and is confirmed):
   ```sql
   select count(*) from auth.users where lower(email) = 'kennethalto95@gmail.com' and email_confirmed_at is not null; -- must be 1
   select private.bootstrap_platform_admin('kennethalto95@gmail.com');
   select action from private.admin_audit_log order by id desc limit 1;                  -- platform_admin_granted
   ```

## 4. Domain

Intended: `kaidly.ee` canonical; `www.kaidly.ee` and (if owned) `kaidly.eu` → 308 redirect
to `kaidly.ee`. Vercel → Project → Settings → Domains → Add `kaidly.ee` (Production), then
add the redirecting domains with "Redirect to kaidly.ee". Use exactly the DNS records Vercel
shows (do not guess registrar values). Vercel serves HTTPS only and redirects HTTP; HSTS is
sent by the app.

## 5. Email delivery

Two senders, both through Resend with the verified domain `kaidly.ee` (SPF, DKIM
`resend._domainkey`, DMARC; click/open tracking off):

| Mail | Sent by | Sender | Configuration |
|---|---|---|---|
| Auth: confirmation, recovery, e-mail change, reauthentication code, security notices | Supabase Auth over **custom SMTP** (Authentication → SMTP Settings) | `KAIDLY <no-reply@kaidly.ee>` | host `smtp.resend.com`; password = Resend key (dashboard only). Templates: EMAIL_TEMPLATES.md §6 |
| Optional deadline reminder | Database outbox → Resend API (pg_net, cron every 5 min) | `KAIDLY <notifications@kaidly.ee>` | Vault secret `RESEND_API_KEY`, `private.email_settings.enabled` (EMAIL_NOTIFICATIONS.md §6) |

The application server sends no e-mail and holds no e-mail secret; invitations are copyable
links. Supabase's built-in sender (rate-limited, team addresses only) must never be the
Production sender again — the release smoke checks the KAIDLY template.

## 5a. Pre-launch drafts

Until the operating company exists (operator facts TBA, owner decision 2026-10-03) the legal
pages are pre-launch drafts (noindex, out of the sitemap; `lib/legal/operator.ts`). The
sitemap adds them automatically once `legalReady()` is true (all operator facts present).

## 6. Health and logs

- `GET /api/health` → `{ app, auth, storage, version }` with 200/503; no keys or URLs. Use it
  for uptime monitoring.
- Server errors: one JSON line per error (`instrumentation.ts`, `event: request_error`) in
  Vercel → Logs; no headers, cookies, bodies or query strings are logged. Error pages show
  only a short digest.
- Optional later: an external error tracker (e.g. Sentry) needs an account and DSN — not
  required for launch.

## 7. Rollback

- **Application:** Vercel → Deployments → the previous good Production deployment →
  "Promote to Production" (instant; the domain stays attached).
- **Database:** migrations are forward-only. Everything shipped so far is additive
  (new tables, columns with defaults, functions, policies); an older app version keeps
  working against the newer schema, so an app rollback never needs a database rollback.
  Never drop or restore the production database to undo a deploy — data written since
  would be lost. Fix forward with a new migration; restore from backup only for data loss
  (BACKUP_RECOVERY.md).
- **Configuration:** environment-variable changes need a redeploy; keep the previous values
  in the password manager until the new deploy is verified.
- **Domain:** stays attached to the Production environment during any of the above —
  promoting an older deployment changes what kaidly.ee serves, not the DNS.
- **Auth emergency** (e.g. abuse or an auth bug): Production → Authentication → Sign In /
  Providers → turn off "Allow new users to sign up" (existing users keep working);
  revoke a user's sessions or disable the account from `/admin/users/<id>` (database access
  ends on the next request); in the worst case promote a maintenance deployment or the
  previous good deployment. Never drop or restore the production database to "undo" an
  incident.
