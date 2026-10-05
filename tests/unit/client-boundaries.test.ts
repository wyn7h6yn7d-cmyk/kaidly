import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Performance guard (docs/PERFORMANCE_AUDIT.md): heavy server-only libraries must not be
 * reachable from client components. Walks the static import graph of every "use client"
 * file (value imports only; Server Action modules are references, not bundled code).
 */

const ROOT = process.cwd();
const SOURCE_DIRS = ["app", "components", "lib"];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

function resolve(spec: string, from: string): string | null {
  const base = spec.startsWith("@/") ? path.join(ROOT, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(from), spec) : null;
  if (!base) return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    if (existsSync(base + ext) && statSync(base + ext).isFile()) return base + ext;
  }
  return null;
}

function valueImports(file: string): string[] {
  const src = readFileSync(file, "utf8");
  return [...src.matchAll(/^import\s+(type\s+)?[^;]*?from\s+"([^"]+)"/gm)].filter((m) => !m[1]).map((m) => m[2]);
}

function reaches(file: string, forbidden: RegExp, seen = new Set<string>()): string[] | null {
  if (seen.has(file)) return null;
  seen.add(file);
  for (const spec of valueImports(file)) {
    if (forbidden.test(spec)) return [path.relative(ROOT, file), spec];
    const target = resolve(spec, file);
    if (!target || readFileSync(target, "utf8").startsWith('"use server"')) continue;
    const chain = reaches(target, forbidden, seen);
    if (chain) return [path.relative(ROOT, file), ...chain];
  }
  return null;
}

const clientFiles = SOURCE_DIRS.flatMap((d) => files(path.join(ROOT, d))).filter((f) =>
  readFileSync(f, "utf8").trimStart().startsWith('"use client"'),
);

test("pdfmake and report generation never reach a client bundle", () => {
  for (const file of clientFiles) {
    const chain = reaches(file, /^(pdfmake|pdfkit)$|lib\/reports\/(pdf|build)$/);
    assert.equal(chain, null, `client import chain: ${chain?.join(" -> ")}`);
  }
});

test("zod stays server-side (only the account e-mail form validates in the browser)", () => {
  const allowed = new Set(["components/account/email-change-form.tsx"]);
  for (const file of clientFiles) {
    if (allowed.has(path.relative(ROOT, file))) continue;
    const chain = reaches(file, /^zod$/);
    assert.equal(chain, null, `client import chain: ${chain?.join(" -> ")}`);
  }
});

test("only the basic Latin font subset is preloaded", () => {
  for (const file of ["app/layout.tsx", "app/page.tsx"]) {
    const src = readFileSync(path.join(ROOT, file), "utf8");
    for (const m of src.matchAll(/subsets:\s*\[([^\]]*)\]/g)) {
      assert.equal(m[1].replace(/\s/g, ""), '"latin"', `${file}: preload only "latin" (other subsets load on demand)`);
    }
  }
});
