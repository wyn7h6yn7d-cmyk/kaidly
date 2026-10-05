#!/usr/bin/env node
// KAIDLY auth + account-security e-mail templates — ONE source for all Supabase templates.
//
//   node scripts/email-templates.mjs            writes supabase/templates/*.html (Go templates)
//   node scripts/email-templates.mjs --subjects prints the one-line subjects for the dashboard
//   node scripts/email-templates.mjs --preview  also writes .email-preview/<template>.<lang>.html
//                                               (fake values only; local files, never deployed)
//
// Design: conservative e-mail HTML (tables, inline styles, no web fonts), max 560 px.
// No images at all: the header is the text wordmark KAIDLY beside a volt-green block drawn
// with a table cell, so nothing can show as a broken image and image blocking changes
// nothing (a remote logo showed as broken in a real iCloud Mail message, 2026-10-06).
// Language: Auth user metadata key `locale` (et | en | ru; written at sign-up and on language
// change), read nil-safely; anything else falls back to Estonian. No tracking of any kind.
// Auth/security mails never contain customer operational data. docs/EMAIL_TEMPLATES.md.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const LANGS = ["et", "en", "ru"];
const C = { paper: "#E7E5E1", card: "#FFFFFF", line: "#D6D3CD", ink: "#111827", muted: "#4B5563", green: "#0F3D32", volt: "#22D07A", fill: "#EFEDE9" };
const FONT = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const footer = {
  et: "Elektripaigaldise käit. Lihtsalt.",
  en: "Electrical installation operation, simply.",
  ru: "Эксплуатация электроустановок — просто.",
};
const fallbackLabel = {
  et: "Kui nupp ei tööta, ava see link:",
  en: "If the button doesn't work, open this link:",
  ru: "Если кнопка не работает, откройте ссылку:",
};
const autoNote = {
  et: "See on automaatne kiri KAIDLY kontoga seotud toimingu kohta.",
  en: "This is an automatic message about your KAIDLY account.",
  ru: "Это автоматическое письмо о действии с вашей учётной записью KAIDLY.",
};

/** KAIDLY route that verifies the token on the server (app/auth/confirm/route.ts). */
const confirmUrl = (type, next) => `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}&amp;next=${next}`;

/**
 * Templates: Supabase name, purpose, whether KAIDLY uses it today, and per language a subject,
 * heading, paragraphs (may contain Go placeholders), optional CTA, optional code, security note.
 */
export const TEMPLATES = {
  confirmation: {
    kind: "auth",
    active: true,
    cta: { href: confirmUrl("email", "/o") },
    et: { subject: "Kinnita oma KAIDLY konto", heading: "Kinnita oma e-posti aadress", body: ["Tere tulemast KAIDLYsse. Konto loomise lõpetamiseks kinnita oma e-posti aadress."], cta: "Kinnita e-post", note: "Kui sina seda kontot ei loonud, võid selle kirja tähelepanuta jätta." },
    en: { subject: "Confirm your KAIDLY account", heading: "Confirm your email address", body: ["Welcome to KAIDLY. To finish creating your account, please confirm your email address."], cta: "Confirm email", note: "If you didn't create this account, you can ignore this email." },
    ru: { subject: "Подтвердите учётную запись KAIDLY", heading: "Подтвердите адрес электронной почты", body: ["Добро пожаловать в KAIDLY. Чтобы завершить создание учётной записи, подтвердите адрес электронной почты."], cta: "Подтвердить адрес", note: "Если вы не создавали эту учётную запись, просто проигнорируйте это письмо." },
  },
  recovery: {
    kind: "auth",
    active: true,
    cta: { href: confirmUrl("recovery", "/auth/update-password") },
    et: { subject: "KAIDLY parooli taastamine", heading: "Taasta oma parool", body: ["Saime taotluse sinu KAIDLY konto parooli muutmiseks. Uue parooli saad määrata alloleva nupuga."], cta: "Muuda parooli", note: "Kui sina parooli muutmist ei taotlenud, võid selle kirja tähelepanuta jätta — parool jääb samaks." },
    en: { subject: "Reset your KAIDLY password", heading: "Reset your password", body: ["We received a request to change the password of your KAIDLY account. You can set a new one with the button below."], cta: "Change password", note: "If you didn't ask to change your password, you can ignore this email — your password stays the same." },
    ru: { subject: "Восстановление пароля KAIDLY", heading: "Восстановите пароль", body: ["Мы получили запрос на смену пароля вашей учётной записи KAIDLY. Задать новый пароль можно кнопкой ниже."], cta: "Сменить пароль", note: "Если вы не запрашивали смену пароля, проигнорируйте это письмо — пароль останется прежним." },
  },
  email_change: {
    kind: "auth",
    active: true,
    cta: { href: confirmUrl("email_change", "/konto") },
    et: { subject: "Kinnita KAIDLY e-posti aadressi muutmine", heading: "Kinnita uus e-posti aadress", body: ["Soovid muuta KAIDLY konto e-posti aadressiks:", "<strong>{{ .NewEmail }}</strong>"], cta: "Kinnita uus e-post", note: "Kui sina seda muudatust ei alustanud, ära kinnita seda." },
    en: { subject: "Confirm your new KAIDLY email address", heading: "Confirm your new email address", body: ["You asked to change the email address of your KAIDLY account to:", "<strong>{{ .NewEmail }}</strong>"], cta: "Confirm new email", note: "If you didn't start this change, don't confirm it." },
    ru: { subject: "Подтвердите смену адреса почты в KAIDLY", heading: "Подтвердите новый адрес", body: ["Вы хотите изменить адрес электронной почты учётной записи KAIDLY на:", "<strong>{{ .NewEmail }}</strong>"], cta: "Подтвердить новый адрес", note: "Если вы не начинали это изменение, не подтверждайте его." },
  },
  invite: {
    kind: "auth",
    active: false,
    cta: { href: confirmUrl("invite", "/auth/update-password") },
    et: { subject: "Sind kutsuti KAIDLYsse", heading: "Liitu KAIDLY ettevõttega", body: ["Sulle on saadetud kutse KAIDLY kasutamiseks. Kutse vastuvõtmisel saad määrata oma parooli."], cta: "Võta kutse vastu", note: "Kui sa seda kutset ei oodanud, võid kirja tähelepanuta jätta." },
    en: { subject: "You've been invited to KAIDLY", heading: "Join a company on KAIDLY", body: ["You've been invited to use KAIDLY. When you accept, you can set your password."], cta: "Accept invitation", note: "If you weren't expecting this invitation, you can ignore this email." },
    ru: { subject: "Вас пригласили в KAIDLY", heading: "Присоединяйтесь к организации в KAIDLY", body: ["Вам отправлено приглашение пользоваться KAIDLY. Приняв его, вы сможете задать свой пароль."], cta: "Принять приглашение", note: "Если вы не ждали этого приглашения, просто проигнорируйте письмо." },
  },
  magic_link: {
    kind: "auth",
    active: false,
    cta: { href: confirmUrl("magiclink", "/o") },
    et: { subject: "KAIDLY sisselogimislink", heading: "Logi KAIDLYsse", body: ["Sisselogimiseks vajuta allolevat nuppu. Link kehtib piiratud aja."], cta: "Logi sisse", note: "Kui sina seda sisselogimislinki ei taotlenud, võid kirja tähelepanuta jätta." },
    en: { subject: "Your KAIDLY sign-in link", heading: "Sign in to KAIDLY", body: ["Use the button below to sign in. The link is valid for a limited time."], cta: "Sign in", note: "If you didn't ask for this sign-in link, you can ignore this email." },
    ru: { subject: "Ссылка для входа в KAIDLY", heading: "Вход в KAIDLY", body: ["Чтобы войти, нажмите кнопку ниже. Ссылка действует ограниченное время."], cta: "Войти", note: "Если вы не запрашивали ссылку для входа, просто проигнорируйте письмо." },
  },
  reauthentication: {
    kind: "auth",
    active: false,
    code: "{{ .Token }}",
    et: { subject: "{{ .Token }} on sinu KAIDLY kinnituskood", heading: "Kinnita, et see oled sina", body: ["Kasuta allolevat koodi oma identiteedi kinnitamiseks."], note: "Ära jaga seda koodi kellegagi. Kui sina seda kinnitust ei taotlenud, ära sisesta koodi." },
    en: { subject: "{{ .Token }} is your KAIDLY verification code", heading: "Confirm it's you", body: ["Use the code below to confirm your identity."], note: "Never share this code with anyone. If you didn't ask for this confirmation, don't enter the code." },
    ru: { subject: "{{ .Token }} — ваш код подтверждения KAIDLY", heading: "Подтвердите, что это вы", body: ["Используйте код ниже, чтобы подтвердить свою личность."], note: "Никому не сообщайте этот код. Если вы не запрашивали подтверждение, не вводите код." },
  },
  password_changed_notification: {
    kind: "notification",
    active: true,
    cta: { href: "{{ .SiteURL }}/auth/forgot-password" },
    et: { subject: "Sinu KAIDLY parool muudeti", heading: "Parool on muudetud", body: ["Sinu KAIDLY konto ({{ .Email }}) parool muudeti."], cta: "Taasta parool", note: "Kui sina seda ei teinud, taasta kohe oma parool." },
    en: { subject: "Your KAIDLY password was changed", heading: "Your password was changed", body: ["The password of your KAIDLY account ({{ .Email }}) was changed."], cta: "Reset password", note: "If this wasn't you, reset your password right away." },
    ru: { subject: "Пароль KAIDLY изменён", heading: "Пароль изменён", body: ["Пароль вашей учётной записи KAIDLY ({{ .Email }}) был изменён."], cta: "Восстановить пароль", note: "Если это были не вы, немедленно восстановите пароль." },
  },
  email_changed_notification: {
    kind: "notification",
    active: true,
    cta: { href: "{{ .SiteURL }}/auth/forgot-password" },
    et: { subject: "Sinu KAIDLY e-posti aadress muudeti", heading: "E-posti aadress on muudetud", body: ["Sinu KAIDLY konto e-posti aadress muudeti:", "{{ .OldEmail }} → <strong>{{ .Email }}</strong>"], cta: "Taasta ligipääs", note: "Kui sina seda muudatust ei teinud, võta kohe kasutusele konto taastamise sammud." },
    en: { subject: "Your KAIDLY email address was changed", heading: "Your email address was changed", body: ["The email address of your KAIDLY account was changed:", "{{ .OldEmail }} → <strong>{{ .Email }}</strong>"], cta: "Recover access", note: "If you didn't make this change, start recovering your account right away." },
    ru: { subject: "Адрес почты KAIDLY изменён", heading: "Адрес электронной почты изменён", body: ["Адрес электронной почты вашей учётной записи KAIDLY изменён:", "{{ .OldEmail }} → <strong>{{ .Email }}</strong>"], cta: "Восстановить доступ", note: "Если это изменение сделали не вы, немедленно восстановите доступ к учётной записи." },
  },
  phone_changed_notification: {
    kind: "notification",
    active: false,
    unused: "phone sign-in is not used",
    et: { subject: "Sinu KAIDLY telefoninumber muudeti", heading: "Telefoninumber on muudetud", body: ["Sinu KAIDLY konto ({{ .Email }}) telefoninumber muudeti."], note: "Kui sina seda ei teinud, taasta kohe ligipääs oma kontole." },
    en: { subject: "Your KAIDLY phone number was changed", heading: "Your phone number was changed", body: ["The phone number of your KAIDLY account ({{ .Email }}) was changed."], note: "If this wasn't you, recover access to your account right away." },
    ru: { subject: "Номер телефона KAIDLY изменён", heading: "Номер телефона изменён", body: ["Номер телефона вашей учётной записи KAIDLY ({{ .Email }}) изменён."], note: "Если это были не вы, немедленно восстановите доступ к учётной записи." },
  },
  identity_linked_notification: {
    kind: "notification",
    active: false,
    unused: "external sign-in providers are not used",
    et: { subject: "Sinu KAIDLY kontole lisati sisselogimisviis", heading: "Lisati uus sisselogimisviis", body: ["Sinu KAIDLY kontoga ({{ .Email }}) seoti sisselogimisviis: {{ .Provider }}."], note: "Kui sina seda ei teinud, taasta kohe ligipääs oma kontole." },
    en: { subject: "A sign-in method was added to your KAIDLY account", heading: "A sign-in method was added", body: ["A sign-in method was linked to your KAIDLY account ({{ .Email }}): {{ .Provider }}."], note: "If this wasn't you, recover access to your account right away." },
    ru: { subject: "К учётной записи KAIDLY добавлен способ входа", heading: "Добавлен способ входа", body: ["К вашей учётной записи KAIDLY ({{ .Email }}) привязан способ входа: {{ .Provider }}."], note: "Если это были не вы, немедленно восстановите доступ к учётной записи." },
  },
  identity_unlinked_notification: {
    kind: "notification",
    active: false,
    unused: "external sign-in providers are not used",
    et: { subject: "Sinu KAIDLY kontolt eemaldati sisselogimisviis", heading: "Sisselogimisviis eemaldati", body: ["Sinu KAIDLY kontolt ({{ .Email }}) eemaldati sisselogimisviis: {{ .Provider }}."], note: "Kui sina seda ei teinud, taasta kohe ligipääs oma kontole." },
    en: { subject: "A sign-in method was removed from your KAIDLY account", heading: "A sign-in method was removed", body: ["A sign-in method was removed from your KAIDLY account ({{ .Email }}): {{ .Provider }}."], note: "If this wasn't you, recover access to your account right away." },
    ru: { subject: "Из учётной записи KAIDLY удалён способ входа", heading: "Способ входа удалён", body: ["Из вашей учётной записи KAIDLY ({{ .Email }}) удалён способ входа: {{ .Provider }}."], note: "Если это были не вы, немедленно восстановите доступ к учётной записи." },
  },
  mfa_factor_enrolled_notification: {
    kind: "notification",
    active: false,
    unused: "multi-factor authentication is not used yet",
    et: { subject: "Sinu KAIDLY kontole lisati kinnitusviis", heading: "Lisati kinnitusviis", body: ["Sinu KAIDLY kontole ({{ .Email }}) lisati kinnitusviis: {{ .FactorType }}."], note: "Kui sina seda ei teinud, taasta kohe ligipääs oma kontole." },
    en: { subject: "A verification method was added to your KAIDLY account", heading: "A verification method was added", body: ["A verification method was added to your KAIDLY account ({{ .Email }}): {{ .FactorType }}."], note: "If this wasn't you, recover access to your account right away." },
    ru: { subject: "К учётной записи KAIDLY добавлен способ подтверждения", heading: "Добавлен способ подтверждения", body: ["К вашей учётной записи KAIDLY ({{ .Email }}) добавлен способ подтверждения: {{ .FactorType }}."], note: "Если это были не вы, немедленно восстановите доступ к учётной записи." },
  },
  mfa_factor_unenrolled_notification: {
    kind: "notification",
    active: false,
    unused: "multi-factor authentication is not used yet",
    et: { subject: "Sinu KAIDLY kontolt eemaldati kinnitusviis", heading: "Kinnitusviis eemaldati", body: ["Sinu KAIDLY kontolt ({{ .Email }}) eemaldati kinnitusviis: {{ .FactorType }}."], note: "Kui sina seda ei teinud, taasta kohe ligipääs oma kontole." },
    en: { subject: "A verification method was removed from your KAIDLY account", heading: "A verification method was removed", body: ["A verification method was removed from your KAIDLY account ({{ .Email }}): {{ .FactorType }}."], note: "If this wasn't you, recover access to your account right away." },
    ru: { subject: "Из учётной записи KAIDLY удалён способ подтверждения", heading: "Способ подтверждения удалён", body: ["Из вашей учётной записи KAIDLY ({{ .Email }}) удалён способ подтверждения: {{ .FactorType }}."], note: "Если это были не вы, немедленно восстановите доступ к учётной записи." },
  },
};

const p = (text, extra = "") =>
  `<p style="margin:0 0 14px;font-family:${FONT};font-size:16px;line-height:1.55;color:${C.muted};${extra}">${text}</p>`;

/** The visible part for one language (no Go conditionals inside). */
function block(name, lang) {
  const t = TEMPLATES[name];
  const s = t[lang];
  const parts = [
    `<h1 style="margin:0 0 14px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:${C.ink};">${s.heading}</h1>`,
    ...s.body.map((line) => p(line, line.includes("<strong>") ? `color:${C.ink};word-break:break-all;` : "")),
  ];
  if (t.code) {
    parts.push(
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 22px;"><tr><td style="background:${C.fill};border:1px solid ${C.line};border-radius:6px;padding:16px 22px;font-family:'SFMono-Regular',Menlo,Consolas,'Courier New',monospace;font-size:30px;line-height:1;font-weight:700;letter-spacing:6px;color:${C.ink};">${t.code}</td></tr></table>`,
    );
  }
  if (t.cta && s.cta) {
    parts.push(
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 18px;"><tr><td style="border-radius:4px;background:${C.volt};"><a href="${t.cta.href}" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1.2;color:${C.green};text-decoration:none;border-radius:4px;">${s.cta}</a></td></tr></table>`,
      `<p style="margin:0 0 6px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${fallbackLabel[lang]}</p>`,
      `<p style="margin:0 0 18px;font-family:${FONT};font-size:13px;line-height:1.5;word-break:break-all;"><a href="${t.cta.href}" style="color:${C.green};text-decoration:underline;">${t.cta.href}</a></p>`,
    );
  }
  parts.push(
    `<p style="margin:18px 0 0;padding-top:16px;border-top:1px solid ${C.line};font-family:${FONT};font-size:14px;line-height:1.5;color:${C.muted};">${s.note}</p>`,
  );
  return parts.join("\n            ");
}

function shell(inner, lang) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};">
  <tr>
    <td align="center" style="padding:28px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${C.card};border:1px solid ${C.line};border-radius:6px;">
        <tr><td style="height:4px;line-height:4px;font-size:0;background:${C.volt};border-radius:6px 6px 0 0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:22px 28px 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td width="12" height="24" bgcolor="${C.volt}" style="width:12px;height:24px;background:${C.volt};font-size:0;line-height:0;">&nbsp;</td>
              <td width="10" style="width:10px;font-size:0;line-height:0;">&nbsp;</td>
              <td style="vertical-align:middle;font-family:${FONT};font-size:20px;font-weight:800;letter-spacing:1px;color:${C.green};">KAIDLY</td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 28px;">
            ${inner}
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td style="padding:16px 8px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};text-align:center;">
            <strong style="color:${C.green};">KAIDLY</strong> · ${footer[lang]} · <a href="https://kaidly.ee" style="color:${C.green};text-decoration:none;">kaidly.ee</a><br>${autoNote[lang]}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

const PREAMBLE = '{{ $l := "et" }}{{ with .Data }}{{ with .locale }}{{ $l = . }}{{ end }}{{ end }}';

/** Go template choosing one of the three language variants (Estonian by default). */
function localized(render) {
  return `${PREAMBLE}{{ if eq $l "en" }}\n${render("en")}\n{{ else if eq $l "ru" }}\n${render("ru")}\n{{ else }}\n${render("et")}\n{{ end }}`;
}

export function templateHtml(name) {
  const t = TEMPLATES[name];
  const head = `<!-- KAIDLY ${t.kind === "auth" ? "auth" : "security notification"} e-mail "${name}" — GENERATED by scripts/email-templates.mjs; edit there.
     Supabase Dashboard → Authentication → Emails (${t.kind === "auth" ? "Templates" : "Security notifications"}) → ${name}. Subject: see docs/EMAIL_TEMPLATES.md. -->\n`;
  return head + localized((lang) => shell(block(name, lang), lang)) + "\n";
}

const NOTIFICATION_KEY = (name) => name.replace(/_notification$/, "");

/** Local stack wiring (supabase/config.toml, between the markers) — same files and subjects as production. */
export function configToml() {
  const lines = ["# >>> KAIDLY e-mail templates — GENERATED by scripts/email-templates.mjs (docs/EMAIL_TEMPLATES.md)"];
  for (const [name, t] of Object.entries(TEMPLATES)) {
    if (t.kind === "auth") lines.push(`[auth.email.template.${name}]`);
    else lines.push(`[auth.email.notification.${NOTIFICATION_KEY(name)}]`, `enabled = ${t.active}`);
    lines.push(`subject = ${JSON.stringify(templateSubject(name))}`, `content_path = "./supabase/templates/${name}.html"`, "");
  }
  lines.push("# <<< KAIDLY e-mail templates");
  return lines.join("\n");
}

export function templateSubject(name) {
  const t = TEMPLATES[name];
  return `${PREAMBLE}{{ if eq $l "en" }}${t.en.subject}{{ else if eq $l "ru" }}${t.ru.subject}{{ else }}${t.et.subject}{{ end }}`;
}

/** Fake values for previews — obviously not real. */
const MOCK = {
  "{{ .SiteURL }}": "https://kaidly.ee",
  "{{ .TokenHash }}": "pREVIEW0000fake0000tokenHash0000example",
  "{{ .Token }}": "123456",
  "{{ .NewEmail }}": "uus.aadress@example.invalid",
  "{{ .Email }}": "kasutaja@example.invalid",
  "{{ .OldEmail }}": "vana.aadress@example.invalid",
  "{{ .Provider }}": "Google",
  "{{ .FactorType }}": "TOTP",
};

export function preview(name, lang) {
  let html = shell(block(name, lang), lang);
  for (const [k, v] of Object.entries(MOCK)) html = html.replaceAll(k, v);
  const subject = Object.entries(MOCK).reduce((s, [k, v]) => s.replaceAll(k, v), TEMPLATES[name][lang].subject);
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head><body style="margin:0;padding:0;background:#E7E5E1;">${html}</body></html>`;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain && process.argv.includes("--subjects")) {
  // Copy/paste for the Supabase dashboard "Subject" fields.
  for (const name of Object.keys(TEMPLATES)) console.log(`${name}\n${templateSubject(name)}\n`);
} else if (isMain) {
  const dir = new URL("../supabase/templates/", import.meta.url);
  for (const name of Object.keys(TEMPLATES)) writeFileSync(new URL(`${name}.html`, dir), templateHtml(name));
  console.log(`wrote ${Object.keys(TEMPLATES).length} templates to supabase/templates/`);
  const configPath = new URL("../supabase/config.toml", import.meta.url);
  const config = readFileSync(configPath, "utf8");
  const block = /# >>> KAIDLY e-mail templates[\s\S]*?# <<< KAIDLY e-mail templates/;
  if (!block.test(config)) throw new Error("config.toml: KAIDLY e-mail template markers missing");
  writeFileSync(configPath, config.replace(block, configToml()));
  console.log("updated supabase/config.toml (local stack)");
  if (process.argv.includes("--preview")) {
    const out = new URL("../.email-preview/", import.meta.url);
    mkdirSync(out, { recursive: true });
    for (const name of Object.keys(TEMPLATES)) for (const lang of LANGS) writeFileSync(new URL(`${name}.${lang}.html`, out), preview(name, lang));
    console.log("previews (fake values) in .email-preview/ — local only");
  }
}
