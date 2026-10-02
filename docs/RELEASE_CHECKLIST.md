# KAIDLY v1.0.0 — Release checklist

The launch source of truth. `[x]` done and verified · `[ ]` open · **(you)** needs a manual
action by the owner (account, payment, DNS, legal facts, secrets). Runbooks:
[DEPLOYMENT.md](DEPLOYMENT.md), [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md),
[PRIVACY_PROCESS.md](PRIVACY_PROCESS.md).

**Release gate: RED — do not merge `main`.** Blockers are marked ⛔.

Environments: DEVELOPMENT `gdpzavhkblbcxivoaqax` · PRODUCTION `xakpbtmksxvjmsbipwmj` (state as of 2026-10-02)

## APPLICATION
- [x] Feature freeze; release baseline green on the feature branch (2026-10-02: 83 unit, 613 pgTAP, 144 E2E, build) — re-verified after the hardening changes (see IMPLEMENTATION_PLAN.md)
- [x] Error pages: translated `app/error.tsx`, trilingual `global-error.tsx`, 404; users never see SQL, stack traces or provider messages
- [x] Upload abuse protection active (database-enforced, DATABASE.md §5f)
- [x] Account deletion request in Konto (ET/EN/RU)
- [ ] Release version decided: **v1.0.0**; tag only after the production smoke test

## DATABASE
- [x] Production Supabase project created: `xakpbtmksxvjmsbipwmj` ("KAIDLY Production", eu-west-1)
- [ ] ⛔ **(you)** Plan with daily backups decided (BACKUP_RECOVERY.md)
- [x] Production verified empty (no migration history, tables, users, buckets); dry-run listed all 20 migrations in order, `seeds: []`; all 20 applied, no seed
- [x] Production catalog identical to a local build (17 tables with RLS flags, 2 security_invoker views, 80 functions, 41 triggers, 87 indexes, 32 policies, function grants, private `documents` bucket, pg_cron + pg_trgm, jobs `kaidly-activity-reminders 15 3 * * *` and `kaidly-upload-events-cleanup 40 3 * * *`); only extra object: Supabase's `ensure_rls` / `rls_auto_enable()`; 0 rows; anon refused, signed-in non-member sees nothing
- [x] CLI re-linked to development; `npm run db:target` shows the target
- [x] Migration history linear; all migrations forward-only and additive

## AUTH
- [ ] **(you)** Production Auth → URL Configuration: Site URL `https://kaidly.ee`; Redirect URLs only `https://kaidly.ee/**`; email templates from `supabase/templates/` (DEPLOYMENT.md §3.5)
- [x] App-side redirect allowlist (`safeRedirectPath`) and open-redirect tests pass
- [x] Flows covered by E2E: sign-up + confirmation, login, logout, forgot/reset, password change, email change, invitation, direct authenticated URL, disabled account, session revocation, ET/EN/RU
- [x] Revoked sessions / disabled accounts lose data access immediately (database check on every request)
- [ ] ⛔ **(you)** Kenneth's production account signed up and confirmed → bootstrap platform admin (DEPLOYMENT.md §3.7)

## EMAIL
- [x] Branded token_hash templates prepared (`supabase/templates/*.html`)
- [ ] Templates pasted into the production dashboard
- [ ] ⛔ **(you)** Custom SMTP provider + verified sender domain (`no-reply@kaidly.ee`); fields in DEPLOYMENT.md §5
- [x] `KAIDLY_CONTACT_EMAIL` set in Production (info@kaidly.ee); mailbox delivery to be confirmed in the smoke test

## STORAGE
- [x] One private bucket `documents`, 25 MB, MIME allowlist, tenant-scoped policies, signed URLs only (pgTAP baseline)
- [x] Verified in the production project after migration (private, 25 MB, MIME list, 3 policies)

## SECURITY
- [x] Security headers: CSP, HSTS, nosniff, X-Frame-Options DENY / frame-ancestors 'none', Referrer-Policy, Permissions-Policy; `X-Powered-By` off (E2E)
- [x] Secret audit: no service-role key, tokens, DB passwords or SMTP credentials in files, git history or build output
- [x] `npm audit --omit=dev`: 0 vulnerabilities; pdfmake/pdfkit server-only (not in client chunks)
- [ ] ⛔ **(you)** Vercel Production `NEXT_PUBLIC_SUPABASE_URL` has a typo (`…msblpwmj`, NXDOMAIN) — set it to `https://xakpbtmksxvjmsbipwmj.supabase.co`; the publishable key is correct (accepted by production, rejected by development)

## PRIVACY
- [x] Manual privacy-request process documented (export, erasure, account vs operating records)
- [x] Cookies: essential only (Supabase session, `kaidly_locale`, last company, guide hidden) + localStorage for shown reminder toasts; no analytics/tracking → no cookie banner needed
- [ ] ⛔ **(you)** Legal facts for Privaatsus / Kasutustingimused (`lib/legal/operator.ts`): operator legal name, registry code, address, privacy contact, effective date, production data region — then legal review and `approved: true`
- [ ] Retention periods / automated erasure — open legal decision (not invented)

## DOMAIN
- [x] `kaidly.ee` → Production in Vercel, DNS valid (owner-confirmed)
- [x] `www.kaidly.ee` → 308 → `kaidly.ee` (owner-confirmed; re-checked in the smoke test)
- [ ] HTTPS valid; HTTP → HTTPS

## VERCEL
- [x] Production tracks `main`; Preview = feature branches
- [x] Production publishable key and `KAIDLY_CONTACT_EMAIL` set; no development value in the Production scope
- [ ] ⛔ **(you)** Production `NEXT_PUBLIC_SUPABASE_URL` typo fixed (see SECURITY)
- [ ] **(you)** Production `KAIDLY_SITE_URL=https://kaidly.ee` added (canonical URLs, indexing)
- [x] Preview env: development Supabase, no `KAIDLY_SITE_URL` → noindex everywhere
- [x] Report PDFs: fonts traced with the export route; verified on a Vercel Preview

## OBSERVABILITY
- [x] `GET /api/health` (app/auth/storage/version, no secrets)
- [x] Structured server error logs (`instrumentation.ts`); Vercel runtime logs
- [ ] Uptime monitor on `/api/health` (optional, any provider)

## BACKUP/RECOVERY
- [x] Runbook and limitations documented (Storage files not in DB backups)
- [ ] ⛔ **(you)** Plan with daily backups (Pro) chosen for production; record retention/PITR (project is eu-west-1)

## PLATFORM ADMIN
- [x] Database-backed (`private.platform_admins` by user id); org roles never grant it
- [ ] Production bootstrap of kennethalto95@gmail.com + audit row + `/admin` verified
- [ ] Ordinary user denied `/admin` on production

## SMOKE TEST (production, on kaidly.ee; company named "KAIDLY Launch Test")
- [ ] Public: landing, language switch, title/metadata/canonical, favicon, privacy/terms
- [ ] Auth: sign-up/confirm, login, logout, password-reset email link on kaidly.ee, direct authenticated URL
- [ ] Customer: company → 14-day trial, site, installation, log entry, plan, deficiency, document, reminder/notification, search, PDF, CSV
- [ ] Admin: /admin, users, companies, deadlines, system, audit; trial extension/activation
- [ ] Security: non-admin denied /admin, cross-tenant 404, expired company read-only
- [ ] No 5xx; Vercel and Supabase logs clean
- [ ] Launch test data removed or (if it has history) deactivated and reported

## ROLLBACK
- [x] Procedure documented (DEPLOYMENT.md §7): promote previous deployment; forward-only database; no destructive restore
