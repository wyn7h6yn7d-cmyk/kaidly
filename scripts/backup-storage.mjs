#!/usr/bin/env node
// KAIDLY — Storage backup (documents and photos) of the PRODUCTION Supabase project
// (docs/PRODUCTION_BACKUP_RECOVERY.md).
//
//   node scripts/backup-storage.mjs                        → ~/KAIDLY-backups/storage/production/
//   node scripts/backup-storage.mjs --db <db backup dir>   + cross-check with that database dump
//   KAIDLY_BACKUP_DIR=/Volumes/Backup node scripts/backup-storage.mjs
//   node scripts/backup-storage.mjs --local                (local stack, for rehearsals)
//
// Read-only for the project: lists and downloads through the Supabase CLI (`--project-ref`,
// your CLI login; no keys in git, the CLI link is not changed). Files land in a private
// local mirror with the same bucket/path structure — nothing is made public. Repeated runs
// are incremental: KAIDLY files are never changed after upload (immutable object paths), so a
// file already in the mirror is not downloaded again. Every run writes a manifest (path,
// size, sha256) and reports objects that the database knows but Storage lacks, and the other
// way round, when a database backup is given.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { promisify } from "node:util";

const run = promisify(execFile);
const PRODUCTION_REF = "xakpbtmksxvjmsbipwmj"; // msbi — never msbl
const args = process.argv.slice(2);
const local = args.includes("--local");
const ref = process.env.KAIDLY_BACKUP_REF ?? PRODUCTION_REF;
if (!local && ![PRODUCTION_REF, "gdpzavhkblbcxivoaqax"].includes(ref)) {
  console.error(`Refusing: unknown project ref '${ref}'.`);
  process.exit(1);
}
const target = local ? ["--local"] : ["--project-ref", ref];
const label = local ? "local" : ref === PRODUCTION_REF ? "production" : "development";
const repo = resolve(dirname(new URL(import.meta.url).pathname), "..");
const root = resolve(process.env.KAIDLY_BACKUP_DIR ?? join(homedir(), "KAIDLY-backups"));
if ((root === repo || root.startsWith(`${repo}/`)) && !root.startsWith(join(repo, "backups"))) {
  console.error(`Refusing: backups inside the repository must go to ${join(repo, "backups")} (gitignored).`);
  process.exit(1);
}
const mirror = join(root, "storage", label);
const dbIndex = args.indexOf("--db");
const dbDir = dbIndex >= 0 ? resolve(args[dbIndex + 1] ?? "") : null;

process.umask(0o077);
mkdirSync(mirror, { recursive: true });

async function cli(...cliArgs) {
  const { stdout } = await run("npx", ["--no-install", "supabase", ...cliArgs, ...target, "--experimental"], {
    cwd: repo,
    maxBuffer: 256 * 1024 * 1024,
  });
  return stdout;
}

// The CLI prints either {"paths": [...]} (agent/JSON mode) or one path per line.
async function listPaths(prefix, recursive = true) {
  const out = (await cli("storage", "ls", ...(recursive ? ["-r"] : []), prefix)).trim();
  if (out.startsWith("{")) return JSON.parse(out).paths ?? [];
  return out.split("\n").map((line) => line.trim()).filter(Boolean);
}

const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

async function pool(items, size, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  });
  await Promise.all(workers);
}

console.log(`KAIDLY Storage backup\n  project: ${local ? "local stack" : ref} (${label})\n  mirror:  ${mirror}`);

// Buckets, then every object in each (paths come back as "/bucket/a/b/c").
const buckets = (await listPaths("ss:///", false)).map((p) => p.replace(/^\/|\/$/g, "")).filter(Boolean);
const objects = [];
for (const bucket of buckets) {
  for (const path of await listPaths(`ss:///${bucket}`)) {
    const clean = path.replace(/^\//, "");
    if (!clean.endsWith("/")) objects.push(clean);
  }
}

let downloaded = 0;
let failed = 0;
await pool(objects, 4, async (object) => {
  const file = join(mirror, object);
  if (existsSync(file) && statSync(file).size > 0) return;
  mkdirSync(dirname(file), { recursive: true });
  try {
    await cli("storage", "cp", `ss:///${object}`, file);
    downloaded += 1;
  } catch {
    failed += 1;
    console.error(`  could not download ${object}`);
  }
});

// Manifest of everything Storage holds now, as found in the mirror.
const files = objects.map((object) => {
  const file = join(mirror, object);
  const present = existsSync(file);
  return { path: object, size: present ? statSync(file).size : null, sha256: present ? sha256(file) : null };
});
const missingLocally = files.filter((f) => f.size === null).map((f) => f.path);

// Optional cross-check with the database dump (storage.objects rows = files KAIDLY knows).
let crossCheck = null;
if (dbDir) {
  const dump = readFileSync(join(dbDir, "data.sql"), "utf8");
  const match = dump.match(/^COPY "storage"\."objects" \(([^)]*)\) FROM stdin;\n([\s\S]*?)^\\\.$/m);
  const known = new Set();
  if (match) {
    const cols = match[1].split(",").map((c) => c.trim().replace(/"/g, ""));
    const b = cols.indexOf("bucket_id");
    const n = cols.indexOf("name");
    for (const line of match[2].split("\n").filter(Boolean)) {
      const v = line.split("\t");
      known.add(`${v[b]}/${v[n]}`);
    }
  }
  const inStorage = new Set(objects);
  crossCheck = {
    database_backup: dbDir,
    database_objects: known.size,
    in_database_not_in_storage: [...known].filter((p) => !inStorage.has(p)),
    in_storage_not_in_database: objects.filter((p) => !known.has(p)),
  };
}

const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const manifest = {
  created_utc: stamp,
  project: local ? "local" : ref,
  buckets: Object.fromEntries(
    buckets.map((bucket) => {
      const inBucket = files.filter((f) => f.path.startsWith(`${bucket}/`));
      return [bucket, { files: inBucket.length, bytes: inBucket.reduce((s, f) => s + (f.size ?? 0), 0) }];
    }),
  ),
  downloaded_this_run: downloaded,
  failed_this_run: failed,
  missing_in_mirror: missingLocally,
  cross_check: crossCheck,
  files,
};
mkdirSync(join(root, "storage", "manifests"), { recursive: true });
const manifestFile = join(root, "storage", "manifests", `${stamp}-${label}.json`);
writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
chmodSync(manifestFile, 0o600);

console.log(`  buckets: ${buckets.join(", ") || "none"}; objects in Storage: ${objects.length}`);
console.log(`  downloaded now: ${downloaded}, already in mirror: ${objects.length - downloaded - failed}, failed: ${failed}`);
if (crossCheck) {
  console.log(`  database knows ${crossCheck.database_objects} objects; missing from Storage: ${crossCheck.in_database_not_in_storage.length}; not in database: ${crossCheck.in_storage_not_in_database.length}`);
}
console.log(`  manifest: ${manifestFile}`);
console.log(`  copy ${root} to encrypted off-site storage.`);
process.exit(failed || missingLocally.length ? 1 : 0);
