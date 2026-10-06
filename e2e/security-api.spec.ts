import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  addMember,
  createInstallation,
  createOrg,
  createSite,
  createUser,
  expect,
  login,
  sql,
  test,
  type TestOrg,
  type TestUser,
} from "./support/fixtures";

/**
 * Security regression suite at the API layer (docs/SECURITY_AUDIT.md). Every attack is
 * made the way an attacker would: a real signed-in session with the PUBLIC key, calling
 * PostgREST, RPCs, Storage and the app's route handlers directly — never through the UI.
 * Outcomes are verified in the database afterwards, not only from the API response.
 * Local stack only (the fixtures refuse anything else).
 */

const API = () => process.env.E2E_API_URL!;
const KEY = () => process.env.E2E_PUBLISHABLE_KEY!;

async function as(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(API(), KEY(), { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  return client;
}

function anon(): SupabaseClient {
  return createClient(API(), KEY(), { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Storage admin for fixture files only (local service role, same as user creation). */
function storageAdmin(): SupabaseClient {
  return createClient(API(), process.env.E2E_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

type Tenant = {
  org: TestOrg;
  site: string;
  installation: string;
  entry: string;
  activity: string;
  deficiency: string;
  document: string;
  storagePath: string;
  marker: string;
};

async function tenant(name: string, marker: string): Promise<Tenant> {
  const org = await createOrg(name);
  const site = await createSite(org, `${marker} objekt`);
  const installation = await createInstallation(org, site, `${marker} kilp`, "PK-1");
  const entry = sql(`insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
    values ('${org.id}', '${site}', '${installation}', 'inspection', '${marker} kontroll', '${org.users.operator.id}') returning id;`);
  const activity = sql(`insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, interval_value, interval_unit, next_due_on, reminder_days)
    values ('${org.id}', '${site}', '${installation}', '${marker} hooldus', 'recurring', 1, 'year', (now() at time zone 'Europe/Tallinn')::date + 5, '{14}') returning id;`);
  const deficiency = sql(`insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, created_by)
    values ('${org.id}', '${site}', '${installation}', '${marker} puudus', 'Kirjeldus', 'high', '${org.users.operator.id}') returning id;`);
  const [document, storagePath] = sql(`insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes, status, ready_at, uploaded_by)
    values ('${org.id}', '${site}', '${installation}', 'measurement_protocol', '${marker} protokoll', 'p.pdf', 'application/pdf', 9, 'ready', now(), '${org.users.admin.id}')
    returning id || ' ' || storage_path;`).split(" ");
  const { error } = await storageAdmin().storage.from("documents").upload(storagePath, new Blob(["%PDF-1.4\n"], { type: "application/pdf" }), { contentType: "application/pdf" });
  if (error) throw error;
  sql(`select private.generate_activity_reminders();`);
  return { org, site, installation, entry, activity, deficiency, document, storagePath, marker };
}

let A: Tenant;
let B: Tenant;
let expired: Tenant;
let deactivated: Tenant;
let multi: TestUser;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  A = await tenant("Turva A OÜ", `Aturva${Date.now().toString(36)}`);
  B = await tenant("Turva B OÜ", `Bturva${Date.now().toString(36)}`);
  expired = await tenant("Turva Aegunud OÜ", `Eturva${Date.now().toString(36)}`);
  deactivated = await tenant("Turva Suletud OÜ", `Dturva${Date.now().toString(36)}`);
  sql(`update private.organisation_access set trial_started_at = now() - interval '20 days', trial_ends_at = now() - interval '1 second' where organisation_id = '${expired.org.id}';`);
  sql(`update public.organisations set deactivated_at = now() where id = '${deactivated.org.id}';`);
  multi = await createUser("Mitme Ettevõtte");
  await addMember(A.org, multi, "operator");
  await addMember(B.org, multi, "viewer");
});

const count = (q: string) => Number(sql(q));

/**
 * The database refused the call. A "function/column not found" answer from the API layer
 * (PGRST202/PGRST204) does NOT count: the attack has to reach the database and be refused
 * there, otherwise the test would pass for the wrong reason.
 */
function refused(res: { error: { code?: string; message?: string } | null }, label = "") {
  expect(res.error, `${label}: expected a refusal`).not.toBeNull();
  expect(["PGRST202", "PGRST204", "PGRST200"], `${label}: ${res.error?.message}`).not.toContain(res.error?.code);
}

test.describe("Turvalisus API tasemel", () => {
  test("cross-tenant reads: no row of another company through any table, view, RPC or search", async () => {
    const a = await as(A.org.users.owner);
    for (const [table, id] of [
      ["organisations", B.org.id], ["sites", B.site], ["electrical_installations", B.installation], ["log_entries", B.entry],
      ["log_entry_current", B.entry], ["scheduled_activities", B.activity], ["deficiencies", B.deficiency], ["documents", B.document],
    ] as const) {
      const { data, error } = await a.from(table).select("id").eq("id", id);
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
    for (const table of ["organisation_members", "organisation_invitations", "activity_history", "notifications", "site_attention"] as const) {
      const { data } = await a.from(table).select("organisation_id").eq("organisation_id", B.org.id);
      expect(data ?? [], table).toEqual([]);
    }
    // Profiles of people who share no company are invisible.
    const { data: profile } = await a.from("profiles").select("id").eq("id", B.org.users.owner.id);
    expect(profile).toEqual([]);

    // Global search with B's unique marker, wildcards and SQL-ish input finds nothing of B.
    for (const q of [B.marker, `%${B.marker.slice(1)}%`, "%", "_", `' or 1=1 --`, `${B.marker}"; select 1`]) {
      const { data, error } = await a.rpc("search_kaidly", { p_query: q });
      expect(error, q).toBeNull();
      expect(JSON.stringify(data), q).not.toContain(B.marker);
      expect(JSON.stringify(data), q).not.toContain(B.org.id);
    }
    // Notifications are per user.
    const { data: notes } = await a.rpc("my_notifications", { p_unread_only: false, p_limit: 1000, p_offset: 0 });
    expect(JSON.stringify(notes)).not.toContain(B.marker);
  });

  test("cross-tenant writes: inserts, updates and deletes against another company have no effect", async () => {
    const a = await as(A.org.users.owner);
    const before = sql(`select name from public.sites where id = '${B.site}'`);
    await a.from("sites").update({ name: "Kaaperdatud" }).eq("id", B.site);
    await a.from("electrical_installations").update({ name: "Kaaperdatud" }).eq("id", B.installation);
    await a.from("deficiencies").update({ title: "Kaaperdatud" }).eq("id", B.deficiency);
    await a.from("scheduled_activities").update({ title: "Kaaperdatud" }).eq("id", B.activity);
    await a.from("documents").update({ title: "Kaaperdatud" }).eq("id", B.document);
    await a.from("documents").delete().eq("id", B.document);
    await a.from("organisations").update({ name: "Kaaperdatud" }).eq("id", B.org.id);
    expect(sql(`select name from public.sites where id = '${B.site}'`)).toBe(before);
    expect(count(`select count(*) from public.documents where id = '${B.document}'`)).toBe(1);
    expect(count(`select count(*) from public.sites s, public.electrical_installations i, public.deficiencies d, public.scheduled_activities a, public.documents doc, public.organisations o
      where s.id = '${B.site}' and i.id = '${B.installation}' and d.id = '${B.deficiency}' and a.id = '${B.activity}' and doc.id = '${B.document}' and o.id = '${B.org.id}'
        and 'Kaaperdatud' in (s.name, i.name, d.title, a.title, doc.title, o.name)`)).toBe(0);

    // Inserts into B, or into A referencing B's site/installation (composite keys), fail.
    refused(await a.from("sites").insert({ organisation_id: B.org.id, name: "Võõras" }));
    refused(await a.from("electrical_installations").insert({ organisation_id: A.org.id, site_id: B.site, name: "Segu", installation_type: "other" }));
    refused(await a.from("log_entries").insert({ organisation_id: A.org.id, site_id: A.site, electrical_installation_id: B.installation, entry_type: "other", description: "Segu" }));
    refused(await a.from("deficiencies").insert({ organisation_id: B.org.id, site_id: B.site, electrical_installation_id: B.installation, title: "Võõras", description: "x", severity: "low" }));
    // A correction of another company's entry.
    refused(await a.from("log_entries").insert({ organisation_id: A.org.id, site_id: A.site, electrical_installation_id: A.installation, entry_type: "other", description: "x", correction_of_id: B.entry, correction_reason: "x" }));
    // RPCs with B's ids.
    refused(await a.rpc("complete_scheduled_activity", { p_activity_id: B.activity, p_due_on: "2026-01-01", p_entry_type: "inspection", p_occurred_at: new Date().toISOString(), p_description: "x", p_result: null, p_performed_by_name: null }));
    refused(await a.rpc("resolve_deficiency", { p_deficiency_id: B.deficiency, p_resolution: "x", p_entry_type: "repair", p_occurred_at: new Date().toISOString(), p_performed_by_name: null }));
    refused(await a.rpc("finalize_document", { p_document_id: B.document }));
    expect((await a.rpc("import_company_data", { p_org: B.org.id, p_kind: "sites", p_rows: [{ name: "Võõras" }], p_token: crypto.randomUUID() })).error?.message).toBe("not_found");
    refused(await a.rpc("create_invitation", { p_organisation_id: B.org.id, p_email: "x@example.ee", p_role: "owner" }));
    refused(await a.rpc("delete_organisation", { p_organisation_id: B.org.id, p_confirm_name: B.org.name }));
    refused(await a.rpc("deactivate_organisation", { p_organisation_id: B.org.id, p_confirm_name: B.org.name }));
    expect(count(`select count(*) from public.sites where organisation_id = '${B.org.id}'`)).toBe(1);
    expect(count(`select count(*) from public.organisations where id = '${B.org.id}' and deactivated_at is null`)).toBe(1);
  });

  test("roles: no self-promotion, no joining other companies, writes only for the right role", async () => {
    const operator = await as(A.org.users.operator);
    const admin = await as(A.org.users.admin);
    const viewer = await as(A.org.users.viewer);
    // Self-promotion and joining.
    await operator.from("organisation_members").update({ role: "owner" }).eq("user_id", A.org.users.operator.id);
    await admin.from("organisation_members").update({ role: "owner" }).eq("user_id", A.org.users.admin.id);
    refused(await operator.from("organisation_members").insert({ organisation_id: B.org.id, user_id: A.org.users.operator.id, role: "owner" }));
    expect(sql(`select string_agg(role::text, ',' order by role) from public.organisation_members where organisation_id = '${A.org.id}' and user_id in ('${A.org.users.operator.id}', '${A.org.users.admin.id}')`)).toBe("admin,operator");
    // The multi-company user is only a viewer in B: no writes there.
    const m = await as(multi);
    refused(await m.from("log_entries").insert({ organisation_id: B.org.id, site_id: B.site, electrical_installation_id: B.installation, entry_type: "other", description: "x" }));
    // Viewer: nothing; operator: no sites/plan; admin: cannot create owner invitations.
    refused(await viewer.from("log_entries").insert({ organisation_id: A.org.id, site_id: A.site, electrical_installation_id: A.installation, entry_type: "other", description: "x" }));
    refused(await viewer.from("deficiencies").insert({ organisation_id: A.org.id, site_id: A.site, electrical_installation_id: A.installation, title: "x", description: "x", severity: "low" }));
    refused(await operator.from("sites").insert({ organisation_id: A.org.id, name: "x" }));
    refused(await operator.from("scheduled_activities").insert({ organisation_id: A.org.id, site_id: A.site, electrical_installation_id: A.installation, title: "x", frequency_type: "once", next_due_on: "2027-01-01" }));
    refused(await operator.rpc("import_company_data", { p_org: A.org.id, p_kind: "sites", p_rows: [{ name: "x" }], p_token: crypto.randomUUID() }));
    refused(await admin.rpc("create_invitation", { p_organisation_id: A.org.id, p_email: "x@example.ee", p_role: "owner" }));
    refused(await viewer.rpc("create_invitation", { p_organisation_id: A.org.id, p_email: "x@example.ee", p_role: "viewer" }));
    refused(await admin.rpc("delete_organisation", { p_organisation_id: A.org.id, p_confirm_name: A.org.name }));
    // Mass assignment: columns outside the grants are refused, not silently written.
    refused(await admin.from("organisations").update({ slug: "kaaperdatud" }).eq("id", A.org.id));
    refused(await admin.from("organisations").update({ deactivated_at: null, created_by: A.org.users.admin.id }).eq("id", A.org.id));
    refused(await operator.from("deficiencies").update({ status: "resolved", resolved_by: A.org.users.operator.id }).eq("id", A.deficiency));
    refused(await operator.from("profiles").update({ email: "kaaperdatud@example.ee" }).eq("id", A.org.users.operator.id));
    await operator.from("profiles").update({ full_name: "Kaaperdatud" }).eq("id", A.org.users.owner.id);
    expect(sql(`select full_name from public.profiles where id = '${A.org.users.owner.id}'`)).not.toBe("Kaaperdatud");
  });

  test("platform admin: every admin RPC and the private schema are closed to company owners and anonymous callers", async () => {
    const owner = await as(A.org.users.owner);
    expect((await owner.rpc("am_platform_admin")).data).toBe(false);
    const u = A.org.users.viewer.id;
    const membership = sql(`select id from public.organisation_members where organisation_id = '${A.org.id}' and user_id = '${u}'`);
    const calls: [string, Record<string, unknown>][] = [
      ["admin_overview", {}], ["admin_system", {}], ["admin_access_overview", {}],
      ["admin_users", { p_search: null, p_limit: 10, p_offset: 0 }], ["admin_user", { p_user: u }],
      ["admin_companies", { p_search: null, p_limit: 10, p_offset: 0 }], ["admin_company", { p_org: B.org.id }],
      ["admin_audit_entries", { p_limit: 10, p_offset: 0 }], ["admin_company_access", { p_org: A.org.id }],
      ["admin_company_access_list", { p_filter: null }], ["admin_deadlines", {}],
      ["admin_set_user_disabled", { p_user: u, p_disabled: true }], ["admin_revoke_sessions", { p_user: u }],
      ["admin_password_reset_target", { p_user: u }],
      ["admin_set_member_role", { p_membership: membership, p_role: "owner" }], ["admin_remove_member", { p_membership: membership }],
      ["admin_extend_trial", { p_org: A.org.id, p_trial_ends_at: "2099-01-01T00:00:00Z" }],
      ["admin_set_full_access", { p_org: A.org.id, p_until: null, p_invoice_reference: null, p_notes: null }],
      ["admin_set_access_reference", { p_org: A.org.id, p_invoice_reference: "x", p_notes: "x" }],
      ["admin_expire_access", { p_org: B.org.id }],
    ];
    for (const [fn, args] of calls) {
      const res = await owner.rpc(fn, args);
      refused(res, fn);
      expect(res.error?.message, fn).toBe("not_found");
      expect(res.data, fn).toBeNull();
    }
    for (const [fn, args] of calls) refused(await anon().rpc(fn, args), `anon ${fn}`);
    // The private schema (platform admins, access, audit log) is not reachable through the API.
    const { error } = await owner.schema("private" as "public").from("platform_admins" as "sites").select("*");
    expect(error).not.toBeNull();
    expect(count(`select count(*) from private.platform_admins where user_id = '${A.org.users.owner.id}'`)).toBe(0);
    expect(count(`select count(*) from auth.users where id = '${u}' and banned_until is not null`)).toBe(0);
    expect(count(`select count(*) from private.organisation_access where organisation_id = '${A.org.id}' and full_access_from is not null`)).toBe(0);
    expect(sql(`select role from public.organisation_members where id = '${membership}'`)).toBe("viewer");
  });

  test("expired and deactivated companies: every write path is refused in the database", async () => {
    for (const t of [expired, deactivated]) {
      const owner = await as(t.org.users.owner);
      const op = await as(t.org.users.operator);
      const label = t === expired ? "expired" : "deactivated";
      refused(await owner.from("sites").insert({ organisation_id: t.org.id, name: "x" }), label);
      refused(await op.from("log_entries").insert({ organisation_id: t.org.id, site_id: t.site, electrical_installation_id: t.installation, entry_type: "other", description: "x" }), label);
      refused(await op.from("log_entries").insert({ organisation_id: t.org.id, site_id: t.site, electrical_installation_id: t.installation, entry_type: "other", description: "x", correction_of_id: t.entry, correction_reason: "x" }), label);
      refused(await op.from("deficiencies").insert({ organisation_id: t.org.id, site_id: t.site, electrical_installation_id: t.installation, title: "x", description: "x", severity: "low" }), label);
      await owner.from("sites").update({ name: "Muudetud" }).eq("id", t.site);
      await op.from("deficiencies").update({ title: "Muudetud" }).eq("id", t.deficiency);
      refused(await op.rpc("complete_scheduled_activity", { p_activity_id: t.activity, p_due_on: sql(`select next_due_on from public.scheduled_activities where id = '${t.activity}'`), p_entry_type: "inspection", p_occurred_at: new Date().toISOString(), p_description: "x", p_result: null, p_performed_by_name: null }), label);
      refused(await op.rpc("resolve_deficiency", { p_deficiency_id: t.deficiency, p_resolution: "x", p_entry_type: "repair", p_occurred_at: new Date().toISOString(), p_performed_by_name: null }), label);
      expect((await owner.rpc("import_company_data", { p_org: t.org.id, p_kind: "sites", p_rows: [{ name: "x" }], p_token: crypto.randomUUID() })).error?.message, label).toBe("company_read_only");
      refused(await op.from("documents").insert({ organisation_id: t.org.id, site_id: t.site, electrical_installation_id: t.installation, category: "photo", title: "x", original_filename: "x.jpg", mime_type: "image/jpeg", size_bytes: 10 }), label);
      expect(count(`select count(*) from public.sites where organisation_id = '${t.org.id}'`), label).toBe(1);
      expect(count(`select count(*) from public.log_entries where organisation_id = '${t.org.id}'`), label).toBe(1);
      expect(count(`select count(*) from public.sites where id = '${t.site}' and name = 'Muudetud'`), label).toBe(0);
      expect(count(`select count(*) from public.deficiencies where id = '${t.deficiency}' and (title = 'Muudetud' or status = 'resolved')`), label).toBe(0);
    }
    // Members cannot give their own company access back.
    const owner = await as(expired.org.users.owner);
    refused(await owner.rpc("admin_extend_trial", { p_org: expired.org.id, p_trial_ends_at: "2099-01-01T00:00:00Z" }), "self-extend");
    expect((await owner.rpc("reactivate_organisation", { p_organisation_id: expired.org.id })).error).toBeNull(); // not deactivated: no-op
    expect(count(`select count(*) from private.organisation_access where organisation_id = '${expired.org.id}' and trial_ends_at > now()`)).toBe(0);
    // Reads (and so reports) stay available in an expired company.
    expect((await owner.from("sites").select("id").eq("organisation_id", expired.org.id)).data).toHaveLength(1);
  });

  test("operating log is append-only and notifications are per user", async () => {
    const owner = await as(A.org.users.owner);
    await owner.from("log_entries").update({ description: "Ümber kirjutatud" }).eq("id", A.entry);
    await owner.from("log_entries").delete().eq("id", A.entry);
    expect(sql(`select description from public.log_entries where id = '${A.entry}'`)).toBe(`${A.marker} kontroll`);
    // Notifications: only read_at of one's own rows can change.
    const bNote = sql(`select id from public.notifications where organisation_id = '${B.org.id}' limit 1`);
    const aNote = sql(`select id from public.notifications where user_id = '${A.org.users.owner.id}' limit 1`);
    expect(bNote).not.toBe("");
    expect(aNote).not.toBe("");
    await owner.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", bNote);
    expect(sql(`select coalesce(read_at::text, 'unread') from public.notifications where id = '${bNote}'`)).toBe("unread");
    refused(await owner.from("notifications").update({ due_on: "2000-01-01" }).eq("id", aNote));
    refused(await owner.from("notifications").insert({ user_id: A.org.users.owner.id, organisation_id: A.org.id, scheduled_activity_id: A.activity, due_on: "2030-01-01", threshold_days: 1 }));
  });

  test("storage: no reading, signing, overwriting or uploading into another company's files", async () => {
    const a = await as(A.org.users.owner);
    refused(await a.storage.from("documents").download(B.storagePath));
    refused(await a.storage.from("documents").createSignedUrl(B.storagePath, 60));
    refused(await a.storage.from("documents").upload(B.storagePath, new Blob(["x"], { type: "application/pdf" }), { upsert: true }));
    refused(await a.storage.from("documents").upload(`${B.org.id}/${crypto.randomUUID()}/${crypto.randomUUID()}`, new Blob(["x"], { type: "application/pdf" })));
    expect((await a.storage.from("documents").remove([B.storagePath])).error ?? null).toBeNull(); // RLS: silently nothing
    expect((await storageAdmin().storage.from("documents").download(B.storagePath)).error).toBeNull(); // still there
    // A's own file works with A's session; a public URL does not exist.
    expect((await a.storage.from("documents").download(A.storagePath)).error).toBeNull();
    const pub = await fetch(`${API()}/storage/v1/object/public/documents/${A.storagePath}`);
    expect(pub.ok).toBe(false);
    // Disallowed types are refused by the bucket even for one's own registered path.
    const op = await as(A.org.users.operator);
    const path = sql(`insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes, uploaded_by)
      values ('${A.org.id}', '${A.site}', '${A.installation}', 'photo', 'x', 'x.jpg', 'image/jpeg', 20, '${A.org.users.operator.id}') returning storage_path;`);
    refused(await op.storage.from("documents").upload(path, new Blob(["<svg onload=alert(1)>"], { type: "image/svg+xml" }), { contentType: "image/svg+xml" }));
    refused(await op.storage.from("documents").upload(path, new Blob(["<html><script>alert(1)</script>"], { type: "text/html" }), { contentType: "text/html" }));
    // Registering a disallowed type fails in the database too.
    refused(await op.from("documents").insert({ organisation_id: A.org.id, site_id: A.site, electrical_installation_id: A.installation, category: "other", title: "x", original_filename: "x.html", mime_type: "text/html", size_bytes: 10 }));
  });

  test("anonymous callers read nothing", async () => {
    const c = anon();
    for (const table of ["organisations", "sites", "log_entries", "documents", "profiles", "notifications"] as const) {
      const { data } = await c.from(table).select("*").limit(1);
      expect(data ?? [], table).toEqual([]);
    }
    refused(await c.rpc("search_kaidly", { p_query: A.marker }));
    refused(await c.storage.from("documents").download(A.storagePath));
  });

  test("route handlers: foreign documents, reports and notifications answer like unknown ones", async ({ page }) => {
    await login(page, A.org.users.owner, `/o/${A.org.slug}`);
    const status = async (path: string) => (await page.request.get(path, { maxRedirects: 0 })).status();
    expect(await status(`/o/${B.org.slug}/dokumendid/${B.document}/ava`)).toBe(404);
    // Own company URL + foreign id: sent to the own document page, which is "not found" for it.
    expect(await status(`/o/${A.org.slug}/dokumendid/${B.document}/ava`)).toBe(303);
    await page.goto(`/o/${A.org.slug}/dokumendid/${B.document}/ava`);
    await expect(page.locator("main")).not.toContainText(B.marker);
    expect(await status(`/o/${A.org.slug}/dokumendid/${A.document}/ava`)).toBe(302);
    expect(await status(`/o/${B.org.slug}/aruanded/log/eksport?format=csv`)).toBe(404);
    expect(await status(`/o/${deactivated.org.slug}/aruanded/log/eksport?format=csv`)).toBe(404);
    const csv = await page.request.get(`/o/${A.org.slug}/aruanded/log/eksport?format=csv&paigaldis=${B.installation}`);
    expect(await csv.text()).not.toContain(B.marker);
    const bNote = sql(`select id from public.notifications where organisation_id = '${B.org.id}' limit 1`);
    const r = await page.request.get(`/teavitused/${bNote}`, { maxRedirects: 0 });
    expect(r.headers()["location"]).toMatch(/\/teavitused$/);
    expect(sql(`select coalesce(read_at::text, 'unread') from public.notifications where id = '${bNote}'`)).toBe("unread");
    // Pages: another company's slug and ids are "not found".
    await page.goto(`/o/${B.org.slug}`);
    await expect(page.getByRole("heading", { name: "Ettevõtet ei leitud" })).toBeVisible();
    await page.goto(`/o/${A.org.slug}/paigaldised/${B.installation}`);
    await expect(page.locator("main")).not.toContainText(B.marker);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Lehte ei leitud" })).toBeVisible();
  });

  test("a server action called with another company's slug creates nothing there", async ({ page }) => {
    await login(page, A.org.users.owner, `/o/${A.org.slug}/objektid/uus`);
    // Tamper with the form exactly as a raw request would: the action resolves the company
    // from the slug through RLS, so B (not a member) is "not found".
    await page.locator('input[name="orgSlug"]').first().evaluate((input, slug) => ((input as HTMLInputElement).value = slug), B.org.slug);
    await page.locator('[name="name"]:visible').fill("Võltsitud objekt");
    await page.getByRole("button", { name: "Lisa objekt" }).click();
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    expect(count(`select count(*) from public.sites where name = 'Võltsitud objekt'`)).toBe(0);
  });

  test("stored XSS payloads render as text for members and the platform admin", async ({ page }) => {
    const payload = `<img src=x onerror="window.__xss=1">"><svg onload="window.__xss=1">`;
    sql(`update public.sites set name = '${payload.replaceAll("'", "''")}' where id = '${A.site}';
         update public.deficiencies set title = '<script>window.__xss=1</script>' where id = '${A.deficiency}';
         update public.organisations set name = '<b onmouseover="window.__xss=1">A</b>' where id = '${A.org.id}';`);
    await login(page, A.org.users.viewer, `/o/${A.org.slug}`);
    for (const path of [`/o/${A.org.slug}`, `/o/${A.org.slug}/objektid/${A.site}`, `/o/${A.org.slug}/puudused/${A.deficiency}`, `/otsing?q=${encodeURIComponent("img")}`]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss), path).toBeUndefined();
      expect(await page.locator("img[src='x'], svg[onload]").count(), path).toBe(0);
    }
    await page.goto(`/o/${A.org.slug}/puudused/${A.deficiency}`);
    await expect(page.locator("main").getByText("<script>window.__xss=1</script>").first()).toBeVisible();
    // Platform admin metadata screens.
    const admin = await createUser("Platvormi Admin");
    sql(`insert into private.platform_admins (user_id) values ('${admin.id}');`);
    await page.context().clearCookies();
    await login(page, admin, "/admin/companies");
    await page.goto(`/admin/companies/${A.org.id}`);
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    await expect(page.locator("main")).not.toContainText(A.marker + " kontroll"); // no log content for admins
  });

  test("reports: hostile values become plain text in PDF and neutralised cells in CSV", async ({ page }) => {
    const hostile = ["<script>alert(1)</script>", "=HYPERLINK(\"https://evil.example\")", "+cmd|' /C calc'!A0", "@SUM(A1)", "\u202Eevil\u202C", "x".repeat(4900)];
    for (const [i, text] of hostile.entries()) {
      sql(`insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, performed_by_name, created_by)
           values ('${A.org.id}', '${A.site}', '${A.installation}', 'other', '${text.replaceAll("'", "''")}', ${i === 1 ? "'-2+3'" : "null"}, '${A.org.users.operator.id}');`);
    }
    await login(page, A.org.users.owner, `/o/${A.org.slug}`);
    const pdf = await page.request.get(`/o/${A.org.slug}/aruanded/log/eksport?format=pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect(pdf.headers()["content-disposition"]).toMatch(/^attachment; filename="[A-Za-z0-9._-]+\.pdf"$/);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    const csv = await (await page.request.get(`/o/${A.org.slug}/aruanded/log/eksport?format=csv`)).text();
    for (const trigger of ["=HYPERLINK", "+cmd", "@SUM", "-2+3"]) {
      const cell = csv.split(/[;\r\n]/).map((c) => c.replace(/^"|"$/g, "")).find((c) => c.includes(trigger.slice(1, 6)));
      expect(cell, trigger).toBeDefined();
      expect(cell!.startsWith("'"), `${trigger} neutralised`).toBe(true);
    }
  });
});

test.describe("E-mail channel is not reachable through the API", () => {
  test("no access to pg_net, the outbox or another user's e-mail preference", async () => {
    const [a, b] = [await createUser("Saatja Ründaja"), await createUser("Teine Kasutaja")];
    const attacker = await as(a);
    const { data: session } = await attacker.auth.getSession();
    const headers = (profile: string) => ({
      apikey: KEY(),
      Authorization: `Bearer ${session.session!.access_token}`,
      "Accept-Profile": profile,
      "Content-Profile": profile,
      "Content-Type": "application/json",
    });

    // pg_net's queue (would hold the provider key briefly) and its http_post function.
    const queue = await fetch(`${API()}/rest/v1/http_request_queue?select=*`, { headers: headers("net") });
    expect(queue.status).toBe(406);
    const post = await fetch(`${API()}/rest/v1/rpc/http_post`, {
      method: "POST",
      headers: headers("net"),
      body: JSON.stringify({ url: "https://example.com", body: { to: "victim@example.com" } }),
    });
    expect(post.status).toBe(406);
    // The outbox lives in private: not an API schema.
    const outbox = await fetch(`${API()}/rest/v1/email_outbox?select=*`, { headers: headers("private") });
    expect(outbox.status).toBe(406);

    // Preferences: own row only.
    await (await as(b)).from("notification_preferences").insert({ user_id: b.id, email_deadline_reminders: true });
    expect((await attacker.from("notification_preferences").select("user_id").eq("user_id", b.id)).data).toEqual([]);
    expect((await attacker.from("notification_preferences").insert({ user_id: b.id, email_deadline_reminders: false })).error?.code).toBe("42501");
    await attacker.from("notification_preferences").update({ email_deadline_reminders: false }).eq("user_id", b.id);
    expect(sql(`select email_deadline_reminders from public.notification_preferences where user_id = '${b.id}'`)).toBe("t");
    expect((await anon().from("notification_preferences").select("user_id")).error).not.toBeNull();
  });
});
