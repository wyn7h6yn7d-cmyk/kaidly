# KAIDLY — Launch status

One page: what is done, what still needs Kenneth, and what is legally open. Updated
**2026-10-07**. Details: [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) (item by item),
[RELEASE_RUNBOOK.md](RELEASE_RUNBOOK.md) (how to release), [SUPPORT_RUNBOOK.md](SUPPORT_RUNBOOK.md)
(when a user reports a problem). This document is not legal advice.

**State in one line:** technically complete and live as a controlled pre-launch on
https://kaidly.ee; not yet a public commercial launch; **v1.0.0 is not tagged**.

## Technical — done

| Area | State |
|---|---|
| Deployed | Production serves `main` from https://kaidly.ee (`/api/health` → `version` shows the commit). Last Production deploy: `5b930a0` (2026-10-07). Newer commits on `main` not yet deployed: see `git log origin/main..main` |
| Healthy | `/api/health` app / auth / storage `ok`; no 5xx in the Production logs after the last deploy |
| Database | 27 migrations (latest `20261008100000_photo_links`). Applied to Development and Production on 2026-10-07; `migration list` showed all 26 earlier ones on Production before the push, and the Production backup (`20261007T180615Z`) and Storage mirror were taken first. Flow: Development first, dry-run, then Production (RELEASE_RUNBOOK.md) |
| Tested | Full verification on every release: lint, typecheck, unit (node --test), pgTAP database/RLS suite, full Playwright E2E (desktop + tablet + phone, ET/EN/RU, layout 320–1440 px, axe), plan/e-mail concurrency scripts, production build. Latest totals: IMPLEMENTATION_PLAN.md / the release commit |
| Product | All modules; plans Start / Team / Pro / Business / Custom (docs/SUBSCRIPTIONS.md); Platform Admin → Tellimused; personal 14-day trial (1 user, 5 active installations) |
| E-mail | Auth e-mails through custom SMTP (Resend, `no-reply@kaidly.ee`) with KAIDLY templates; security notifications (password / e-mail changed) on; **Secure password change ON**; optional deadline reminder e-mails live (Resend API, `notifications@kaidly.ee`, database outbox) |
| Search | Google Search Console (domain property) configured, sitemap accepted, homepage indexed. Bing Webmaster Tools configured; Live URL indexable; Site Scan reports only the intentional `robots.txt` block of `/auth/*` |
| Backups | Manual Production database + Storage backup tooling (`scripts/backup-database.sh`, `scripts/backup-storage.mjs`), restore rehearsed locally; real Production backups taken. Supabase itself keeps no backups (no PITR) — PRODUCTION_BACKUP_RECOVERY.md |
| Security | RLS on every tenant table, no service-role key anywhere, CSP/HSTS/frame denial, build guard against wrong Supabase project, `npm audit --omit=dev` 0 vulnerabilities (SECURITY_AUDIT.md) |

## Manual checks still required (Kenneth)

- [ ] **Signed-in Production smoke** — [MANUAL_SMOKE_TEST.md](MANUAL_SMOKE_TEST.md) sections
      *Fresh user*, *Account security*, *Access* (needs your password; automation has none).
- [ ] **Platform Admin visual smoke** on kaidly.ee — MANUAL_SMOKE_TEST.md *Platform admin*.
- [ ] **Russian native terminology review** by an electrical professional (UI strings in
      `lib/i18n/ru.ts`, the reminder e-mail and Auth templates in Russian). Not reviewed yet.
- [ ] **Weekly backup routine** running (every Monday + before each Production migration),
      stored in the encrypted image with a second off-site copy.
- [ ] Optional: uptime monitor on `https://kaidly.ee/api/health`.
- [ ] Working mailbox behind `KAIDLY_CONTACT_EMAIL` (`info@kaidly.ee`) — confirm a real
      message arrives (the app only builds a `mailto:` link).

## Legal — open (blocks the paid commercial launch)

- **Legal operator details are missing** (the operating company is not founded yet): legal
  name, registry code, address, privacy contact, effective date. Never invented in the code
  (`lib/legal/operator.ts`).
- **Privacy policy and Terms are not final.** `/privaatsus` and `/kasutustingimused` are
  pre-launch drafts with a visible notice, `noindex` and outside the sitemap until the
  operator facts are supplied and the texts are reviewed.
- Retention periods / automated erasure: an open legal decision (manual process in
  PRIVACY_PROCESS.md).
- **The commercial paid launch is not legally cleared yet.** Invoicing customers needs the
  operator entity and the final terms. Until then: controlled testing / beta only.

## Not planned for v1 (by decision)

Online payments, analytics/tracking, AI features, integrations — see PRODUCT.md.
