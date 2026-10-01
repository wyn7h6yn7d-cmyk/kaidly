// Reads connection details of the LOCAL Supabase stack (`supabase status`). Refuses
// anything that isn't localhost, so local-only tooling (E2E tests, dev against the local
// stack) can never point at a hosted project. Values are never written to disk.
import { execFileSync } from "node:child_process";

export function localSupabaseEnv() {
  const out = execFileSync("npx", ["supabase", "status", "-o", "env"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const env = Object.fromEntries(
    out
      .split("\n")
      .map((line) => /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim()))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  );
  const url = new URL(env.API_URL ?? "http://invalid");
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
    throw new Error(`Refusing non-local Supabase URL: ${url.origin}`);
  }
  for (const key of ["API_URL", "PUBLISHABLE_KEY", "SERVICE_ROLE_KEY"]) {
    if (!env[key]) throw new Error(`Local Supabase is not running (missing ${key}). Run npm run db:start.`);
  }
  return env;
}
