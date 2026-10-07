# KAIDLY v1.0.0 — Release checklist

The item-by-item launch gate, reconciled with the verified state on **2026-10-07**.
Summary for humans: [LAUNCH_STATUS.md](LAUNCH_STATUS.md). How to release:
[RELEASE_RUNBOOK.md](RELEASE_RUNBOOK.md). Runbooks: [DEPLOYMENT.md](DEPLOYMENT.md),
[PRODUCTION_BACKUP_RECOVERY.md](PRODUCTION_BACKUP_RECOVERY.md),
[RECOVERY_RUNBOOK.md](RECOVERY_RUNBOOK.md), [SUPPORT_RUNBOOK.md](SUPPORT_RUNBOOK.md),
[PRIVACY_PROCESS.md](PRIVACY_PROCESS.md).

Status legend: **GREEN** done and verified · **MANUAL** needs the owner · **EXCEPTION** known
limitation accepted for now · **LAUNCH BLOCKER** blocks the public commercial launch.

| | |
|---|---|
| DEVELOPMENT | `gdpzavhkblbcxivoaqax` (Preview, feature branches, local `npm run dev`) |
| PRODUCTION | `xakpbtmksxvjmsbipwmj` — note "**msbi**", eu-west-1 (Ireland) |
| Domain | `https://kaidly.ee` (canonical); `www.kaidly.ee` and `http://` → 308 → `https://kaidly.ee` |
| Deployed commit | always `https://kaidly.ee/api/health` → `version` |
| Release | v1.0.0 — tagged only when the launch blockers below are resolved |

## Summary

KAIDLY is technically complete and runs on kaidly.ee as a **controlled pre-launch** (owner
decision 2026-10-03: complete → test → dogfood/beta → public launch). The remaining blockers
are legal (operator entity, final privacy/terms) and the owner's manual checks; none of them
blocks engineering, QA or Preview work.

## APPLICATION
| Status | Item |
|---|---|
| GREEN | All modules: companies, sites, installations, käidupäevik, käidukava with reminders, puudused, documents/photos, notifications, search, PDF/CSV reports, CSV import, Platform Admin |
| GREEN | Plans Start / Team / Pro / Business / Custom with database-enforced user and active-installation limits (SUBSCRIPTIONS.md); customers see plan and usage only |
| GREEN | Personal 14-day trial (one per user; 1 user, 5 active installations; deleting a company never resets it) |
| GREEN | Public header: left logo + "Kuidas töötab?" + "Hinnakiri", right "Logi sisse" + "Registreeru" + language; section links never leave `#…` in the URL |
| GREEN | Error pages (translated `error.tsx`, trilingual `global-error.tsx`, 404 also for unknown public URLs); no SQL, stack traces, keys or provider messages to users |
| GREEN | Upload abuse limits (database-enforced), messages ET/EN/RU |
| GREEN | Account deletion request on /konto (validated mailto; plain text when no usable address) |

## DATABASE
| Status | Item |
|---|---|
| GREEN | Separate Production project, built from zero from the migrations; no development data copied, no seed |
| GREEN | 26 migrations, latest `20261007100000_subscription_plans`. Development verified 2026-10-07; Production migrated in the 2026-10-06/07 releases (re-check with `migration list` at the next Production DB step) |
| GREEN | Flow: Development first → dry-run → Production (backup first) → CLI relinked to Development at once (RELEASE_RUNBOOK.md §3–4); `npm run db:target` labels the link |
| GREEN | pgTAP suite pins tables, definer functions and callable RPCs (`000_security_baseline`); every table change ships with role-matrix and cross-tenant tests |
| GREEN | Supabase's own `ensure_rls` / `rls_auto_enable()` reviewed and kept |

## AUTH AND E-MAIL
| Status | Item |
|---|---|
| GREEN | Auth Site URL `https://kaidly.ee`; Redirect URLs only `https://kaidly.ee/**` |
| GREEN | Custom SMTP: Resend, sender `KAIDLY <no-reply@kaidly.ee>` (SPF/DKIM/DMARC on kaidly.ee) |
| GREEN | KAIDLY Auth templates and security notifications installed (EMAIL_TEMPLATES.md §6); confirmation, recovery, e-mail change and password-changed mails verified |
| GREEN | **Secure password change ON** after a real reauthentication-code test |
| GREEN | Deadline reminder e-mails live: Vault secret `RESEND_API_KEY`, `private.email_settings.enabled = true`, sender `notifications@kaidly.ee`, tracking off; first real mail delivered 2026-10-06 (EMAIL_NOTIFICATIONS.md) |
| GREEN | App redirect allowlist and open-redirect tests; sign-out / revocation / disabled accounts end data access on the next request |
| RELEASE CHECK | Every release: trigger one Production Auth e-mail and visually confirm the KAIDLY template (EMAIL_TEMPLATES.md "Regression guard"; MANUAL_SMOKE_TEST.md §3) |
| MANUAL | Mailbox behind `KAIDLY_CONTACT_EMAIL` (`info@kaidly.ee`) — confirm it receives mail |

## STORAGE
| Status | Item |
|---|---|
| GREEN | One private bucket `documents`, 25 MB, MIME allowlist, tenant-scoped policies, signed URLs (60 s) only |

## SECURITY
| Status | Item |
|---|---|
| GREEN | Headers: CSP (only this origin + the build's Supabase project), HSTS, nosniff, `X-Frame-Options: DENY` + `frame-ancestors 'none'`, Referrer-Policy, Permissions-Policy, no `X-Powered-By` |
| GREEN | Build guard: Production build only against the production ref; Preview never against it |
| GREEN | No service-role key in the app, scripts or env files; all user-callable SECURITY DEFINER functions pin `search_path=''` and check authorization; none executable by `anon` |
| GREEN | `npm audit --omit=dev`: 0 vulnerabilities (2026-10-07). Dev-only advisories (Tailwind 3 / ESLint toolchain: braces, postcss-selector-parser) do not reach the runtime; fixing needs the Tailwind 4 migration — EXCEPTION, revisit with the next planned upgrade |

## PRIVACY AND LEGAL
| Status | Item |
|---|---|
| GREEN | Manual privacy-request process (PRIVACY_PROCESS.md); no automatic deletion |
| GREEN | Essential cookies only; no analytics or tracking → no banner needed |
| LAUNCH BLOCKER | Legal operator facts missing (company not founded): legal name, registry code, address, privacy contact, effective date. Never invented; `/privaatsus` and `/kasutustingimused` stay pre-launch drafts (notice, `noindex`, not in the sitemap) until supplied and reviewed |
| LAUNCH BLOCKER | Final, reviewed privacy policy and terms; commercial paid launch legally cleared |
| EXCEPTION | Retention periods / automated erasure — open legal decision, not invented |

## DOMAIN, VERCEL, SEARCH
| Status | Item |
|---|---|
| GREEN | Production env: production Supabase URL and publishable key, `KAIDLY_SITE_URL=https://kaidly.ee`, `KAIDLY_CONTACT_EMAIL`; Preview env: development Supabase, no `KAIDLY_SITE_URL` → noindex everywhere |
| GREEN | Indexing only on Production with `KAIDLY_SITE_URL`: canonical `https://kaidly.ee`, OG/Twitter card, JSON-LD (no operator facts); app, auth, admin and draft legal pages `noindex` |
| GREEN | `robots.txt` allows `/`, `/privaatsus`, `/kasutustingimused`, disallows `/o`, `/admin`, `/konto`, `/auth`, `/invite`, `/otsing`, `/teavitused`, `/api`; `sitemap.xml` lists only `https://kaidly.ee/` while the legal pages are drafts |
| GREEN | Google Search Console (domain property) verified, sitemap accepted, homepage indexed (GOOGLE_SEARCH_SETUP.md) |
| GREEN | Bing Webmaster Tools configured; Live URL indexable; Site Scan reports only the intentional `/auth/login`, `/auth/sign-up` robots block — do not "fix" |

## OBSERVABILITY
| Status | Item |
|---|---|
| GREEN | `/api/health` (app/auth/storage/version, no keys, URLs or project refs) |
| GREEN | Structured server error logs with digest (`instrumentation.ts`); SUPPORT_RUNBOOK.md maps symptoms to checks |
| MANUAL | (optional) uptime monitor on `https://kaidly.ee/api/health` |

## BACKUP AND RECOVERY
| Status | Item |
|---|---|
| GREEN | Manual Production backups: `scripts/backup-database.sh` + `scripts/backup-storage.mjs` (database dump + Storage mirror), restore rehearsed locally (all tables, content fingerprints, sign-in, RLS, files); real Production backups taken |
| GREEN | Restore never targets Production (restore scripts write only locally / refuse the production ref; restore.sql refuses a database that already has users) |
| MANUAL | Weekly routine (+ before every Production migration), encrypted image, second off-site copy, quarterly restore rehearsal (PRODUCTION_BACKUP_RECOVERY.md §3) |
| EXCEPTION | Supabase itself keeps no backups for Production (no daily backups, PITR off) — worst case loses what was entered since the last manual backup; a paid plan with daily backups is the upgrade path (owner decision) |

## PLATFORM ADMIN
| Status | Item |
|---|---|
| GREEN | Database-backed (`private.platform_admins` by user id), bootstrapped 2026-10-03; company roles never grant it; non-admins get the ordinary 404 |
| GREEN | Tellimused: list, search/filter, plan detail, Custom, preview → confirm, history, internal note (admin only) |
| MANUAL | Visual smoke of `/admin` and Tellimused on kaidly.ee (MANUAL_SMOKE_TEST.md §4) |

## SMOKE TEST (Production)
| Status | Item |
|---|---|
| GREEN | Public part automated/verified at each release (landing, header, pricing, ET/EN/RU, headers, robots, sitemap, health, logs) |
| MANUAL | Signed-in part by Kenneth: MANUAL_SMOKE_TEST.md §2–§5 (fresh user, account security, platform admin, access) |
| MANUAL | Russian native terminology review (electrical professional) |

## ROLLBACK
| Status | Item |
|---|---|
| GREEN | DEPLOYMENT.md §7 / RELEASE_RUNBOOK.md §7: promote the previous deployment; database forward-only (additive migrations); emergency auth switches |
