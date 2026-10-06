# KAIDLY — Auth and account-security e-mails

All e-mails are sent by **Supabase Auth** (KAIDLY itself sends no e-mail). The templates are
generated from one source, `scripts/email-templates.mjs`, into `supabase/templates/*.html`
and pasted into the Supabase dashboard. Never edit the HTML files by hand.

```bash
node scripts/email-templates.mjs             # regenerate templates + local config.toml block
node scripts/email-templates.mjs --subjects  # one-line subjects for the dashboard
node scripts/email-templates.mjs --preview   # + .email-preview/<template>.<et|en|ru>.html (fake values, gitignored)
npm test                                     # tests/unit/email-templates.test.ts
```

## 1. Templates

| File (`supabase/templates/`) | Dashboard (Authentication → Emails) | Status | Link / content |
|---|---|---|---|
| `confirmation.html` | Templates → **Confirm sign up** | **active** | `/auth/confirm?token_hash=…&type=email&next=/o` |
| `recovery.html` | Templates → **Reset password** | **active** | `…&type=recovery&next=/auth/update-password` |
| `email_change.html` | Templates → **Change email address** | **active** | `…&type=email_change&next=/konto`, shows `{{ .NewEmail }}` |
| `reauthentication.html` | Templates → **Reauthentication** | ready; used once *Secure password change* is on (§6) | 6-digit code `{{ .Token }}`, no link |
| `invite.html` | Templates → **Invite user** | ready, not used | `…&type=invite&next=/auth/update-password` |
| `magic_link.html` | Templates → **Magic link** | ready, not used | `…&type=magiclink&next=/o` |
| `password_changed_notification.html` | Security notifications → **Password changed** | **enable** | `{{ .Email }}`; link to `/auth/forgot-password` |
| `email_changed_notification.html` | Security notifications → **Email address changed** | **enable** | `{{ .OldEmail }} → {{ .Email }}` (sent to the old address) |
| `phone_changed_notification.html` | Security notifications → **Phone number changed** | keep **disabled** (no phone sign-in) | `{{ .Email }}` |
| `identity_linked_notification.html` | → **Identity linked** | keep **disabled** (no OAuth) | `{{ .Provider }}` |
| `identity_unlinked_notification.html` | → **Identity unlinked** | keep **disabled** | `{{ .Provider }}` |
| `mfa_factor_enrolled_notification.html` | → **MFA method added** | keep **disabled** (no MFA) | `{{ .FactorType }}` |
| `mfa_factor_unenrolled_notification.html` | → **MFA method removed** | keep **disabled** | `{{ .FactorType }}` |

KAIDLY company invitations are copyable links inside the app, not Supabase invites —
`invite.html` is therefore generic (no company name: Supabase has no authorised, escaped
company name to offer) and only exists so a dashboard invite never sends the default mail.

**Why `/auth/confirm?token_hash=…` instead of `{{ .ConfirmationURL }}`:** the default link
goes through the Supabase domain and only works in the browser that started the flow (PKCE).
KAIDLY's own route (`app/auth/confirm/route.ts`) verifies the hash server-side with
`verifyOtp`, works in any browser, keeps the visible link on kaidly.ee, sends recovery
always to `/auth/update-password` and validates `next` with `safeRedirectPath`.

## 2. Subjects

| Template | ET (default) | EN | RU |
|---|---|---|---|
| confirmation | Kinnita oma KAIDLY konto | Confirm your KAIDLY account | Подтвердите учётную запись KAIDLY |
| recovery | KAIDLY parooli taastamine | Reset your KAIDLY password | Восстановление пароля KAIDLY |
| email_change | Kinnita KAIDLY e-posti aadressi muutmine | Confirm your new KAIDLY email address | Подтвердите смену адреса почты в KAIDLY |
| reauthentication | `{{ .Token }}` on sinu KAIDLY kinnituskood | `{{ .Token }}` is your KAIDLY verification code | `{{ .Token }}` — ваш код подтверждения KAIDLY |
| invite | Sind kutsuti KAIDLYsse | You've been invited to KAIDLY | Вас пригласили в KAIDLY |
| magic_link | KAIDLY sisselogimislink | Your KAIDLY sign-in link | Ссылка для входа в KAIDLY |
| password_changed | Sinu KAIDLY parool muudeti | Your KAIDLY password was changed | Пароль KAIDLY изменён |
| email_changed | Sinu KAIDLY e-posti aadress muudeti | Your KAIDLY email address was changed | Адрес почты KAIDLY изменён |
| phone_changed | Sinu KAIDLY telefoninumber muudeti | Your KAIDLY phone number was changed | Номер телефона KAIDLY изменён |
| identity_linked | Sinu KAIDLY kontole lisati sisselogimisviis | A sign-in method was added to your KAIDLY account | К учётной записи KAIDLY добавлен способ входа |
| identity_unlinked | Sinu KAIDLY kontolt eemaldati sisselogimisviis | A sign-in method was removed from your KAIDLY account | Из учётной записи KAIDLY удалён способ входа |
| mfa_factor_enrolled | Sinu KAIDLY kontole lisati kinnitusviis | A verification method was added to your KAIDLY account | К учётной записи KAIDLY добавлен способ подтверждения |
| mfa_factor_unenrolled | Sinu KAIDLY kontolt eemaldati kinnitusviis | A verification method was removed from your KAIDLY account | Из учётной записи KAIDLY удалён способ подтверждения |

The dashboard Subject field gets the **one-line conditional** printed by
`node scripts/email-templates.mjs --subjects` (same language logic as the body), e.g.:

```
{{ $l := "et" }}{{ with .Data }}{{ with .locale }}{{ $l = . }}{{ end }}{{ end }}{{ if eq $l "en" }}Confirm your KAIDLY account{{ else if eq $l "ru" }}Подтвердите учётную запись KAIDLY{{ else }}Kinnita oma KAIDLY konto{{ end }}
```

## 3. Language

Every template and subject starts with

```
{{ $l := "et" }}{{ with .Data }}{{ with .locale }}{{ $l = . }}{{ end }}{{ end }}
```

and renders `en`, `ru` or (anything else, missing, empty) **Estonian**. `.Data` is the Auth
user metadata. The key **`locale`** is new and written only by KAIDLY:

- at sign-up: `signUp({ options: { data: { full_name, locale } } })` with the UI language;
- on language change (`setLocale`) and after sign-in (`syncLocale`, which also backfills older
  accounts from `profiles.preferred_locale`) via `auth.updateUser({ data: { locale } })`.

Only `et`/`en`/`ru` are written by the app. A user can set their own metadata through the Auth
API, but the value is never printed — it only selects one of three fixed texts, so a crafted
value falls back to Estonian. `profiles.preferred_locale` stays the source for the UI.
Accounts created before this change get Estonian until they sign in once.

Verified on the local stack (real GoTrue + Mailpit): sign-up with no / `en` / `ru` / `xx`
metadata → ET / EN / RU / ET; recovery, reauthentication code, password-changed, both
email-change mails and the email-changed notification all rendered in the user's language,
no unrendered placeholders.

## 4. Design and content rules

- Table layout, inline styles only, no web fonts, no CSS blocks, max width 560 px, fluid
  below that (checked at 375 px: no horizontal scroll). Light theme colours from DESIGN.md:
  paper `#E7E5E1`, white card, line `#D6D3CD`, deep green `#0F3D32`, volt `#22D07A` button
  with deep-green text (contrast 6.0:1), body ink `#111827` / `#4B5563`.
- Header: **no images**. A small volt-green block (a table cell with `bgcolor`) beside the
  bold deep-green text wordmark **KAIDLY**. The first real Production message (iCloud Mail,
  2026-10-06) showed the remote logo `https://kaidly.ee/email/kaidly-mark.png` as a broken
  image, although the file serves correctly (200, `image/png`, 180×180 PNG, no auth or
  redirect). A text header cannot break and looks the same with images blocked. Tests forbid
  `<img>`, SVG, `data:` URLs and CSS background images in every template. The PNG stays in
  `public/email/` only so copies pasted before this change keep working.
- Every link button has the same URL as a plain visible fallback link that wraps
  (`word-break: break-all`).
- Footer: **KAIDLY · Elektripaigaldise käit. Lihtsalt. · kaidly.ee** (translated tagline in
  EN/RU, as on the website) and an "automatic account message" line. No legal company data
  (operator details are still TBA), no unsubscribe link (these are mandatory security mails).
- Content: account-level placeholders only (`SiteURL, TokenHash, Token, NewEmail, Email,
  OldEmail, Provider, FactorType`); no company, site, installation, log or document data;
  user metadata is never printed.
- **No tracking:** no pixels, no redirectors, no UTM or other parameters; the only host is
  kaidly.ee. Keep **open and click tracking OFF** at the e-mail provider (Resend → Domains →
  Tracking) — click tracking would rewrite the token links through a third-party host.

## 5. Sender

| Mails | From |
|---|---|
| All Supabase Auth mails (templates + security notifications) | `KAIDLY <no-reply@kaidly.ee>` (Supabase SMTP settings: sender email `no-reply@kaidly.ee`, sender name `KAIDLY`) |
| Deadline reminder e-mails (optional, per-user setting; sent by the database outbox through the Resend API — docs/EMAIL_NOTIFICATIONS.md) | `KAIDLY <notifications@kaidly.ee>` |

Supabase has one sender per project, so the security notifications also come from
`no-reply@`. SMTP credentials are entered only in the dashboard (DEPLOYMENT.md §5).

## 6. Install in Production (manual — dashboard)

No Management API token is configured for this repository, and `supabase config push` would
also push local values (e.g. `site_url = http://localhost:3000`), so **do not** use it.

Production project **`xakpbtmksxvjmsbipwmj`** → Authentication → Emails:

1. **Templates** tab — for each row: open the template, paste the subject from
   `node scripts/email-templates.mjs --subjects`, switch the body to source/HTML, replace it
   with the whole file content, Save.

   | Dashboard template | File |
   |---|---|
   | Confirm sign up | `supabase/templates/confirmation.html` |
   | Invite user | `supabase/templates/invite.html` |
   | Magic link | `supabase/templates/magic_link.html` |
   | Change email address | `supabase/templates/email_change.html` |
   | Reset password | `supabase/templates/recovery.html` |
   | Reauthentication | `supabase/templates/reauthentication.html` |

2. **Security notifications** tab (same paste procedure):
   - Password changed → `password_changed_notification.html` → **enable**
   - Email address changed → `email_changed_notification.html` → **enable**
   - Phone number changed, Identity linked/unlinked, MFA method added/removed → paste the
     matching `*_notification.html` but leave them **disabled**.
3. Check Authentication → URL Configuration: Site URL `https://kaidly.ee` (the links are built
   from it).
4. Test (needs working SMTP; with the built-in sender only team-member addresses receive mail):
   - sign up on kaidly.ee with a test address in EN → English mail, link opens kaidly.ee and
     lands in `/o`;
   - "Unustasid parooli?" → Estonian mail → link opens "Uus parool";
   - Konto → change e-mail → both addresses get a mail; confirm both → old address gets
     "e-posti aadress muudeti";
   - change password → "parool muudeti" mail.
   - In each mail: the KAIDLY header (green block + wordmark) shows, no broken image, no tracking host in
     the links, no `{{` left anywhere.

### Secure password change

The app supports it (2026-10-06): when Supabase answers a password change with
`reauthentication_needed` (session older than 24 h), KAIDLY calls `reauthenticate()` —
Supabase sends the **Reauthentication** mail with the code — and shows "Kinnita, et see oled
sina" with a code field, "Saada uus kood" (60 s cooldown) and "Katkesta". The same form then
submits `updateUser({ password, nonce })`; Supabase verifies the code. Wrong or expired codes
show one neutral message; KAIDLY never stores or logs the code. Recent sessions (< 24 h) change
the password directly, as before. E2E: `e2e/account-email.spec.ts` (local stack runs with the
setting on).

Enable in Production only after the Reauthentication template is pasted and one real code
has worked:

1. Sign in on kaidly.ee, Konto → change password once with the setting still **off** (works
   directly) — confirms the form is deployed.
2. **Authentication → Providers → Email → Secure password change → ON → Save.**
3. Test with a session older than 24 h (or sign in on a device you used yesterday): Konto →
   change password → "Kinnita, et see oled sina" → the code from the KAIDLY mail → "Parool
   muudetud". If anything fails, switch it **off** again (nothing else depends on it).

### Regression guard — release check

Supabase hosted templates are **not** deployed from git: a new project, a dashboard reset or a
`supabase config push` can silently bring back Supabase's default mails. Every release:
**trigger one Production Auth e-mail (e.g. "Unustasid parooli?" for your own address) and
visually confirm the KAIDLY template** (green block + KAIDLY wordmark, Estonian text, link to
`https://kaidly.ee/auth/confirm?...`). Listed in RELEASE_CHECKLIST.md and
MANUAL_SMOKE_TEST.md.

## 7. Local stack

`supabase/config.toml` contains a generated block (`# >>> KAIDLY e-mail templates`) with the
same files and subjects, so local mails (Mailpit, http://127.0.0.1:54324) look like
Production. After regenerating, restart the stack (`npx supabase stop && npx supabase start`).
The local Site URL is `http://localhost:3000`; the E2E suite keeps only the path of the link.
