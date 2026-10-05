import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test as base, type Page } from "@playwright/test";

/**
 * Test setup helpers, LOCAL stack only. Users are created through the local auth admin
 * API (service-role key read from `supabase status` by playwright.config.ts, never
 * stored); fixture rows are written with SQL as the local postgres user. The application
 * itself never uses either.
 */

export type Role = "owner" | "admin" | "operator" | "viewer";
export type TestUser = { id: string; email: string; password: string; fullName: string };

const PASSWORD = "Pikk-test-parool-42";

/** Local database container (supabase/config.toml project_id = "kaidly"). */
const DB_CONTAINER = "supabase_db_kaidly";

/** Auth admin API of the LOCAL stack — used only to create confirmed test users. */
function authAdmin(): SupabaseClient {
  const url = process.env.E2E_API_URL;
  const key = process.env.E2E_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("E2E env missing — run through `npm run test:e2e`.");
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") throw new Error("E2E must target local Supabase");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

let counter = 0;
export function uniqueId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${process.pid.toString(36)}-${counter}`;
}

export async function createUser(fullName: string): Promise<TestUser> {
  const email = `${uniqueId("e2e")}@example.ee`;
  const { data, error } = await authAdmin().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  return { id: data.user.id, email, password: PASSWORD, fullName };
}

export type TestOrg = {
  id: string;
  slug: string;
  name: string;
  users: Record<Role, TestUser>;
};

/** SQL literal for test-generated values. */
function lit(value: string | null | undefined): string {
  return value == null ? "null" : `'${value.replaceAll("'", "''")}'`;
}

/**
 * Runs SQL as the local `postgres` user inside the local database container.
 * service_role deliberately has no table privileges in KAIDLY (see docs/DATABASE.md),
 * so fixture data is written directly. Returns the first column of the last row.
 */
export function sql(statement: string): string {
  const out = execFileSync(
    "docker",
    ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-qtA", "-v", "ON_ERROR_STOP=1"],
    { input: statement, encoding: "utf8" },
  );
  return out.trim().split("\n").filter(Boolean).at(-1) ?? "";
}

/** An organisation with one member per role. */
export async function createOrg(name = "Testi Elekter OÜ"): Promise<TestOrg> {
  const slug = uniqueId("e2e").toLowerCase();
  const users = {
    owner: await createUser("Olev Omanik"),
    admin: await createUser("Anne Admin"),
    operator: await createUser("Kati Käitaja"),
    viewer: await createUser("Vello Vaataja"),
  };
  const id = sql(`
    with org as (
      insert into public.organisations (name, slug) values (${lit(name)}, ${lit(slug)}) returning id
    ), members as (
      insert into public.organisation_members (organisation_id, user_id, role)
      select org.id, m.user_id::uuid, m.role::public.org_role from org, (values
        (${lit(users.owner.id)}, 'owner'), (${lit(users.admin.id)}, 'admin'),
        (${lit(users.operator.id)}, 'operator'), (${lit(users.viewer.id)}, 'viewer')) as m(user_id, role)
    )
    select id from org;`);
  return { id, slug, name, users };
}

export async function addMember(org: TestOrg, user: TestUser, role: Role) {
  sql(`insert into public.organisation_members (organisation_id, user_id, role)
       values (${lit(org.id)}, ${lit(user.id)}, ${lit(role)});`);
}

export async function createSite(org: TestOrg, name: string, address?: string) {
  return sql(`insert into public.sites (organisation_id, name, address)
              values (${lit(org.id)}, ${lit(name)}, ${lit(address)}) returning id;`);
}

export async function createInstallation(org: TestOrg, siteId: string, name: string, identifier?: string) {
  return sql(`insert into public.electrical_installations
                (organisation_id, site_id, name, identifier, installation_type)
              values (${lit(org.id)}, ${lit(siteId)}, ${lit(name)}, ${lit(identifier)}, 'switchboard')
              returning id;`);
}

/** Logs in through the real login form and waits until the app has loaded. */
export async function login(page: Page, user: TestUser, next?: string) {
  await page.goto(`/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.waitForLoadState("networkidle"); // hydrated: the form submits through JavaScript
  await page.locator('input[name="email"]:visible').fill(user.email);
  await page.locator('input[name="password"]:visible').fill(user.password);
  // Language-independent: the sign-in form's submit button.
  await page.locator('form button[type="submit"]:visible').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"));
}

/** The visible form field with this name (hidden, preserved pages may contain copies). */
export function field(page: Page, name: string) {
  return page.locator(`[name="${name}"]:visible`);
}

/** No sideways page scrolling at the current viewport. */
export async function expectNoHorizontalScroll(page: Page) {
  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  expect(fits, "page scrolls horizontally").toBe(true);
}

/**
 * Every page hides the Next.js development overlay (<nextjs-portal>): in `next dev` its issue
 * badge sits bottom-left over the sidebar account button and intercepts clicks. It does
 * not exist in production builds, so hiding it changes nothing the tests assert.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.addInitScript(() => {
      const hide = () => {
        if (document.getElementById("e2e-hide-next-dev-overlay")) return;
        const style = document.createElement("style");
        style.id = "e2e-hide-next-dev-overlay";
        style.textContent = "nextjs-portal{display:none!important}";
        document.documentElement.appendChild(style);
      };
      if (document.documentElement) hide();
      else document.addEventListener("DOMContentLoaded", hide);
    });
    await provide(page);
  },
});
export { expect };
