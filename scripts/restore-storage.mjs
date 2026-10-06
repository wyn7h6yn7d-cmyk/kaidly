#!/usr/bin/env node
// KAIDLY — restore Storage files from a backup mirror (docs/PRODUCTION_BACKUP_RECOVERY.md).
//
//   node scripts/restore-storage.mjs --mirror <dir> --db <db backup dir> --local
//   node scripts/restore-storage.mjs --mirror <dir> --db <db backup dir> --project-ref <NEW project>
//
// Uploads every file the database backup knows (storage.objects: bucket + path) from the
// mirror, with its original content type, to the same bucket and path. Refuses the
// PRODUCTION project: recovery goes into a new project; Production is never overwritten.
// Run after scripts/restore-database.sh (the documents rows reference these paths).
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const PRODUCTION_REF = "xakpbtmksxvjmsbipwmj";
const args = process.argv.slice(2);
const value = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const mirror = value("--mirror");
const db = value("--db");
const ref = value("--project-ref");
const local = args.includes("--local");
if (!mirror || !db || local === Boolean(ref)) {
  console.error("usage: restore-storage.mjs --mirror <dir> --db <db backup dir> (--local | --project-ref <NEW project>)");
  process.exit(1);
}
if (ref === PRODUCTION_REF) {
  console.error("Refusing: never restore into the Production project. Create a new project for the recovery.");
  process.exit(1);
}
const target = local ? ["--local"] : ["--project-ref", ref];
const repo = resolve(dirname(new URL(import.meta.url).pathname), "..");

// Objects and their content types from the database backup.
const dump = readFileSync(join(resolve(db), "data.sql"), "utf8");
const match = dump.match(/^COPY "storage"\."objects" \(([^)]*)\) FROM stdin;\n([\s\S]*?)^\\\.$/m);
const objects = [];
if (match) {
  const cols = match[1].split(",").map((c) => c.trim().replace(/"/g, ""));
  const [b, n, m] = ["bucket_id", "name", "metadata"].map((c) => cols.indexOf(c));
  for (const line of match[2].split("\n").filter(Boolean)) {
    const v = line.split("\t");
    let type = "application/octet-stream";
    try {
      type = JSON.parse(v[m].replace(/\\\\/g, "\\")).mimetype ?? type;
    } catch {}
    objects.push({ path: `${v[b]}/${v[n]}`, type });
  }
}

let uploaded = 0;
const missing = [];
const failed = [];
let i = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (i < objects.length) {
      const o = objects[i++];
      const file = join(resolve(mirror), o.path);
      if (!existsSync(file)) {
        missing.push(o.path);
        continue;
      }
      try {
        await run("npx", ["--no-install", "supabase", "storage", "cp", file, `ss:///${o.path}`, "--content-type", o.type, ...target, "--experimental"], { cwd: repo });
        uploaded += 1;
      } catch {
        failed.push(o.path);
      }
    }
  }),
);

console.log(`Storage restore (${local ? "local stack" : ref}): ${objects.length} objects in the backup, uploaded ${uploaded}, missing in mirror ${missing.length}, failed ${failed.length}`);
for (const p of [...missing.map((p) => `missing: ${p}`), ...failed.map((p) => `failed: ${p}`)]) console.log(`  ${p}`);
process.exit(missing.length || failed.length ? 1 : 0);
