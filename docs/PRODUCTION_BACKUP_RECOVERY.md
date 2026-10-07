# KAIDLY — Production backups and recovery

Production: Supabase project **`xakpbtmksxvjmsbipwmj`** (msbi), region EU (Ireland).
Development: `gdpzavhkblbcxivoaqax`. Read with RECOVERY_RUNBOOK.md (scenarios) and
RELEASE_RUNBOOK.md (releases).

## 1. Current protection

| | Status |
|---|---|
| Supabase daily backups | **none** — `npx supabase backups list --project-ref xakpbtmksxvjmsbipwmj` → `"backups": []`, `"pitr_enabled": false` (plan without backups) |
| Point-in-time recovery | none (paid add-on, not enabled) |
| **KAIDLY manual backups** (this document) | database dump + Storage mirror, run by Kenneth, stored encrypted off-site — real Production backups taken (status 2026-10-07) |
| Schema | always rebuildable from git (`supabase/migrations`) |
| Application | Vercel keeps previous deployments (instant rollback) |

With manual weekly backups the worst case is losing what was entered since the last
backup. Decide consciously whether that is acceptable for your customers; a paid plan with
daily backups is the upgrade path (not enabled — needs your decision).

## 2. Making a backup

Prerequisites: this repository, `npm ci`, Docker not needed, and a Supabase CLI login with
access to the Production project (`npx supabase login`, once). Nothing is stored in git; no
database password is needed (the CLI uses your login); the CLI link stays on Development.

```bash
cd ~/dev/kaidly
scripts/backup-database.sh
node scripts/backup-storage.mjs --db "$(ls -d ~/KAIDLY-backups/db/*-production | tail -1)"
```

Results (outside the repository, readable only by you):

```
~/KAIDLY-backups/
  db/20261007T080000Z-production/   roles.sql schema.sql data.sql counts.tsv meta.txt SHA256SUMS
  storage/production/documents/…    mirror of every file, same bucket/path (incremental)
  storage/manifests/20261007T080500Z-production.json   files, sizes, sha256, cross-check
```

- `data.sql` holds all data: Auth users and identities (with password hashes), companies,
  members, sites, installations, plan, operating log, deficiencies, documents (metadata),
  notifications, history, access/trial, platform admins, e-mail outbox, Storage metadata.
- `counts.tsv` lists the rows per table — the restore compares against it.
- The Storage run downloads only files that are not in the mirror yet (KAIDLY files never
  change once uploaded) and reports any file the database knows but Storage lacks.
- Both scripts exit with an error if anything is missing or empty.

Different location: `KAIDLY_BACKUP_DIR=/Volumes/KAIDLY-backups scripts/backup-database.sh`
(and the same variable for the Storage script). Inside the repository only the gitignored
`backups/` folder is accepted.

### Storing backups

Backups contain customer data and password hashes. Keep them **encrypted and off-site**:

1. Once, create an encrypted disk image (AES-256, password in your password manager):
   ```bash
   hdiutil create -size 20g -fs APFS -encryption AES-256 -volname KAIDLY-backups ~/KAIDLY-backups.sparsebundle -type SPARSEBUNDLE
   hdiutil attach ~/KAIDLY-backups.sparsebundle          # mounts /Volumes/KAIDLY-backups
   ```
2. Back up into it: `export KAIDLY_BACKUP_DIR=/Volumes/KAIDLY-backups` before the commands
   above; afterwards `hdiutil detach /Volumes/KAIDLY-backups`.
3. Keep a second copy of the encrypted image elsewhere (e.g. an external drive kept away
   from the computer). A cloud copy is fine only of the encrypted image (not configured —
   your decision).

Never e-mail, commit or upload unencrypted backup files.

## 3. Retention (launch stage)

- **Weekly** full backup (database + Storage), e.g. every Monday.
- **Before every Production migration** (RELEASE_RUNBOOK.md §4) — database backup first.
- Keep at least the **4 most recent weekly** backups plus every pre-migration backup from
  the last 3 months; delete older ones from the encrypted image (`rm -rf` of the dated
  folder). The Storage mirror is cumulative — keep it.
- Every quarter: a restore rehearsal from the newest backup (§5).

## 4. Configuration that is not in a backup (inventory — no values here)

Recreate these by hand in a new project; the values are in the dashboards / your password
manager, never in git.

| What | Where | Notes |
|---|---|---|
| Vault secret `RESEND_API_KEY` | Supabase → Integrations → Vault | reminder e-mails; then `update private.email_settings set enabled = true;` |
| Vercel env (Production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `KAIDLY_SITE_URL`, `KAIDLY_CONTACT_EMAIL` | Vercel → Settings → Environment Variables | URL and publishable key change with a new project |
| Auth URL config | Supabase → Authentication → URL Configuration | Site URL `https://kaidly.ee`, redirect `https://kaidly.ee/**` |
| Auth e-mail settings | Authentication → Providers → Email | confirm e-mail ON, secure e-mail change ON, **secure password change ON**, minimum password length 10 |
| Auth SMTP | Authentication → SMTP | Resend: host `smtp.resend.com`, sender `KAIDLY <no-reply@kaidly.ee>` (password = Resend key, not stored here) |
| Auth templates and security notifications | Authentication → Emails | files in `supabase/templates/` (docs/EMAIL_TEMPLATES.md §6) |
| Auth rate limits | Authentication → Rate Limits | as set before launch |
| Cron jobs `kaidly-activity-reminders` (03:15), `kaidly-upload-events-cleanup` (03:40), `kaidly-email-outbox` (every 5 min) | created by the migrations | check `select jobname, schedule from cron.job;` |
| Storage bucket `documents` (private, 25 MB, PDF/JPEG/PNG/WebP/DOCX/XLSX) | created by the migrations | |
| Extensions pg_cron, pg_net | created by the migrations | |
| Platform admins | in the database backup (`private.platform_admins`) | |
| Resend domain, DNS (Elkdata: MX, SPF, DMARC; Resend: DKIM `resend._domainkey`, `send.`) | Resend dashboard, Elkdata DNS | unaffected by a Supabase restore |
| Domain → Vercel | Vercel → Domains, Elkdata DNS (A record) | |

## 5. Restoring

**Never restore into the running Production project.** A restore goes into a **new**
Supabase project (or the local stack for rehearsals); Production is switched over only after
the new project is verified. Order matters:

1. **Schema.** New Supabase project (region EU). Check out the commit in the backup's
   `meta.txt` (or later), link the new project and apply the migrations:
   ```bash
   git checkout <git_commit from meta.txt>
   npx supabase link --project-ref <NEW_REF>      # never xakpbtmksxvjmsbipwmj
   npx supabase db push                            # migrations only, no seed
   ```
2. **Data.** Prepare and load the data in one transaction (all or nothing):
   ```bash
   scripts/restore-database.sh ~/KAIDLY-backups/db/<backup>      # writes <backup>/restore.sql, verifies checksums
   psql "<NEW project connection string from Dashboard → Connect>" -v ON_ERROR_STOP=1 -f ~/KAIDLY-backups/db/<backup>/restore.sql
   ```
   (No local `psql`? `docker run --rm -i postgres:17 psql "<connection string>" -v ON_ERROR_STOP=1 < restore.sql`.)
   The connection string contains the new project's database password — type it, don't save it.
   `restore.sql` refuses to run (nothing changed) if the target already has any user account,
   so it cannot empty Production or another project in use by mistake.
3. **Files.**
   ```bash
   node scripts/restore-storage.mjs --mirror ~/KAIDLY-backups/storage/production \
     --db ~/KAIDLY-backups/db/<backup> --project-ref <NEW_REF>
   ```
4. **Configuration** from §4 (Vault secret last, then enable e-mail sending).
5. **Switch:** Vercel Production env → new URL and publishable key, redeploy `main`.
6. Relink the CLI to Development: `npx supabase link --project-ref gdpzavhkblbcxivoaqax`.

What cannot be restored automatically: Vault secrets; Auth settings, templates, SMTP and
rate limits; Vercel variables; anything written after the backup; active sessions (users
sign in again — passwords keep working, the hashes are in the backup). Reminder e-mails
older than two days are never sent late (outbox rule), so a restore does not flood anyone.

### Verifying a restore

- `scripts/restore-database.sh … --local` compares every table's row count with
  `counts.tsv` (for a new project, compare `select count(*)` of the key tables by hand).
- Sign in as yourself; the companies, sites, installations, plan, log, deficiencies and
  documents are there; open and download one document and one photo.
- A second account sees only its own companies (tenant isolation).
- A log entry cannot be edited (append-only).
- `select jobname from cron.job;` shows the three KAIDLY jobs.
- `/api/health` on the switched deployment is `ok`.

## 6. Restore rehearsal (2026-10-06, local stack — never Production)

Source: local stack with demo data, uploaded files and the scale QA fixtures — 106
companies, 514 users, 614 sites, 3,537 installations, 15,057 activities, 75,204 log entries,
7,029 deficiencies, 15,039 document records, 41,906 history rows, 5 stored files.

| Step | Result |
|---|---|
| Database backup (`backup-database.sh`, local mode) | 80 MB in 7 s |
| Storage backup + cross-check | 5/5 files, database ↔ Storage consistent; second run downloaded 0 (incremental) |
| Restore (rebuild from migrations, load, upload files) | 34 s; **all 50 tables' row counts match** |
| Content fingerprints (md5 of every row of 14 key tables incl. Auth users and password hashes) | **identical** before and after |
| `scripts/verify-restore.mjs` | restored user signs in with the old password; sequences continue; RLS shows only own companies, another company and its log invisible; log stays append-only; writing works and history triggers fire again; a restored file opens through a signed URL and is byte-identical to the backup |
| Real remote dump (Development project, read-only) restored locally | all 49 tables match |
| Backup taken from a newer schema than the checked-out migrations | refused with a clear message (nothing loaded) |

Two defects found and fixed during the rehearsal: sequence positions were dropped from the
restore (new sign-ins failed with "error creating refresh token" — now kept, and checked by
`verify-restore.mjs`), and Storage's internal tables cannot be written by `postgres` (the
restore now skips the storage schema; files are re-uploaded through the Storage API with
their original paths and content types).

Not rehearsed: loading into a hosted Supabase project (needs a new project — your
decision); the commands follow Supabase's documented `db dump` + `psql` migration path.
