#!/usr/bin/env bash
# KAIDLY — database backup of the PRODUCTION Supabase project (docs/PRODUCTION_BACKUP_RECOVERY.md).
#
#   scripts/backup-database.sh                 → ~/KAIDLY-backups/db/<UTC timestamp>/
#   KAIDLY_BACKUP_DIR=/Volumes/Backup scripts/backup-database.sh
#
# Read-only for Production: pg_dump through the Supabase CLI (`--project-ref`, your CLI login
# — no database password, nothing stored in git). The CLI link is NOT changed. Writes:
#   roles.sql     cluster roles (custom roles only; Supabase's own roles exist in any project)
#   schema.sql    full schema as it is in Production (reference; restore uses git migrations)
#   data.sql      all data: auth (users, identities…), public, private, storage metadata
#   counts.tsv    rows per table in data.sql (for verifying a restore)
#   meta.txt      when, git commit, CLI version
#   SHA256SUMS    checksums of the files above
# The files contain customer data and password hashes: they are created readable only by
# you (umask 077) and must be kept encrypted and off-site. Never commit them.
set -euo pipefail

PRODUCTION_REF="xakpbtmksxvjmsbipwmj"   # msbi — never msbl
REF="${KAIDLY_BACKUP_REF:-$PRODUCTION_REF}"   # "local" = the local stack (restore rehearsals)
if [[ "$REF" != "$PRODUCTION_REF" && "$REF" != "gdpzavhkblbcxivoaqax" && "$REF" != "local" ]]; then
  echo "Refusing: unknown project ref '$REF'." >&2
  exit 1
fi

REPO="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="${KAIDLY_BACKUP_DIR:-$HOME/KAIDLY-backups}"
case "$(cd "$(dirname "$ROOT")" 2>/dev/null && pwd)/$(basename "$ROOT")" in
  "$REPO"|"$REPO"/*)
    # Inside the repository only the gitignored backups/ folder is allowed.
    [[ "$ROOT" == "$REPO/backups"* ]] || { echo "Refusing: backups inside the repository must go to $REPO/backups (gitignored)." >&2; exit 1; }
    ;;
esac

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
case "$REF" in
  "$PRODUCTION_REF") LABEL=production; SOURCE=(--project-ref "$REF") ;;
  local) LABEL=local; SOURCE=(--local) ;;
  *) LABEL=development; SOURCE=(--project-ref "$REF") ;;
esac
OUT="$ROOT/db/${STAMP}-${LABEL}"
umask 077
mkdir -p "$OUT"
cd "$REPO"

echo "KAIDLY database backup"
echo "  project: $REF ($LABEL)"
echo "  target:  $OUT"

# pg_dump through the CLI; its messages go to the terminal (minus the update notice), and a
# failing dump stops the backup.
dump() {
  local log status=0
  log="$(mktemp)"
  npx --no-install supabase db dump "${SOURCE[@]}" "$@" 2>"$log" || status=$?
  grep -vE "new version of Supabase CLI|We recommend updating" "$log" >&2 || true
  rm -f "$log"
  [[ $status -eq 0 ]] || { echo "ERROR: supabase db dump $* failed" >&2; exit 1; }
}

dump --role-only -f "$OUT/roles.sql"
dump -f "$OUT/schema.sql"
dump --data-only --use-copy -f "$OUT/data.sql"

# Row counts per table, read from the dump itself (no second connection to Production).
awk '
  /^COPY / { table = $2; n = 0; inside = 1; next }
  inside && /^\\\.$/ { printf "%s\t%d\n", table, n; inside = 0; next }
  inside { n++ }
' "$OUT/data.sql" | sort > "$OUT/counts.tsv"

{
  echo "created_utc=$STAMP"
  echo "project_ref=$REF"
  echo "git_commit=$(git rev-parse HEAD 2>/dev/null || echo unknown)"
  echo "supabase_cli=$(npx --no-install supabase --version 2>/dev/null | head -1)"
  echo "migrations_in_repo=$(ls supabase/migrations/*.sql | wc -l | tr -d ' ')"
  echo "latest_migration_in_repo=$(ls supabase/migrations/*.sql | tail -1 | xargs basename)"
} > "$OUT/meta.txt"

( cd "$OUT" && shasum -a 256 roles.sql schema.sql data.sql counts.tsv meta.txt > SHA256SUMS )
chmod 600 "$OUT"/*

for f in roles.sql schema.sql data.sql; do
  [[ -s "$OUT/$f" ]] || { echo "ERROR: $f is empty" >&2; exit 1; }
done
grep -q '^COPY "public"."organisations"' "$OUT/data.sql" || { echo "ERROR: data.sql has no organisations table" >&2; exit 1; }

echo
echo "Done. Key tables:"
grep -E '"(auth"\."users|public"\."(organisations|organisation_members|sites|electrical_installations|scheduled_activities|log_entries|deficiencies|documents)|storage"\."objects)"' "$OUT/counts.tsv" | sed 's/^/  /'
echo
echo "Size: $(du -sh "$OUT" | cut -f1). Next: back up Storage (scripts/backup-storage.mjs), then copy $ROOT to encrypted off-site storage."
