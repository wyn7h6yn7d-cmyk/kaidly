// Prints which Supabase project the CLI is linked to, labelled. Run before any `--linked`
// command: `npm run db:target`. Development is the default; production is linked only
// for a deliberate release step and re-linked to development afterwards (docs/DEPLOYMENT.md).
import { readFileSync } from "node:fs";

const PROJECTS = { gdpzavhkblbcxivoaqax: "DEVELOPMENT", xakpbtmksxvjmsbipwmj: "PRODUCTION" };
let ref = "";
try {
  ref = readFileSync(new URL("../supabase/.temp/project-ref", import.meta.url), "utf8").trim();
} catch {
  // not linked
}
const label = PROJECTS[ref] ?? (ref ? "UNKNOWN" : "NOT LINKED");
console.log(`Supabase CLI linked to: ${ref || "—"} (${label})`);
if (label === "PRODUCTION") {
  console.log("!! PRODUCTION is linked. Re-link development after the release step:");
  console.log("   npx supabase link --project-ref gdpzavhkblbcxivoaqax");
  process.exitCode = 1;
}
