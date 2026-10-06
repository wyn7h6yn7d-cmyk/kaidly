# KAIDLY v1.0.0 — Release checklist

The launch source of truth, reconciled with the verified state on **2026-10-03**.
Runbooks: [DEPLOYMENT.md](DEPLOYMENT.md), [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md),
[PRIVACY_PROCESS.md](PRIVACY_PROCESS.md).

Status legend: **GREEN** done and verified · **MANUAL REQUIRED** needs the owner ·
**EXCEPTION** known limitation, launch possible only if the owner explicitly accepts it ·
**BLOCKING** must be resolved before `main` is merged / Production is deployed ·
**NOT STARTED** happens during the launch itself.

| | |
|---|---|
| DEVELOPMENT | `gdpzavhkblbcxivoaqax` (Preview, feature branches) |
| PRODUCTION | `xakpbtmksxvjmsbipwmj` — note "**msbi**", eu-west-1 (Ireland) |
| Domain | `https://kaidly.ee` (canonical); `www.kaidly.ee` → 308 → `kaidly.ee` |
| Release | v1.0.0 — tag only after the production smoke test on kaidly.ee |

## Summary (owner decision 2026-10-03)

KAIDLY is to be made **technically and functionally complete first**, then tested extensively,
dogfooded in a controlled beta, and only then launched publicly. "Technically complete" is
**not** a public launch. Missing legal-entity facts, SMTP, the contact mailbox and backups
do **not** block engineering, QA, Preview or production-like testing; they block the
**public commercial launch with real customers**.

| Category | Items |
|---|---|
| **TECHNICALLY COMPLETE** | Core product (all modules), security hardening, production database built from zero (21 migrations), environment guard, CSP/headers, noindex/canonical, health, error handling, platform admin (bootstrapped in production 2026-10-03) |
| **TESTING** | Ongoing: extensive QA, bug/UX fixes, field/mobile usability, controlled beta/dogfooding, production-like smoke tests |
| **PRE-LAUNCH MANUAL** | Legal operator details — **TBA** (company not founded yet): legal name, registry code, address, privacy contact, effective date; then final privacy/terms text and review · Custom SMTP + verified sender (postponed) · Working mailbox behind `KAIDLY_CONTACT_EMAIL` · Production backup plan · Paste email templates into the dashboard · (optional) uptime monitor |
| **LAUNCH BLOCKER** (public launch only) | Legal operator facts + finalized, reviewed privacy/terms · Production backups resolved — or the risk explicitly accepted by the owner at launch time · Transactional email (SMTP) working for real users — or self-service sign-up deliberately limited · Production smoke test on kaidly.ee passed |

**Pre-launch test build deployed 2026-10-03** (owner-authorised controlled deployment, not a
public launch): `main` = `7d0ef41`, Vercel Production `dpl_B2WJfNHVP1RcjdKLjawjfBLEGHMK`
serves https://kaidly.ee; production database at all 22 migrations. **v1.0.0 is not tagged**
until the launch blockers are resolved. **Do not add real customer data until the backup
decision is resolved.**

## APPLICATION
| Status | Item |
|---|---|
| GREEN | Feature freeze; clean full verification on the feature branch (see IMPLEMENTATION_PLAN.md for the latest totals) |
| GREEN | Error pages (translated `error.tsx`, trilingual `global-error.tsx`, 404); no SQL, stack traces, keys or provider messages to users |
| GREEN | Upload abuse limits (database-enforced), user-facing message ET/EN/RU |
| GREEN | Account deletion request on /konto (validated mailto; plain text when no usable address) |
| GREEN | Landing: final hero background (static SVG, decorative, masked behind text), title `KAIDLY \| Elektripaigaldise digitaalne käidupäevik`, favicon set |

## DATABASE
| Status | Item |
|---|---|
| GREEN | Separate production project; verified empty before migration; no development data copied |
| GREEN | Production built from zero: 20 migrations in order, no seed; catalog identical to a local build (17 tables with RLS, 2 views, 80 functions, 41 triggers, 87 indexes, 32 policies, private bucket + 3 policies, pg_cron + pg_trgm) |
| GREEN | Supabase's own `ensure_rls` / `rls_auto_enable()` reviewed and kept |
| GREEN | Upload-limit and session-check functions byte-identical in production and the repository |
| GREEN | Migration `20261002200000_session_guard_inserts` (live session required to create/join a company) applied to development and production after dry-runs |
| GREEN | Migration `20261003100000_company_import` (CSV import) applied to development and production (2026-10-03) after dry-runs showing only that migration and no seed; production verified: 22 migrations, RLS on all 12 public tables, import function definer with pinned search_path, not executable by anon (also refused over the API), batch table private; CLI re-linked to development right after |
| GREEN | CLI default target is development; `npm run db:target` labels the linked project |

## AUTH
| Status | Item |
|---|---|
| GREEN | Production Auth Site URL `https://kaidly.ee`; Redirect URLs only `https://kaidly.ee/**` (owner-configured) |
| GREEN | App redirect allowlist and open-redirect tests |
| GREEN | Flows covered by E2E: sign-up/confirm, login, logout, forgot/reset, password change, email change, invitation, direct URL, disabled account, session revocation, ET/EN/RU |
| GREEN | Revoked sessions / disabled accounts: no company reads or writes from the next request on; cannot create or join companies either. What remains until the access token expires (≤ `jwt_expiry`, default 1 h): the signed-in frame and the user's own profile row |
| PRE-LAUNCH MANUAL | Install the KAIDLY auth templates and security notifications in Production — mapping and test steps in docs/EMAIL_TEMPLATES.md §6 (validated by unit tests and locally against real Supabase Auth; installation not verifiable from here) |
| GREEN | Production account kennethalto95@gmail.com exists and is confirmed — the only production user, exactly one match (verified 2026-10-03) |

## EMAIL
| Status | Item |
|---|---|
| PRE-LAUNCH MANUAL | **Custom SMTP intentionally postponed** (real-user readiness item, not a development blocker). Production uses Supabase's built-in sender, which only delivers to the project's team-member addresses and is rate-limited to a few emails per hour. Concretely: **sign-up confirmation** emails to customers will not arrive (customers can't confirm accounts — sign-up is effectively unavailable unless users are created/confirmed by an admin), **password reset** and **email change** emails to customers won't arrive. Invitations are unaffected (KAIDLY invitations are copyable links, no email). Fix: SMTP + verified sender (DEPLOYMENT.md §5) |
| PRE-LAUNCH MANUAL | Mailbox behind `KAIDLY_CONTACT_EMAIL` (`info@kaidly.ee`) — not assumed to work; the app only builds a validated mailto link (safe fallback text without a usable address) |

| RELEASE CHECK | Trigger a Production Auth e-mail and visually confirm the KAIDLY-branded template (docs/EMAIL_TEMPLATES.md "Regression guard") |
| PRE-LAUNCH MANUAL | Deadline reminder e-mails: Vault secret `RESEND_API_KEY` + `update private.email_settings set enabled = true` (docs/EMAIL_NOTIFICATIONS.md §6); until then reminders are in-app only |
| PRE-LAUNCH MANUAL | Secure password change ON after one real reauthentication code test (docs/EMAIL_TEMPLATES.md §6) |

## STORAGE
| Status | Item |
|---|---|
| GREEN | One private bucket `documents`, 25 MB, MIME allowlist, tenant-scoped policies, signed URLs only — verified in production |

## SECURITY
| Status | Item |
|---|---|
| GREEN | Headers: CSP (derived per build from `NEXT_PUBLIC_SUPABASE_URL` — production build allows only `xakpbtmksxvjmsbipwmj.supabase.co`, Preview only development), HSTS, nosniff, `X-Frame-Options: DENY` + `frame-ancestors 'none'`, Referrer-Policy, Permissions-Policy, no `X-Powered-By` |
| GREEN | Build guard: a Production build fails if it targets development (or anything but the production ref); a Preview build fails if it targets production |
| GREEN | Database audit: all 36 user-callable SECURITY DEFINER functions pin `search_path=''`, check authorization explicitly, none executable by `anon` |
| GREEN | Secret audit (files, git history, build output): nothing found |
| GREEN | `npm audit --omit=dev`: 0 vulnerabilities; pdfmake/pdfkit server-only |

## PRIVACY
| Status | Item |
|---|---|
| GREEN | Manual privacy-request process (PRIVACY_PROCESS.md); no automatic deletion |
| GREEN | Cookies: essential only; no tracking → no banner needed |
| PRE-LAUNCH MANUAL | Legal operator facts are **TBA** — the operating company does not exist yet (owner decision 2026-10-03): legal name TBA, registry code TBA, legal/business address TBA, final privacy contact TBA, effective date TBA (data region known: EU, Ireland). Not a development blocker; a public-launch blocker. Until supplied and reviewed, `/privaatsus` and `/kasutustingimused` are pre-launch drafts: restrained notice ("… täiendatakse enne teenuse avalikku käivitamist"), fact-dependent paragraphs say "published before launch", `noindex`, excluded from the sitemap, no invented facts and no "TBA" text on the pages |
| EXCEPTION | Retention periods / automated erasure — open legal decision, not invented |

## DOMAIN / VERCEL
| Status | Item |
|---|---|
| GREEN | `kaidly.ee` → Production; `www.kaidly.ee` → 308 → `kaidly.ee`; both "Valid Configuration" (owner-confirmed) |
| GREEN | Production env: production Supabase URL (typo fixed by owner) and publishable key, `KAIDLY_SITE_URL=https://kaidly.ee`, `KAIDLY_CONTACT_EMAIL` |
| GREEN | Preview env: development Supabase, no `KAIDLY_SITE_URL` → noindex everywhere |
| GREEN | Production build simulated locally with production settings: canonical `https://kaidly.ee`, sitemap/robots on kaidly.ee, app routes noindex, CSP production-only |
| GREEN | Production deployed from `main` `7d0ef41` (2026-10-03, pre-launch test build): `/api/health` app/auth/storage ok with version `7d0ef4175e67`; www and http → 308 → https://kaidly.ee; no runtime errors or 5xx in the logs |
| NOTE | The landing page is indexable on kaidly.ee (canonical, sitemap with `/` only); app, auth, admin and the draft legal pages are noindex. There is no separate pre-launch switch — accepted for the controlled test phase |

## OBSERVABILITY
| Status | Item |
|---|---|
| GREEN | `/api/health` (app/auth/storage/version, no keys, URLs or project refs) |
| GREEN | Structured server error logs (`instrumentation.ts`) |
| MANUAL REQUIRED | (optional) uptime monitor on `https://kaidly.ee/api/health` |

## BACKUP/RECOVERY
| Status | Item |
|---|---|
| PRE-LAUNCH MANUAL → LAUNCH BLOCKER | Production has **no restorable backups** (verified: backups list empty, PITR off). Does not block coding or testing; must be resolved (plan with daily backups) before real customer data is entrusted to production, unless the owner explicitly accepts the risk at launch time |
| EXCEPTION | Storage files are not in database backups; no file backup job yet |

## PLATFORM ADMIN
| Status | Item |
|---|---|
| GREEN | Database-backed (`private.platform_admins` by user id); company roles never grant it |
| GREEN | Bootstrapped 2026-10-03 via `private.bootstrap_platform_admin` (exact user id; 1 active platform admin; audit `platform_admin_granted` targeting that id, `{"via": "bootstrap"}`; no company memberships). Database check as that user: `am_platform_admin` true, admin overview/system/access/audit readable, normal RLS shows no companies |
| MANUAL REQUIRED | `/admin` in the browser on kaidly.ee as Kenneth (needs his sign-in); a non-admin denied (covered by local/Preview tests; no extra production account was created) |

## SMOKE TEST (production, kaidly.ee)

**Automated 2026-10-03 — GREEN:** landing at 375/1440/1920 (hero grid, "Kuidas töötab"
anchor, reminder explanation, scroll-to-top, no overflow), ET/EN/RU, title, canonical,
favicon, robots/sitemap, privacy/terms draft notice + noindex, login/sign-up/forgot-password
render in three languages, password-reset submit shows the neutral confirmation (SMTP
limitation, no crash), security headers and production-only CSP, no console/CSP errors, no
5xx, health without secrets.

**Manual — Kenneth (no password available to automation; no auth bypass):** with company
"KAIDLY Prelaunch Test" (keep it minimal; deactivate afterwards if it has history):
Public pages, language switch, metadata/canonical, favicon, privacy/terms · login, logout,
direct authenticated URL (password reset only once SMTP works) · company/trial, site,
installation, log, plan, deficiency, document, notification, search, PDF, CSV, CSV import (Seaded → Andmete import, small template file) · /admin pages ·
non-admin denied /admin, cross-tenant 404, expired company read-only · no 5xx, logs clean ·
remove or (with history) deactivate the test company.

## ROLLBACK
| Status | Item |
|---|---|
| GREEN | DEPLOYMENT.md §7: promote previous deployment; forward-only database; emergency auth switches |
