# KAIDLY — Recovery runbook

Read with BACKUP_RECOVERY.md and **PRODUCTION_BACKUP_RECOVERY.md** (how to make and restore
backups). Supabase keeps **no** backups of Production (PITR off, plan without daily backups);
protection is the manual weekly database + Storage backup (`scripts/backup-database.sh`,
`scripts/backup-storage.mjs`), stored encrypted off-site — real Production backups exist
(status 2026-10-07, BACKUP_RECOVERY.md).

## 1. What lives where

| Data | Where | Recovered by |
|---|---|---|
| Accounts (users, identities) | Postgres `auth` | database backup / dump |
| Companies, sites, installations, log, plan, deficiencies, document **metadata**, notifications, history | Postgres `public` | database backup / dump |
| Access/trial state, platform admins, admin audit, upload counters, import batches | Postgres `private` | database backup / dump |
| Document and photo **files** | Supabase Storage bucket `documents` | `scripts/backup-storage.mjs` mirror (manual, weekly) |
| Sessions | Postgres `auth` | not needed — users sign in again |
| Reminder e-mail outbox, e-mail settings/templates | Postgres `private` (key: Vault) | database backup; after a restore, set `private.email_settings.enabled = false` first — the processor drops anything older than 2 days, so no stale reminder mail is sent (EMAIL_NOTIFICATIONS.md) |
| Schema, policies, functions, cron jobs, bucket definition | `supabase/migrations` (git) | rebuild from zero (`db push` / `db reset`) |

## 2. Logical restore — rehearsed locally (2026-10-05)

Procedure that worked on the local stack with the QA dataset (6 companies, 2,204 log entries,
557 activities, 534 documents, 13 users, history and access rows):

```bash
npx supabase db dump --local --data-only -f data.sql          # (Production: --linked, with care)
# Remove rows that migrations create themselves (Storage tables refuse direct deletes):
#   INSERT INTO "storage"."buckets" … ;   INSERT INTO "private"."upload_limits" … ;
npx supabase db reset --no-seed                                 # schema from migrations, empty
docker exec -i supabase_db_kaidly psql -U postgres -v ON_ERROR_STOP=1 --single-transaction < data-filtered.sql
```

Result: all table counts identical; a restored user signed in with the old password; RLS
showed exactly that user's companies; the append-only log refused an update; no trigger left
disabled (`session_replication_role = replica` lasts only for the restore session).

Lessons: run the restore in **one transaction** (an aborted restore otherwise leaves half the
data); filter migration-created rows; Storage tables cannot be cleaned with SQL.

**What this proves:** the schema can be rebuilt from git, and a data dump restores into it
with all invariants intact. The later full rehearsal with the backup scripts (2026-10-06,
PRODUCTION_BACKUP_RECOVERY.md §6) also covered Storage files. **Not proven:** loading into a
hosted Supabase project and restore timing at real Production size.

## 3. Database and Storage out of step

| Scenario | Effect | Handling in the app |
|---|---|---|
| DB restored to yesterday, Storage current | Files uploaded since yesterday have no row → orphaned objects (invisible, cost storage) | `supabase/maintenance/storage_report.sql` lists orphans for manual cleanup |
| Storage restored to yesterday, DB current | Rows whose file is missing | Opening such a document shows "Faili ei õnnestunud praegu avada…" on the document page (no error page); metadata stays |
| DB only (no file backup at all) | Every document row without its file | Same notice; reports/register still list the metadata |

## 4. Accidental CLI link to Production

```bash
npm run db:target     # prints the linked project; PRODUCTION exits with code 1 and a warning
npx supabase link --project-ref gdpzavhkblbcxivoaqax
npm run db:target     # DEVELOPMENT
```
Guards: `db:target` labels the link; `npm run qa:fixtures` aborts if the production ref appears
in the environment or the CLI link and only ever writes to the local container; the build
guard refuses a Production build against development and vice versa. `supabase db reset`
without `--linked` only touches the local stack — never add `--linked` to a reset.

## 5. Before the first real customer

| | Status (2026-10-07) |
|---|---|
| Database backups | Manual weekly + pre-migration backups (tooling done, real Production backups taken). Daily Supabase backups would need a paid plan — owner decision; until then the weekly risk is accepted consciously |
| Storage file backup | Done: `backup-storage.mjs` mirror with cross-check; file restore rehearsed locally |
| Restore drill | Done on the local stack with production-like scale; a drill into a hosted new project is not done (needs a new project — owner decision) |
| Named responsibility for recovery decisions | Kenneth (owner) — confirm in writing when the company exists |
