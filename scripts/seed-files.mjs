#!/usr/bin/env node
// DEVELOPMENT ONLY: adds sample document links and a photo link to the LOCAL demo
// organisation (supabase/seed.sql) through the normal flow — signed in as the demo users with
// the publishable key, so RLS applies exactly as in the app. KAIDLY stores no files: the
// documents point to example https addresses.
//
//   npm run db:reset && npm run db:seed-files
import { createClient } from "@supabase/supabase-js";
import { localSupabaseEnv } from "./local-supabase.mjs";

const env = localSupabaseEnv(); // refuses anything that isn't localhost
const PASSWORD = "kaidly-demo-parool";
const ORG = "d0000000-0000-4000-8000-00000000d000";
const SITE = "d0000000-0000-4000-8000-0000000000b1";
const PJK = "d0000000-0000-4000-8000-0000000000c1";

async function signIn(email) {
  const client = createClient(env.API_URL, env.PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Sign-in failed for ${email}. Run npm run db:reset first.`);
  return client;
}

async function addLink(client, placement, { title, category, url }) {
  const { error } = await client
    .from("documents")
    .insert({ organisation_id: ORG, ...placement, category, title, external_url: url });
  if (error) throw new Error(`${title}: ${error.message}`);
  console.log(`  ✓ ${title}`);
}

const admin = await signIn("admin@kaidly.test");
const operator = await signIn("kaitaja@kaidly.test");

console.log("Sample document links (local demo organisation):");
await addLink(admin, {}, {
  title: "Käidukorralduse juhend",
  category: "manual",
  url: "https://example.com/kaidly-demo/dokumendid/kaidukorralduse-juhend.pdf",
});
await addLink(admin, { site_id: SITE }, {
  title: "Logistikakeskuse ühejooneskeem",
  category: "single_line_diagram",
  url: "https://example.com/kaidly-demo/dokumendid/uhejooneskeem",
});
await addLink(operator, { site_id: SITE, electrical_installation_id: PJK }, {
  title: "PJK-1 mõõteprotokoll 2026",
  category: "measurement_protocol",
  url: "https://example.com/kaidly-demo/dokumendid/pjk-1-mooteprotokoll-2026",
});

// The demo deficiency links to where its photos are kept.
const { data: deficiency } = await operator
  .from("deficiencies")
  .update({ photos_url: "https://example.com/kaidly-demo/fotod/kilbi-uks" })
  .eq("organisation_id", ORG)
  .eq("title", "Kilbi uks ei sulgu")
  .select("id");
if (deficiency?.length) console.log("  ✓ Kilbi uks ei sulgu — fotode link");
console.log("Done. Sign in as admin@kaidly.test or kaitaja@kaidly.test and open Dokumendid.");
