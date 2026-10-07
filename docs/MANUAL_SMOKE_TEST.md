# KAIDLY — Manual smoke test (Production, ~15 minutes)

Run after every Production release, on https://kaidly.ee. Tick each line; **expected result
after the arrow**. Nothing here deletes data. Use test accounts and test companies only —
never a customer's company.

**Accounts you need**

| | Account | Used for |
|---|---|---|
| A | Your platform-admin account (kennethalto95@gmail.com) | Platform admin, Access |
| B | A **new** address each time, e.g. `kennethalto95+smoke-YYYYMMDD@gmail.com` | Fresh user (uses that address's one personal trial — that is the point) |
| C | A second test address you can receive mail at | Viewer role (Access) |

Name test companies `KAIDLY Smoke YYYY-MM-DD` so they are easy to find in `/admin`.
Afterwards: leave them (they hold history) or end their access in Tellimused — never delete
a company with history.

---

## 1. Public (3 min) — signed out, private window

Desktop (≥ 1024 px):
- [ ] `https://kaidly.ee/api/health` → `{"app":"ok","auth":"ok","storage":"ok","version":"<first 12 chars of the released commit>"}`
- [ ] Landing loads → title tab "KAIDLY | Elektripaigaldise digitaalne käidupäevik"; hero "Elektripaigaldise käit. Lihtsalt."; "14 päeva tasuta" under the hero buttons, **not** in the header
- [ ] **Header** → left: KAIDLY logo, "Kuidas töötab?", "Hinnakiri"; right: "Logi sisse", green "Registreeru", ET / EN / RU
- [ ] Click **Kuidas töötab?** → smooth scroll to "Üks objekt. Kõik, mis selle käiduga juhtub."; address bar stays `https://kaidly.ee/` (no `#…`)
- [ ] Click **Hinnakiri** → scroll to the pricing section; address bar stays `https://kaidly.ee/`
- [ ] Pricing → Start 19 € (1 user / 5 installations), Team 29 € (3 / 10), Pro 39 € (5 / 25, "Kõige populaarsem"), Business 89 € (15 / 100), "Vajad rohkem?" (Custom); "€ / kuu + KM"; **no** credit-card wording anywhere
- [ ] Open `https://kaidly.ee/#hinnad` directly → lands on pricing, then the address bar shows `https://kaidly.ee/`
- [ ] **Registreeru** → `/auth/sign-up` ("Loo konto" form); back; **Logi sisse** → `/auth/login`
- [ ] Switch **EN** → "How does it work?", "Pricing", "Sign in", "Sign up"; **RU** → "Как это работает?", "Цены", "Войти", "Регистрация"; back to **ET**
- [ ] Phone (or a window narrower than 1024 px) → header shows logo, **"Logi sisse"**, ET and a menu button on one row; the menu lists "Kuidas töötab?", "Hinnakiri" and green "Registreeru"; **Hinnakiri** scrolls to pricing, closes the menu and leaves no `#…`; Escape closes it
- [ ] Footer → "Kuidas töötab?", "Hinnakiri", "Logi sisse", "Registreeru", Privaatsus, Kasutustingimused, ET/EN/RU
- [ ] Privaatsus / Kasutustingimused → visible pre-launch notice (draft until operator details exist)

Phone (or browser at 375 px):
- [ ] Header → logo, "Logi sisse", language select; no sideways scrolling anywhere on the page
- [ ] Hero shows "Loo konto" and "Vaata, kuidas töötab"; footer has all four links; Hinnakiri in the footer scrolls to pricing with a clean URL

Redirects, crawlers:
- [ ] `http://kaidly.ee` and `https://www.kaidly.ee` → `https://kaidly.ee/`
- [ ] `https://kaidly.ee/olematu-leht` → KAIDLY 404 page (not a login redirect)
- [ ] `https://kaidly.ee/robots.txt` → allows `/`, `/privaatsus`, `/kasutustingimused`; disallows `/o`, `/admin`, `/konto`, `/auth`, `/invite`, `/otsing`, `/teavitused`, `/api`; `Sitemap: https://kaidly.ee/sitemap.xml`
- [ ] `https://kaidly.ee/sitemap.xml` → exactly one URL: `https://kaidly.ee/`
- [ ] Google Search Console → Pages: homepage indexed, no new errors; Bing Webmaster → URL inspection `https://kaidly.ee/` indexable (the `/auth/*` robots block is intentional)

## 2. Fresh user (6 min) — account B, phone if possible

- [ ] Registreeru → name, address B, password (≥ 10 chars) → "Kontrolli oma e-posti"
- [ ] Mail arrives within ~1 min → **KAIDLY template** (green block + wordmark, Estonian), sender `no-reply@kaidly.ee`, link to `https://kaidly.ee/auth/confirm?...` → opens KAIDLY signed in
- [ ] Log out, log in again with B → lands on the companies page / onboarding
- [ ] "Loo ettevõte" → page says the new company gets **14 päeva tasuta** (1 user, up to 5 active installations) → create `KAIDLY Smoke YYYY-MM-DD`
- [ ] Seaded → **Pakett** → status "Prooviperiood", users 1 / 1, installations 0 / 5, "Prooviperiood kuni <date 14 days ahead>", links to Hinnakiri and contact; no price shown
- [ ] Seaded → Liikmed → instead of the invitation form: "Prooviperioodil kasutab KAIDLYt üks kasutaja" → **1-user limit**
- [ ] "Lisa objekt" → one site; "Lisa paigaldis" ×5 (short names) → Pakett shows 5 / 5
- [ ] Try a 6th installation → "Prooviperioodil saab olla kuni 5 aktiivset elektripaigaldist" instead of the form → **5-installation limit**; archive one → the form is available again (edit an existing one works at the limit too)
- [ ] **Käidukava** → add an activity due in 3 days with a 7-day reminder → countdown shows; the bell shows a reminder
- [ ] **Käidupäevik** → new entry with a **Fotode link** (`https://…`, any folder) and a PDF → saved; the entry shows "Ava link" (opens in a new tab) and the PDF opens. The file picker offers no camera / images; choosing a JPG shows "Pilte KAIDLYsse üles ei laadita…"
- [ ] (only if the smoke company has an image from before 2026-10-08) **Kustuta pilt** → confirm → "Pilt on kustutatud.", the thumbnail is replaced by "Pilt kustutatud — name, time". Never test this on a customer's image
- [ ] **Puudused** → "Lisa puudus" → appears in the list and on the overview; resolve it with a description → resolved
- [ ] **Dokumendid** → upload a small PDF → opens (new tab) and downloads
- [ ] **Otsing** → search the installation name → found; a word from the log entry → found
- [ ] **Aruanded** → Käidupäevik → preview; PDF and CSV download and open; an empty period → empty report, no error
- [ ] **Teavitused** (bell) → the reminder → "Vaata tegevust" opens the activity
- [ ] **Konto → Teavitused** → "Tähtaegade e-posti teavitused" switch reflects your choice and stays after reload; with it on, the reminder e-mail arrives within ~5 min (generic text, no company/installation names, link to `https://kaidly.ee/teavitused`)
- [ ] Log out → back button + reload → login page; log in → data is there

## 3. Account security (3 min) — account B

- [ ] Signed out: "Unustasid parooli?" with address B → neutral confirmation; mail (KAIDLY template) → link → "Uus parool" → save → signed in
- [ ] Mail "parool muudeti" (security notice) arrives
- [ ] Konto → change password: with a session **< 24 h** it changes directly. With an older session (a device signed in yesterday): "Kinnita, et see oled sina" → code from the Reauthentication mail → "Parool muudetud" (**Secure password change**)
- [ ] Wrong code → one neutral error; "Saada uus kood" only after the cooldown

## 4. Platform admin (2 min) — account A

- [ ] `/admin` → overview loads; menu includes **Tellimused**
- [ ] Tellimused → search `KAIDLY Smoke` → the company from §2; filter status "Prooviperiood" / plan → it appears / disappears as expected
- [ ] Open it → plan, status, trial end, users 1 / 1, installations x / 5, history
- [ ] Plan select → choose **Custom** → name, price, user and installation limit fields appear → **Vaata üle** → summary (no save yet) → Cancel. (Activating a real plan for a test company is fine; it is audited.)
- [ ] Internal note → type "smoke test note" → save → visible here; sign in as B → Seaded → Pakett does **not** show the note, price or invoice reference
- [ ] `/admin/audit` → the note change appears with your name and time
- [ ] As account B open `https://kaidly.ee/admin` → ordinary 404 (non-admins never see admin)

## 5. Access (2 min) — needs ≥ 2 seats

The trial allows one user, so first in Tellimused give the smoke company **Team** for 1 month
(account A; audited, can be ended afterwards).

- [ ] B (owner) → Liikmed → invite address C as **Vaataja** → copy the invitation link
- [ ] C opens the link, signs up / in → sees the company; can open log, documents, reports; **no** add/edit buttons; a direct `/o/<slug>/objektid/uus` → not allowed
- [ ] C cannot see B's other companies; a made-up company slug → 404
- [ ] Expired / read-only: Tellimused → "Lõpeta ligipääs" on the smoke company → B sees the read-only banner, data readable, no add buttons; re-activate (Team, 1 month) → writable again. **Only on the smoke company.**

## 6. Logs (1 min)

- [ ] `npx vercel logs --environment production --since 30m --level error` → empty
- [ ] `npx vercel logs --environment production --since 30m --status-code 5xx` → empty
- [ ] Supabase → Logs → Auth / Postgres: no unexpected errors during the test
