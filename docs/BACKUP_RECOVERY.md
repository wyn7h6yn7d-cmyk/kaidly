# KAIDLY — Backup and recovery (overview)

Status **2026-10-07**. The procedures live in two documents; this page is the map.

| Document | Use it for |
|---|---|
| [PRODUCTION_BACKUP_RECOVERY.md](PRODUCTION_BACKUP_RECOVERY.md) | Making a backup (database + Storage), storing it encrypted off-site, retention, restoring into a **new** project, the configuration that is not in a backup |
| [RECOVERY_RUNBOOK.md](RECOVERY_RUNBOOK.md) | Scenarios: what lives where, database/Storage out of step, accidental CLI link to Production |
| [RELEASE_RUNBOOK.md](RELEASE_RUNBOOK.md) §4 | The mandatory backup before every Production migration |

## Current protection

| | |
|---|---|
| Supabase backups (daily / PITR) | **None** for Production (`xakpbtmksxvjmsbipwmj`): plan without daily backups, PITR off. Upgrade path = paid plan (owner decision) |
| KAIDLY manual backups | `scripts/backup-database.sh` (pg_dump through the CLI: auth, public, private, Storage metadata) + `scripts/backup-storage.mjs` (incremental mirror of the `documents` bucket with a database ↔ Storage cross-check). Real Production backups have been taken |
| Restore | Rehearsed on the local stack (2026-10-06): all tables and content fingerprints identical, restored users sign in, RLS and the append-only log intact, files byte-identical. Restore tooling never writes to Production: `restore-storage.mjs` refuses the production ref, `restore.sql` refuses any database that already has user accounts |
| Schema | Always rebuildable from git (`supabase/migrations`) |
| Application | Vercel keeps previous deployments (instant rollback, DEPLOYMENT.md §7) |

Worst case with weekly manual backups: what was entered since the last backup. Routine
(PRODUCTION_BACKUP_RECOVERY.md §3): weekly database + Storage backup, plus a database backup
before every Production migration; keep the 4 most recent weekly backups and the
pre-migration backups of the last 3 months; quarterly restore rehearsal. Backups contain
customer data and password hashes — only in the encrypted image, with a second off-site copy;
never in git (`/backups/` is gitignored and the scripts refuse other paths inside the repo).

## What must be protected

| Data | Where | In the database backup? |
|---|---|---|
| Accounts (auth users, identities) | Supabase Auth (`auth` schema) | yes |
| Companies, sites, installations, log, plan, deficiencies, notifications, history | Postgres `public` | yes |
| Access/plans/trials, platform admins, admin audit, upload counters, e-mail outbox | Postgres `private` | yes |
| Document and photo **files** | Storage bucket `documents` | **no** — only by `backup-storage.mjs` |
| Secrets and dashboard settings (Vault key, Auth/SMTP settings, templates, Vercel env) | dashboards | **no** — inventory in PRODUCTION_BACKUP_RECOVERY.md §4 |

## First response to an incident

1. **Stop the damage:** a bad deploy → promote the previous deployment first; do not touch
   the database yet.
2. **Assess:** which companies and tables, since when (`/admin/audit`, `activity_history`,
   timestamps).
3. **Small, scoped damage:** fix forward with a reviewed migration or script, using
   `activity_history` (old/new values). Operating-log entries are corrected with correction
   entries, never edits.
4. **Large damage / data loss:** restore the newest backup into a **new** project, verify,
   then decide (copy rows back, or switch over). Never restore over Production.
5. **After:** `/api/health`, MANUAL_SMOKE_TEST.md, note the incident.
