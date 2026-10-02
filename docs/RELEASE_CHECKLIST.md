# KAIDLY v1.0.0 — Release checklist

The launch source of truth, reconciled with the verified state on **2026-10-02**.
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

**Gate (2026-10-03):** one BLOCKING item left — the production **backup decision** — plus the
owner's explicit acceptance (or resolution) of the EXCEPTIONS below. Then: merge `main`,
deploy, smoke test on kaidly.ee, tag v1.0.0.

## APPLICATION
| Status | Item |
|---|---|
| GREEN | Feature freeze; clean full verification on the feature branch (see IMPLEMENTATION_PLAN.md for the latest totals) |
| GREEN | Error pages (translated `error.tsx`, trilingual `global-error.tsx`, 404); no SQL, stack traces, keys or provider messages to users |
| GREEN | Upload abuse limits (database-enforced), user-facing message ET/EN/RU |
| GREEN | Account deletion request on /konto (validated mailto; plain text when no usable address) |
| GREEN | Landing: final hero background (static SVG, decorative, masked behind text), title `KAIDLY \| Elektripaigaldise käit lihtsalt`, favicon set |

## DATABASE
| Status | Item |
|---|---|
| GREEN | Separate production project; verified empty before migration; no development data copied |
| GREEN | Production built from zero: 20 migrations in order, no seed; catalog identical to a local build (17 tables with RLS, 2 views, 80 functions, 41 triggers, 87 indexes, 32 policies, private bucket + 3 policies, pg_cron + pg_trgm) |
| GREEN | Supabase's own `ensure_rls` / `rls_auto_enable()` reviewed and kept |
| GREEN | Upload-limit and session-check functions byte-identical in production and the repository |
| GREEN | Migration `20261002200000_session_guard_inserts` (live session required to create/join a company) applied to development and production after dry-runs; production now has all 21 migrations |
| GREEN | CLI default target is development; `npm run db:target` labels the linked project |

## AUTH
| Status | Item |
|---|---|
| GREEN | Production Auth Site URL `https://kaidly.ee`; Redirect URLs only `https://kaidly.ee/**` (owner-configured) |
| GREEN | App redirect allowlist and open-redirect tests |
| GREEN | Flows covered by E2E: sign-up/confirm, login, logout, forgot/reset, password change, email change, invitation, direct URL, disabled account, session revocation, ET/EN/RU |
| GREEN | Revoked sessions / disabled accounts: no company reads or writes from the next request on; cannot create or join companies either. What remains until the access token expires (≤ `jwt_expiry`, default 1 h): the signed-in frame and the user's own profile row |
| MANUAL REQUIRED | Paste `supabase/templates/{confirmation,recovery,email_change}.html` into Production → Authentication → Emails → Templates (validated by unit tests; installation not verifiable from here) |
| GREEN | Production account kennethalto95@gmail.com exists and is confirmed — the only production user, exactly one match (verified 2026-10-03) |

## EMAIL
| Status | Item |
|---|---|
| EXCEPTION | **Custom SMTP intentionally postponed.** Production uses Supabase's built-in sender, which only delivers to the project's team-member addresses and is rate-limited to a few emails per hour. Concretely: **sign-up confirmation** emails to customers will not arrive (customers can't confirm accounts — sign-up is effectively unavailable unless users are created/confirmed by an admin), **password reset** and **email change** emails to customers won't arrive. Invitations are unaffected (KAIDLY invitations are copyable links, no email). Fix: SMTP + verified sender (DEPLOYMENT.md §5) |
| MANUAL REQUIRED | Mailbox behind `KAIDLY_CONTACT_EMAIL` (`info@kaidly.ee`) — the app only builds the mailto link; whether mail arrives is operational |

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
| MANUAL REQUIRED | Legal facts in `lib/legal/operator.ts`: **operator legal name, registry code, legal/contact address, privacy contact email, effective date** (data region already filled: EU, Ireland). Then legal review and `approved: true`. Until then both pages show a draft notice, replace fact-dependent paragraphs with "published before launch", are `noindex` and out of the sitemap |
| EXCEPTION | Retention periods / automated erasure — open legal decision, not invented |

## DOMAIN / VERCEL
| Status | Item |
|---|---|
| GREEN | `kaidly.ee` → Production; `www.kaidly.ee` → 308 → `kaidly.ee`; both "Valid Configuration" (owner-confirmed) |
| GREEN | Production env: production Supabase URL (typo fixed by owner) and publishable key, `KAIDLY_SITE_URL=https://kaidly.ee`, `KAIDLY_CONTACT_EMAIL` |
| GREEN | Preview env: development Supabase, no `KAIDLY_SITE_URL` → noindex everywhere |
| GREEN | Production build simulated locally with production settings: canonical `https://kaidly.ee`, sitemap/robots on kaidly.ee, app routes noindex, CSP production-only |
| NOT STARTED | Production redeploy from `main` (waits for the gate) |

## OBSERVABILITY
| Status | Item |
|---|---|
| GREEN | `/api/health` (app/auth/storage/version, no keys, URLs or project refs) |
| GREEN | Structured server error logs (`instrumentation.ts`) |
| MANUAL REQUIRED | (optional) uptime monitor on `https://kaidly.ee/api/health` |

## BACKUP/RECOVERY
| Status | Item |
|---|---|
| **BLOCKING** | Production has **no restorable backups** (verified: backups list empty, PITR off). Decide: upgrade to a plan with daily backups (Pro), or explicitly accept launching without backups |
| EXCEPTION | Storage files are not in database backups; no file backup job yet |

## PLATFORM ADMIN
| Status | Item |
|---|---|
| GREEN | Database-backed (`private.platform_admins` by user id); company roles never grant it |
| GREEN | Bootstrapped 2026-10-03 via `private.bootstrap_platform_admin` (exact user id; 1 active platform admin; audit `platform_admin_granted` targeting that id, `{"via": "bootstrap"}`; no company memberships). Database check as that user: `am_platform_admin` true, admin overview/system/access/audit readable, normal RLS shows no companies |
| NOT STARTED | `/admin` in the browser on kaidly.ee and a non-admin denied — part of the production smoke test |

## SMOKE TEST (production, kaidly.ee, company "KAIDLY Launch Test") — NOT STARTED
Public pages, language switch, metadata/canonical, favicon, privacy/terms · login, logout,
direct authenticated URL (password reset only once SMTP works) · company/trial, site,
installation, log, plan, deficiency, document, notification, search, PDF, CSV · /admin pages ·
non-admin denied /admin, cross-tenant 404, expired company read-only · no 5xx, logs clean ·
remove or (with history) deactivate the test company.

## ROLLBACK
| Status | Item |
|---|---|
| GREEN | DEPLOYMENT.md §7: promote previous deployment; forward-only database; emergency auth switches |
