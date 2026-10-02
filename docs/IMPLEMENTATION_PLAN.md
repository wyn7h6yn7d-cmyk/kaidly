# KAIDLY — Implementation plan

Status (2026-10-02): **Phases 1–8 implemented**, plus a layout system and refined public
site, ET/EN/RU localisation with a saved language preference, deficiency photos at
creation, tab drafts and network-failure handling, an admin change-history page, CI, and
security/accessibility/responsive regression coverage. Work is on branch
`phase-2-3-organisations-sites`; nothing is merged to `main`, no migration has been pushed
to a hosted project. **No further phase starts without explicit approval.**

Each phase ends with a deployable app and every check passing: `npm run lint`,
`typecheck`, `test`, `test:db`, `test:e2e`, `build`.

---

## Done

| Phase | Result | Reference |
|---|---|---|
| 1 Foundation | Clean starter, pinned dependencies, security fixes (redirect allowlist, error codes, fail-closed config), tokens, provisional logo, local Supabase, baseline tests | ARCHITECTURE.md §2 |
| 2 Authentication and organisations | Organisations, roles, members, hashed single-use invitation links, switcher, settings, account | DATABASE.md §4–7 |
| 3 Sites and installations | Sites, installations, archive, identifier unique per site; tabs with placeholders | DATABASE.md §4 |
| 4 Käidupäevik | Append-only log, corrections, organisation and installation logs with filters, mobile entry flow | DATABASE.md §6 |
| 5 Käidukava | One-time and recurring activities, anchored due dates, completion → log entry, derived states | DATABASE.md §8 |
| 6 Puudused | Deficiencies, open ⇄ in progress → resolved, resolution → log entry, never deleted | DATABASE.md §9 |
| 7 Dokumendid | One private bucket, pending → ready uploads verified in the database, immutable attachments on log entries and deficiencies, archivable general documents, photos from the phone with resize/progress/retry, documents pages, 60 s signed URLs | DATABASE.md §10, ARCHITECTURE.md §5 |
| 8 Ülevaade | "Mis vajab tähelepanu" dashboard on real tenant-scoped data, first-use checklist, installation status, quick entry | DATABASE.md §10a, DESIGN.md §5 |
| CI | GitHub Actions: verify, database, e2e against a local stack in the runner | ARCHITECTURE.md §10 |
| Design & language | Layout system, refined landing page, ET/EN/RU with profile preference, change history, deficiency photos at creation, tab drafts | DESIGN.md §5a/§9, ARCHITECTURE.md §6b/§6c |
| Accounts, company details, platform admin (2026-10-02) | Konto (email change, password change with current password, sign out other devices), company contact details editable by owners and admins, database-backed KAIDLY platform admin with `/admin` console, platform-wide deadlines, admin audit log — no service-role key | DATABASE.md §4/§5b, ARCHITECTURE.md §6d |
| Deadline countdowns and reminders (2026-10-02) | Shared countdown, per-activity reminder thresholds, idempotent reminder generation (pg_cron daily + on change), in-app notification centre, bell, toast | DATABASE.md §5c, ARCHITECTURE.md §6e |
| Trial and manual access (2026-10-02) | 14-day company trial, read-only expiry enforced in `org_ids()`, platform-admin activation/extension/expiry with audit, access banner, admin filters | DATABASE.md §5d, ARCHITECTURE.md §6f |
| Search and reports (2026-10-02) | Global search (RLS-invoker RPC, trigram indexes), report centre with six reports, preview, PDF (pdfmake) and CSV exports | DATABASE.md §5e, ARCHITECTURE.md §6g |
| Release candidate (2026-10-02) | Upload abuse limits, immediate session revocation, security headers, noindex/canonical, health + structured error logs, error pages, legal page structure, account deletion request, deployment/backup/privacy runbooks, release checklist | DATABASE.md §5f, ARCHITECTURE.md §6h, DEPLOYMENT.md, RELEASE_CHECKLIST.md |
| Tests | 631 pgTAP, 84 unit, E2E incl. layout (320–1440 px, 200 % text) and ET/EN/RU axe sweeps | DATABASE.md §11, ARCHITECTURE.md §10 |
| Reviews | Responsive (375/768/1440), accessibility (axe + keyboard), security regression (+ review gates), code quality; Phase 7–8: storage security, cross-tenant oracles, pagination | this file, "Review log" |

**Still not final for Phase 3:** the electrical-professional domain review (PRODUCT.md §8).

## Next phases (not started)

### Phase 9 — Field validation (recommended next)
Real-device pass (iOS Safari, Android Chrome: keyboard overlap, camera, slow network, large
text), native-speaker reviews (Estonian domain wording, Russian electrical terminology),
"Leidsin puuduse" from a log entry, licensed hero photography (D11), per-locale cached
public pages (performance debt, ARCHITECTURE.md §6), full offline entry if field tests
show it is needed.

### Phase 10 — Production readiness
Separate production Supabase project, push migrations, auth settings and Estonian email
templates, security headers (CSP, HSTS, frame-ancestors), rate limits and storage quotas
(sign-up, organisation creation, invitations, uploads per user/organisation), backups/PITR
incl. Storage, privacy (account deletion and data export policy), Supabase advisors clean,
branch protection requiring the CI jobs.

---

## Decisions

All decided 2026-10-01 unless noted.

| # | Decision | Outcome |
|---|---|---|
| D1 | Local database | Supabase CLI in any Docker-compatible runtime; reproducible migrations and automated security tests |
| D2 | Environments | `.env.local` = hosted **development** project; production is created before launch; nothing pushed yet |
| D3 | Operating log | Strictly append-only; corrections are new entries pointing at the original (flat, no chains), newest wins, original preserved |
| D4 | Invitations | Copyable links only; hashed, expiring, single-use tokens bound to email; no email provider |
| D5 | Permissions | DATABASE.md §5 — the matrix as implemented (operators may correct any entry; nobody deletes deficiencies) |
| D6 | Next due date | **Anchored to the schedule** (Phase 5 brief); late completion skips missed occurrences — replaces the earlier "from completion date" |
| D7 | URL language | Estonian segments, English code |
| D8 | Validation | `zod` on the server for every action |
| D9 | Document types | ~~PDF, JPEG, PNG, WebP, HEIC, DOCX, XLSX~~ — see D28 |
| D10 | Cache Components | Kept; tenant data is never cached; dev-only "instant" validation logs on `notFound()` are expected |
| D11 | Marketing photography | Real, licensed photos to be supplied; no stock |
| D12 | Sign-up | Open for now; revisit before launch |
| D13 | UI language | ~~Estonian only~~ — superseded by D37 |
| D14 | Tailwind | Stays on v3; no upgrades without a concrete reason |
| D15 | Agent instructions | `CLAUDE.md` only |
| D16–D21 | Brand, cover photos, states, logo, terminology, CTA | DESIGN.md |
| D22 | Installation identifier | Optional; unique within a site (case-insensitive) |
| D23 | Deficiency resolution | Final; recurring problem = new deficiency; never deleted |
| D24 | Completion history | The operating log is the completion history (no separate table) |
| D25 | Attachment immutability (Phase 7 brief) | Files on log entries and deficiencies are part of the record: never changed, replaced or deleted; replacements go on a correction entry; general documents are archived, never deleted |
| D26 | Attachment window (approved 2026-10-02) | For **24 hours** after a log entry is recorded, only its author may add **new** attachments; the entry and existing attachments stay immutable (no change, replacement or deletion); each attachment keeps its own upload time. After 24 hours, evidence goes on a correction entry. Deficiencies accept files until resolved. |
| D27 | Completed activities | Completion files attach to the completion's log entry; no separate link from documents to activities |
| D28 | Document types (approved 2026-10-02) | PDF, JPEG, PNG, WebP, DOCX, XLSX; **HEIC stays unsupported for MVP** (replaces D9); mobile photo uploads may keep normalising to JPEG on the device; no SVG; 25 MB |
| D29 | Orphaned uploads | No background worker: the client cleans up its own failures; a read-only report (`supabase/maintenance/storage_report.sql`) lists leftovers for manual review |
| D30 | Viewing files | Route handler checks access and redirects to a 60-second signed URL; nothing pre-signed in lists |
| D31 | Dashboard | Real counts only, no charts; one `security_invoker` view for per-site counts |
| D32 | Document deletion (2026-10-02) | No normal hard deletion of historical evidence; general documents archive/restore; attachments immutable. Privacy erasure = future dedicated admin workflow (launch requirement) |
| D33 | Retention (2026-10-02) | No hardcoded legal retention periods, no automatic deletion |
| D34 | Viewer access (2026-10-02) | Read permission on a document includes opening/downloading the file |
| D37 | Languages (2026-10-02) | Estonian (default), English, Russian; typed dictionaries with identical keys; stable routes (no locale in URLs); cookie for visitors, `profiles.preferred_locale` for signed-in users (profile wins after sign-in) |
| D38 | Drafts (2026-10-02) | Unsaved entry/deficiency text kept in sessionStorage per tab, not localStorage (shared devices); no offline queue yet |
| D39 | Change history (2026-10-02) | Read-only page for owners/admins over `activity_history`, allowlisted fields only, no new schema |
| D40 | Layout system (2026-10-02) | One public container, one app container (aligned to the navigation), fluid gutters, fluid type scale; enforced by `e2e/layout.spec.ts` |
| D42 | Onboarding (2026-10-02) | Checklist derived from real data (no progress table); only a per-browser "hidden" cookie; deficiencies optional |
| D43 | Organisation deletion (2026-10-02) | Owners only, typed-name confirmation in the database. Hard delete only without operational history (log entries, deficiencies, documents); otherwise deactivation (read-only via `org_ids`, restorable). User accounts are separate |
| D44 | Estonian term for the tenant (2026-10-02) | "Ettevõte" (owner's wording) replaces "organisatsioon" throughout the Estonian UI |
| D41 | Visual regression (2026-10-02) | Structural layout assertions plus screenshots attached for review; no pixel baselines (brittle across machines/fonts) |
| D35 | Upload quotas (2026-10-02) | Storage quotas and upload rate limits are a **production launch blocker**; no package/storage limits invented yet |
| D36 | Pricing (2026-10-02) | A **public pricing page** (Hinnad / Pricing) is required eventually: simple, high value, aggressively affordable vs. electrical/compliance software, aimed at small contractors and independent käidukorraldajad; normal plans publicly priced (no "contact sales"). Prices, plan, storage and feature limits are **not decided** — they follow separate Estonia/EU competitor research. No billing, Stripe or subscription logic until then |
| — | Out of scope | No AI, payments, IoT, ERP/EAM integrations, email infrastructure, analytics, notifications |

## Production launch blockers

Tracked in [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) (gate RED as of 2026-10-02). Resolved
in the release-candidate phase: upload quotas/rate limits (abuse protection, D35), session
revocation delay, security headers, Preview noindex. Still open, needing the owner: production
Supabase project + plan with backups, production env values in Vercel, SMTP + sender domain,
contact mailbox, kaidly.ee domain/DNS, legal operator facts + review, Kenneth's production
account. Still open as decisions: retention periods and automated privacy erasure (manual
process for launch: PRIVACY_PROCESS.md), Storage file backups, Russian and Estonian domain
wording reviews.

## Open questions (need a decision or domain review)

- Reminders: should a KAIDLY member be linkable as the responsible person (then only they, or they first, get reminders)? Should viewers be able to opt in? Per-organisation time zone if KAIDLY leaves Estonia. Email/push/digest channels and their consent rules.

1. Installation types, statuses and "responsible person" (käidukorraldaja?) — electrical professional review.
2. Which technical fields are needed (voltage level, main fuse, EIC code, inspection dates) — none added yet.
3. Late completion of periodic activities: is skipping missed occurrences right, or must each missed occurrence be recorded?
4. Should resolved deficiencies be re-openable, or is "new deficiency" the right model?
5. Log entry types and deficiency severity labels — professional review.
6. Retention: how long must records be kept, and what happens to an organisation's data when it leaves? (Organisation deletion is not implemented.)
7. ~~Documents attached to log entries: immutable or deletable?~~ Decided by the Phase 7 brief: immutable (D25).
8. ~~Attachment window~~ — decided: 24 hours (D26).
9. Retention and privacy erasure (decided 2026-10-02 for now): no hard deletion of operational evidence; general documents are archived/restored; **no automatic deletion and no hardcoded retention periods** — retention is a production/legal/domain decision. A dedicated, audited **privacy-erasure workflow** for legitimate personal-data deletion must exist **before production launch** (not designed yet).
10. Regulatory documents: which categories must be kept for which installations (e.g. *mõõteprotokoll*, *käidukava* as a document), and for how long? KAIDLY makes no compliance claim until reviewed.
11. ~~Viewer downloads~~ — decided: a viewer who may read a document may open and download it; no "view but not download" pseudo-security. Sensitive documents, if needed later, get real visibility permissions.

## Risks

| Risk | Mitigation |
|---|---|
| RLS mistake leaks data between customers | Composite FKs, single helper, default-deny privileges, baseline review gates, pgTAP matrix per table, mutation testing, no service-role key in the app |
| Poor signal on site | Short forms; typed values kept on validation, upload and connection errors; tab drafts survive reloads; true offline sync post-MVP |
| Domain model mismatch | Professional review before Phase 3 is final; small enums |
| Regulatory expectations | Append-only log + history; no compliance claims until reviewed |
| Next.js 16 differences | Follow `node_modules/next/dist/docs/` (CLAUDE.md); lessons in ARCHITECTURE.md §6a |
| Local/hosted drift | Same Postgres major (17); migrations only; confirm when linking |
| Scope creep | PRODUCT.md §2 is the filter |

## Review log (2026-10-02, design + localisation package)

- **Design audit** (375–1920 px): see DESIGN.md §9 for findings; fixed structurally (layout
  system, contained previews, aligned app container, no negative-margin patches).
- **Responsive / zoom:** `e2e/layout.spec.ts` checks 320, 375, 390, 430, 768, 1280, 1440 px
  and 125 %/200 % text on public and app pages. It found and drove fixes for: buttons that
  could not wrap, implicit grid tracks growing with content, unbreakable compound words,
  date inputs wider than phones at 200 %, the public header at 320 px, and (visual review)
  overlapping Russian bottom-bar labels.
- **Accessibility:** axe (WCAG 2.1 AA) in ET, EN and RU on the main pages at three widths;
  `<html lang>` follows the language (it didn't after in-place switches — fixed); language
  controls are labelled buttons/select with each language's own name; history links name
  their event; bottom-bar labels are contained in their accessible names (2.5.3).
- **Security:** found and fixed — auth forms without `method` would have put credentials in
  the URL if submitted before hydration. Verified: 24 h attachment rule (both boundaries,
  mutation-tested), own-row/own-column language updates, history isolation and no token
  hashes, no service-role key in app code or history, all redirects through the allowlist,
  baseline gates unchanged (no new definer functions or RPCs), no public bucket.
- **Performance:** only the active dictionary ships to the browser; no new N+1 (history: one
  query + one profile lookup per page); hero has no large image (photo slot empty until
  licensed); known debt: cookie-based language makes public pages per-request.

## Review log (2026-10-01)

- **Responsive:** every page at 375, 768 and 1440 px — no horizontal overflow. Fixed: 44 px touch targets (logo links, back links, compact buttons on phones), log-row label wrapping, deficiency actions order, "Märgi tehtuks" only on due items in lists.
- **Accessibility:** axe-core (WCAG 2.1 AA + best practice) on all pages — one issue fixed (paragraph inside a definition list); one `h1` per page and no skipped levels; keyboard pass on the entry form (visible focus everywhere, radio chips reachable); labelled lists.
- **Security:** no secrets in git history; the service key exists only in local test tooling; 17 definer functions reviewed; baseline extended with review gates (exact tables, definer functions and RPCs; tenant policies through `org_ids`; no write paths into append-only tables, including column grants; no public buckets) — all mutation-tested.
- **Code:** duplicate validation-error helpers merged, unused code and strings removed, no `any` or suppressions.
- **Phases 7–8 (2026-10-02):**
  - *Storage security:* mutation-tested storage policies (read only ready, upload only to own pending path, delete only own incomplete), no update policy, exact bucket and policy set pinned in the baseline, finalize checks size and type.
  - *Found and fixed:* security definer BEFORE triggers (installations, log entries, deficiencies, documents) ran before RLS and FKs with unscoped lookups, so naming another tenant's record by UUID returned specific errors (`installation_archived`, `site_archived`, `correction_target_invalid`, `deficiency_resolved`) — an existence/state oracle. Now membership is checked first and lookups are scoped to the row's organisation (migration `harden_insert_triggers`, tests `100_cross_tenant_oracles`).
  - *Found and fixed:* `discardUpload` could delete the row after a failed object removal (untraceable orphan).
  - *Accepted for now (Phase 10):* no upload quota or rate limit — a member can fill storage; no malware scanning; uploaded file contents aren't sniffed (served from the Storage origin, never the app origin, with the stored type).
  - *Performance:* resolved deficiencies and completed activities were unpaginated — now 50 per page with deterministic order; dashboard and documents have no N+1 and sign no URLs in lists.
  - *Accessibility:* axe-core sweep of 11 pages at three widths, committed as an E2E test; it caught an invalid `dl` structure in the new dashboard. Upload status is announced through a polite live region; upload controls are labelled; 44 px targets.
  - *Responsive:* every new page checked at 375/768/1440 (no horizontal scroll); the installation header no longer duplicates "Lisa sissekanne" on the entry form.
- **Fixed during Phases 4–6:** a stale completion form showed "no access" instead of "already done"; two corrections in one transaction had no defined order (now `clock_timestamp()`); dropdown and field values lost after validation errors (Phase 3 fix, now covered by E2E).

## Path to public launch (owner decision 2026-10-03)

1. **Technically and functionally complete** — core product done (feature freeze holds; no
   scope added for its own sake).
2. **Extensive testing** — QA across roles, devices and languages; production-like tests.
3. **Fix bugs and UX issues** — field usability, mobile, real-world workflows, resilience,
   performance; data import/migration where real onboarding needs it.
4. **Controlled beta / dogfooding** — limited, known users; feedback loop.
5. **Company/legal setup** — operating company founded; operator facts (TBA today).
6. **Legal pages finalized** — privacy and terms completed and reviewed.
7. **Backup and email decisions** — production backup plan; custom SMTP; contact mailbox.
8. **Launch audit** — RELEASE_CHECKLIST.md green; production smoke test on kaidly.ee.
9. **Public launch** — merge `main`, deploy, tag v1.0.0.

Legal-entity details are a PRE-LAUNCH MANUAL item, not an engineering blocker: engineering,
QA and Preview work continue without them.

## POST-v1 / FUTURE (documented only — not part of v1.0)

No dates. Priority: **v1.1** = first follow-up once real customers use v1; **later** = when
demand or a decision exists.

| | Item | Benefit | Depends on | Priority |
|---|---|---|---|---|
| R/C | Custom SMTP + branded transactional mail (`no-reply@kaidly.ee`: confirmation, recovery, email change) | real customers can sign up and reset passwords | SMTP provider, verified domain | **v1.1 (launch-critical for open sign-up)** |
| Q | Backup/recovery improvement (paid plan, Storage file backups, restore drill) | recoverable customer data and files | plan decision | **v1.1** |
| N | Final retention / privacy-erasure policy (automation after legal review) | GDPR-grade erasure without manual work | legal/domain review | v1.1 |
| O/P | Native Russian and Estonian electrical-professional terminology reviews | trustworthy wording | reviewers | v1.1 |
| A | Email reminders (reminder channel `email`, weekly digest, per-user preferences) | reminders without opening the app | SMTP; `notifications.channel` is ready | v1.1 |
| D | Excel/CSV import (sites, installations, existing history where safe; guided mapping, validation, never fabricated history) | faster onboarding of existing customers | product decisions on history | v1.1 |
| I | Linked responsible KAIDLY user (alongside free text) | targeted reminders | schema change | v1.1 |
| F | Saved report presets | repeat reports quickly | — | later |
| E | Scheduled / emailed reports | monthly reporting without effort | SMTP, saved presets | later |
| G | Larger exports (> 5000 rows: streaming or background generation) | very large companies | real demand | later |
| H | Search: Cmd/Ctrl+K overlay, "show more" per group | faster navigation | — | later |
| B | Browser/mobile push (opt-in) | timely reminders on phones | push infrastructure | later |
| J | Per-company time zone (instead of Tallinn-only) | customers outside Estonia | product decision | later |
| K | Platform admin scaling (pagination beyond current limits) | many customers | growth | later |
| L | Commercial pricing/packages (public pricing; manual invoicing first, online payment only if needed) | revenue | pricing research | later |
| M | Commercial storage quotas (separate from abuse limits) | fair use per plan | pricing | later |
| S | Optional analytics — only after a privacy decision, never added silently | product insight | privacy review, consent | later |
| T | Mobile/PWA/offline workflow | sites without signal | proven field demand | later |
| U | API / integrations | customer systems | validated core usage | later |
| V | Data import/export portability (full company export) | lock-in avoidance, GDPR portability | — | later |
| W | Customer support access (explicit, time-bounded, audited; never silent impersonation) | faster support | design + audit | later |

