#!/usr/bin/env node
// DEVELOPMENT ONLY: adds sample documents and photos to the LOCAL demo organisation
// (supabase/seed.sql) through the normal upload flow — signed in as the demo users with
// the publishable key, so RLS and the storage policies apply exactly as in the app. No
// service-role key, no remote files: the sample files are generated here.
//
//   npm run db:reset && npm run db:seed-files
import { createClient } from "@supabase/supabase-js";
import { deflateSync } from "node:zlib";
import { localSupabaseEnv } from "./local-supabase.mjs";

const env = localSupabaseEnv(); // refuses anything that isn't localhost
const PASSWORD = "kaidly-demo-parool";
const ORG = "d0000000-0000-4000-8000-00000000d000";
const SITE = "d0000000-0000-4000-8000-0000000000b1";
const PJK = "d0000000-0000-4000-8000-0000000000c1";

function pdf(title) {
  const text = `BT /F1 18 Tf 72 720 Td (${title.replace(/[()\\]/g, "")}) Tj ET`;
  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
    `<</Length ${text.length}>>stream\n${text}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = objects.map((object, i) => {
    const offset = body.length;
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

/** A small solid-colour PNG (a stand-in for a site photo). */
function png(width, height, [r, g, b]) {
  const crc = (buf) => {
    let c = ~0;
    for (const byte of buf) {
      c ^= byte;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, "latin1");
    data.copy(out, 8);
    out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3).map((_, i) => [r, g, b][i % 3])]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function signIn(email) {
  const client = createClient(env.API_URL, env.PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Sign-in failed for ${email}. Run npm run db:reset first.`);
  return client;
}

async function upload(client, placement, { title, category, filename, mime, bytes }) {
  const { data: doc, error } = await client
    .from("documents")
    .insert({
      organisation_id: ORG,
      ...placement,
      category,
      title,
      original_filename: filename,
      mime_type: mime,
      size_bytes: bytes.length,
    })
    .select("id, storage_path")
    .single();
  if (error) throw new Error(`${title}: ${error.message}`);
  const { error: uploadError } = await client.storage
    .from("documents")
    .upload(doc.storage_path, bytes, { contentType: mime, upsert: false });
  if (uploadError) throw new Error(`${title}: ${uploadError.message}`);
  const { data: status } = await client.rpc("finalize_document", { p_document_id: doc.id });
  console.log(`  ${status === "ready" ? "✓" : "✗"} ${title}`);
}

const admin = await signIn("admin@kaidly.test");
const operator = await signIn("kaitaja@kaidly.test");
const site = { site_id: SITE };
const pjk = { site_id: SITE, electrical_installation_id: PJK };

console.log("Sample documents (local demo organisation):");
await upload(admin, {}, {
  title: "Käidukorralduse juhend",
  category: "manual",
  filename: "kaidukorralduse-juhend.pdf",
  mime: "application/pdf",
  bytes: pdf("Kaidukorralduse juhend (naidis)"),
});
await upload(admin, site, {
  title: "Logistikakeskuse ühejooneskeem",
  category: "single_line_diagram",
  filename: "uhejooneskeem-logistikakeskus.pdf",
  mime: "application/pdf",
  bytes: pdf("Uhejooneskeem (naidis)"),
});
await upload(operator, pjk, {
  title: "PJK-1 mõõteprotokoll 2026",
  category: "measurement_protocol",
  filename: "PJK-1_mooteprotokoll_2026.pdf",
  mime: "application/pdf",
  bytes: pdf("PJK-1 mooteprotokoll 2026 (naidis)"),
});
await upload(operator, pjk, {
  title: "Peajaotuskilp",
  category: "photo",
  filename: "peajaotuskilp.png",
  mime: "image/png",
  bytes: png(640, 480, [15, 61, 50]),
});

// A photo on an open deficiency.
const { data: deficiency } = await operator
  .from("deficiencies")
  .select("id, site_id, electrical_installation_id")
  .eq("organisation_id", ORG)
  .eq("title", "Kilbi uks ei sulgu")
  .maybeSingle();
if (deficiency) {
  await upload(
    operator,
    { site_id: deficiency.site_id, electrical_installation_id: deficiency.electrical_installation_id, deficiency_id: deficiency.id },
    { title: "Katkine lukk", category: "photo", filename: "lukk.png", mime: "image/png", bytes: png(480, 640, [180, 83, 9]) },
  );
}
console.log("Done. Sign in as admin@kaidly.test or kaitaja@kaidly.test and open Dokumendid.");
