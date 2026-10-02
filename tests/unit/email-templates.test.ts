import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Production Auth email templates (pasted into the Supabase dashboard, DEPLOYMENT.md §3.5).
const ROUTE_TYPES = ["signup", "invite", "magiclink", "recovery", "email_change", "email"]; // app/auth/confirm/route.ts
const TEMPLATES: Record<string, { type: string; next: string; extra?: string }> = {
  confirmation: { type: "email", next: "/o" },
  recovery: { type: "recovery", next: "/auth/update-password" },
  email_change: { type: "email_change", next: "/konto", extra: "{{ .NewEmail }}" },
};
const read = (name: string) => readFileSync(new URL(`../../supabase/templates/${name}.html`, import.meta.url), "utf8");

for (const [name, spec] of Object.entries(TEMPLATES)) {
  test(`${name}: token_hash link to the production site, valid type and next`, () => {
    const html = read(name);
    const href = /href="([^"]+)"/.exec(html)?.[1] ?? "";
    assert.equal(href, `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${spec.type}&amp;next=${spec.next}`);
    assert.ok(ROUTE_TYPES.includes(spec.type));
    if (spec.extra) assert.ok(html.includes(spec.extra));
    // No environment-specific hosts or secrets: the Site URL comes from Supabase Auth settings.
    assert.doesNotMatch(html, /vercel\.app|supabase\.co|localhost|127\.0\.0\.1|https?:\/\/(?!kaidly\.ee)/);
    assert.doesNotMatch(html, /sb_secret_|service_role|eyJ[A-Za-z0-9_-]{20,}|password=/i);
    assert.doesNotMatch(html, /\{\{\s*\.ConfirmationURL\s*\}\}/, "uses token_hash links, not the browser-bound default");
    // Balanced markup.
    for (const tag of ["div", "p", "a"]) {
      const open = html.match(new RegExp(`<${tag}[\\s>]`, "g"))?.length ?? 0;
      const close = html.match(new RegExp(`</${tag}>`, "g"))?.length ?? 0;
      assert.equal(open, close, `<${tag}> balanced`);
    }
    // Trilingual body (ET first) and KAIDLY branding.
    assert.match(html, /KAIDLY/);
    assert.match(html, /[õäöü]/);
    assert.match(html, /[а-я]/);
  });
}
