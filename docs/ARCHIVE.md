# KAIDLY — Archiving installations (limits, lock, delete)

Owner decision 2026-11-21. Migration `20261122100000_archive_limits.sql`. Tests:
`supabase/tests/270_archive_limits.test.sql` (39, mutation-tested), `e2e/archive.spec.ts`
(incl. direct API requests with supabase-js).

## Rules (all enforced in the database)

| Rule | Where |
|---|---|
| Restoring needs a free active slot (`plan_restore_limit`) | `private.installation_plan_limit()` — the same BEFORE trigger and row lock as the active limit |
| Archive holds at most `installation_limit` installations (`plan_archive_limit`); trial 10; no limit = no limit; existing data over the cap is not touched | same trigger |
| An archived installation is locked: no new/changed plan activities, completions, deficiencies (incl. resolving), audits, log entries, documents; the installation itself can only be restored | `ensure_installation_active()` (column-specific, so FK cascades still work), `installation_archived_is_read_only()`, earlier insert triggers |
| No reminders and no reminder e-mails for archived installations or sites | `generate_activity_reminders()`, `email_block_reason()` |
| Delete: an empty installation at once; an archived one with history only with its exact name ("Ekspordi ja kustuta" — the app has the user download the audit package PDF and the log CSV first); active with history: never; stored files block it | `public.delete_installation()` |
| After a delete the change history keeps one note (name, identifier, site, counts, who, when) and no content | same function |
| Admin: companies with more than 5 restore cycles in 30 days (from `activity_history`) | `public.admin_archive_churn()`, `/admin/arhiveerimine` |

The keep-forever guards (log append-only, deficiencies kept, documents kept) step aside only
inside `delete_installation()` for that one installation (transaction-local setting).

## App

- Archive: a confirm dialog warns about open deficiencies and upcoming activities.
- Messages: "Paigaldise taastamiseks pole paketis vaba kohta…" and "Arhiiv on täis ({arv}/{piir})…".
- Site viewers see archived installations of their sites and can download the audit package
  (`/vaade/[site]/auditipakett?paigaldis=…`) and the log CSV (`/vaade/[site]/eksport?paigaldis=…`).
