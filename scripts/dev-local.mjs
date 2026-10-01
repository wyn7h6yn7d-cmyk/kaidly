// Starts `next dev` against the LOCAL Supabase stack instead of .env.local.
// Usage: node scripts/dev-local.mjs [port]
import { spawn } from "node:child_process";
import { localSupabaseEnv } from "./local-supabase.mjs";

const port = process.argv[2] ?? "3000";
const local = localSupabaseEnv();
const child = spawn("npx", ["next", "dev", "-p", port], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY,
  },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
