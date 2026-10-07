# KAIDLY — Cross-browser and operational readiness

Date: 2026-10-05 · start `b50a9a3` · 24 migrations (local = Development = Production).

> **Historical report (2026-10-05).** Kept as the record of that pass. Its §11–§13 lists are
> superseded: SMTP, Secure password change, reminder e-mails and Production backups have since
> been done. Current state: [LAUNCH_STATUS.md](LAUNCH_STATUS.md) and
> [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md); support: [SUPPORT_RUNBOOK.md](SUPPORT_RUNBOOK.md).

## 1. Browsers

New `e2e/cross-browser.spec.ts` (`@cross-browser`): public pages (scroll-to-top, language
switch, password reveal), log entry, activity completion (datetime-local), deficiency with a
typed date (date input), PDF upload → signed open → download with `attachment`, report
CSV/PDF downloads (file names, content types), CSV import, search, notifications, admin.
`npm run test:e2e:browsers` adds Firefox, desktop WebKit (Safari engine) and mobile WebKit
(iPhone 13) projects; the default suite and CI stay Chromium-only.

| Engine | Result |
|---|---|
| Chromium (desktop) | 4/4 |
| WebKit desktop (Safari engine) | 4/4 |
| WebKit mobile (iPhone 13, 390×664) | 4/4 |
| Firefox 155 (Playwright 1.63) | **not runnable on this machine**: the bundled Firefox exits with "Could not find profile folder" on macOS 27 for any profile path (sandboxed or not) — a tooling/OS incompatibility, not a KAIDLY result. Run `npm run test:e2e:browsers` on CI/another OS to cover it. |

Bug found and fixed: a file chosen **before the page became interactive** (slow connection)
was silently ignored (React's change handler wasn't attached yet). The picker now adopts a
pre-selected file on mount; covered by the cross-browser upload test.

## 2. Mobile realities

Phones 320–430 px (QA round 1 and this pass): no horizontal overflow, primary buttons tappable
above the bottom bar, date/datetime inputs work in mobile WebKit, uploads work.

## 3. Downloads and uploads

Reports: `attachment; filename="KAIDLY_…"` ASCII names, `text/csv`/`application/pdf`,
`nosniff`, `no-store`. Documents: 60 s signed URL after an access check; `?lae=1` forces
`attachment`; files are served from the Supabase origin (never as kaidly.ee content).
Invalid type, > 25 MB and long Unicode names give named, plain-language errors.

## 4. Missing files

A document whose file is missing in Storage (e.g. after a database-only restore) used to answer
an empty 404 page. Now the open link lands on the document page with "Faili ei õnnestunud
praegu avada…" (ET/EN/RU); foreign/unknown ids still show the ordinary "not found" (no
disclosure). E2E: documents spec (missing file, foreign id), security API suite.

## 5. Auth, sessions, multi-tab, network

Covered by existing suites: sign-out and revocation end data access on the next request
(pgTAP 170, E2E account/admin); a second tab after sign-out is redirected to login on the
next navigation; protected URLs after sign-out → 307 login; drafts cleared on sign-out; offline
save keeps the typed text and shows "Ühendus katkes…" (E2E mobile-workflows); idempotent
import token, double completion refused, document finalize idempotent (pgTAP).

## 6. Database rebuild and migrations

`supabase db reset` rebuilt the schema from zero many times in this work (24 migrations, 673
pgTAP assertions each time). Migrations need no business data (seed and fixtures are separate,
local only) and the two new ones are additive (same signatures; old app compatible), so the
database can be migrated before the application. Order and rollback: RELEASE_RUNBOOK.md.

## 7. Restore rehearsal (local)

Data dump → rebuild without seed → restore in one transaction: all counts identical, sign-in
with restored passwords, RLS and append-only log intact. Details, limits and Storage gap:
RECOVERY_RUNBOOK.md.

## 8. Cron, time and dates

Reminder job: ~40 ms over 15,000 activities, idempotent on rerun; jobs exist once
(03:15 reminders, 03:40 upload-counter cleanup). Tallinn business date verified across the
autumn 2026 and spring 2027 DST changes, both midnights and New Year (new unit tests); trial
expiry compares timestamps (no time-zone loophole).

## 9. Health and logs

`/api/health`: app/auth/storage with 4 s timeouts (never hangs; 503 on failure), commit,
nothing sensitive. Server errors: one JSON line with digest (shown to the user on error pages,
so a report can be matched to the log), route, method; no query strings, tokens, bodies;
invitation tokens redacted. Expected 401/403/404 are not logged as errors.
Uptime monitor (not configured — needs an account): `GET https://kaidly.ee/api/health` every
5 min, alert on non-200 or any field ≠ `ok`.

## 10. Documents

RELEASE_RUNBOOK.md (copy/paste release), RECOVERY_RUNBOOK.md (restore, Storage gap,
CLI mistakes, pre-customer requirements), MANUAL_SMOKE_TEST.md (~15 min checklist).

## 11. Before the first real customer (not complete)

- [ ] Production backups: first manual database + Storage backup taken and stored encrypted
      off-site (tooling and local restore rehearsal done 2026-10-06 — PRODUCTION_BACKUP_RECOVERY.md);
      weekly routine agreed; or a paid plan with daily backups
- [x] Storage file backup and a tested file restore (rehearsed locally)
- [ ] Custom SMTP (sign-up confirmation, password reset, e-mail change for customers)
- [ ] Working contact mailbox behind `KAIDLY_CONTACT_EMAIL`
- [ ] Legal operator details; final privacy policy and terms (reviewed)
- [ ] Supabase "Secure password change" enabled (needs SMTP)
- [ ] Production manual smoke test (MANUAL_SMOKE_TEST.md) by Kenneth
- [ ] Named responsibility for recovery
- [ ] Reminder e-mails: Vault secret `RESEND_API_KEY`, `private.email_settings.enabled = true`,
      one controlled real e-mail (EMAIL_NOTIFICATIONS.md §6) — until then reminders are in-app only
- [ ] Hosted Auth templates pasted (EMAIL_TEMPLATES.md §6) and Secure password change ON after a
      real reauthentication code test

## 12. Verification

| | |
|---|---|
| Unit | 106 passed (new: DST/year-end) |
| Database (pgTAP) | 673 passed (21 files) |
| E2E (Chromium, 2 workers) | 191 passed |
| Cross-browser (`@cross-browser`) | 12 passed: Chromium 4, WebKit 4, mobile WebKit 4; Firefox not runnable on this macOS 27 machine |
| Lint, typecheck, build | pass |
| Migrations in this pass | none |

## 13. Readiness

- **Ready for Kenneth's hands-on testing: YES.**
- **Ready for real customer data: NO** — Production has no restorable backups and no
  Storage file backup (§11, RECOVERY_RUNBOOK.md §5).
- **Ready for public commercial launch: NO** — in addition: custom SMTP for customer
  sign-up/password e-mails, a working contact mailbox, legal operator details and final
  privacy policy/terms, Secure password change.
