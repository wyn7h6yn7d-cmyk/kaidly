# KAIDLY — Implementation plan

Status (2026-10-02): **Phases 1–8 implemented**, plus responsive/accessibility polish, a CI
pipeline and a Storage-focused security review. Work is on branch
`phase-2-3-organisations-sites`; nothing is merged to `main`, no migration has been pushed
to a hosted project. **Phase 9 does not start without explicit approval.**

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
| Tests | 377 pgTAP, 44 unit, 55 E2E runs (incl. axe sweep at three widths) | DATABASE.md §11, README |
| Reviews | Responsive (375/768/1440), accessibility (axe + keyboard), security regression (+ review gates), code quality; Phase 7–8: storage security, cross-tenant oracles, pagination | this file, "Review log" |

**Still not final for Phase 3:** the electrical-professional domain review (PRODUCT.md §8).

## Next phases (not started)

### Phase 9 — Mobile polish (recommended next)
Real-device pass (iOS Safari incl. HEIC photos, Android Chrome; keyboard overlap, camera,
slow network), local drafts for entry forms, photos in the deficiency creation form,
"Leidsin puuduse" from a log entry, change history (`activity_history`) for admins,
marketing page with real photography (D11), Estonian copy review by a native professional.

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
| D13 | UI language | Estonian only; strings centralised in `lib/i18n/et.ts` |
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
| D35 | Upload quotas (2026-10-02) | Storage quotas and upload rate limits are a **production launch blocker**; no package/storage limits invented yet |
| D36 | Pricing (2026-10-02) | A **public pricing page** (Hinnad / Pricing) is required eventually: simple, high value, aggressively affordable vs. electrical/compliance software, aimed at small contractors and independent käidukorraldajad; normal plans publicly priced (no "contact sales"). Prices, plan, storage and feature limits are **not decided** — they follow separate Estonia/EU competitor research. No billing, Stripe or subscription logic until then |
| — | Out of scope | No AI, payments, IoT, ERP/EAM integrations, email infrastructure, analytics, notifications |

## Production launch blockers

- **Storage quotas and upload rate limits (D35).** Today any member can upload without limit.
- **Privacy-erasure workflow** for legitimate personal-data deletion (D32), designed with legal input.
- **Russian terminology review** by a native electrical professional before the RU UI is public.
- Production Supabase project, migrations pushed, auth email templates, security headers, backups (Phase 10).

## Open questions (need a decision or domain review)

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
| Poor signal on site | Short forms, typed values preserved on errors; offline drafts in Phase 9; true offline sync post-MVP |
| Domain model mismatch | Professional review before Phase 3 is final; small enums |
| Regulatory expectations | Append-only log + history; no compliance claims until reviewed |
| Next.js 16 differences | Follow `node_modules/next/dist/docs/` (CLAUDE.md); lessons in ARCHITECTURE.md §6a |
| Local/hosted drift | Same Postgres major (17); migrations only; confirm when linking |
| Scope creep | PRODUCT.md §2 is the filter |

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
