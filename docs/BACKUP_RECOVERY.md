# KAIDLY — Backup and recovery

Status: production project `xakpbtmksxvjmsbipwmj` exists (2026-10-02); **its backup plan is not confirmed yet**, so no backup is assumed.
Nothing in this document claims a backup that has not been verified in the dashboard.

## What must be protected

| Data | Where | In Supabase database backups? |
|---|---|---|
| Accounts (auth users, sessions) | Supabase Auth (`auth` schema) | yes |
| Companies, sites, installations, operating log, plan, deficiencies, notifications, access, admin log | Postgres (`public`, `private`) | yes |
| Document and photo **files** | Supabase Storage bucket `documents` | **no** — database backups contain only the file metadata rows |

## Supabase capabilities (verify for the chosen plan before launch)

| Plan | Database backups | Point-in-time recovery |
|---|---|---|
| Free | none usable for restore — not acceptable for customer data | no |
| Pro | daily backups, 7 days retention (restore from the dashboard) | optional paid add-on |
| Team / Enterprise | longer retention | optional / included |

**Launch decision (manual, paid):** production should run on **Pro or higher** so daily
backups exist; PITR is optional. Record the actual plan, retention and PITR status here
after creating the project: _plan: …, retention: …, PITR: …, verified on: …_.

**Storage files are not covered** by database backups. Until a file-backup job exists, a
lost bucket cannot be restored by Supabase backups. Mitigation for launch: files are
immutable once attached (append-only evidence), the bucket is private, deletions are not
possible through the app (documents are archived, not deleted). A periodic off-site copy
of the bucket (e.g. `supabase storage` CLI or S3-compatible sync to EU object storage) is a
post-launch task.

## Recovery runbook

1. **Stop the damage:** if a bad deploy writes wrong data, roll back the app first
   (DEPLOYMENT.md §7) — do not touch the database yet.
2. **Assess:** which tables/companies are affected and since when (admin log,
   `activity_history`, `created_at`/`updated_at`).
3. **Small, scoped damage** (one company, few rows): fix forward with a reviewed SQL script
   or migration, using `activity_history` (old/new values of every change) as the source.
   Operating-log entries are append-only — correct with correction entries, never edits.
4. **Large damage / data loss:** restore a daily backup (or PITR point) **into a new
   project** first, verify, then copy the affected rows back. Restoring over production
   loses everything written after the backup — only with an explicit decision.
5. **After recovery:** re-run the pgTAP suite against a local copy of the migrations,
   check `/api/health`, run the smoke test (RELEASE_CHECKLIST.md), note the incident.

## Not restorable today

- Files deleted from Storage outside the app (no file backup yet).
- Anything older than the backup retention of the chosen plan.
- Auth emails already sent (links in them expire).
