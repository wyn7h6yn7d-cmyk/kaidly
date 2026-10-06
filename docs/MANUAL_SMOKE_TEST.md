# KAIDLY — Manual smoke test after a release (~15 minutes)

Use your own account on https://kaidly.ee and the test company "KAIDLY Prelaunch Test"
(small; no real customer data). Tick each line.

**Public (3 min)**
- [ ] `https://kaidly.ee/api/health` → `app/auth/storage: ok`, `version` = the released commit
- [ ] Landing loads; hero drawing and handwritten tagline look right; ET / EN / RU switch
- [ ] `http://kaidly.ee` and `https://www.kaidly.ee` → `https://kaidly.ee`
- [ ] Privacy and terms show the pre-launch notice

**Auth (2 min)**
- [ ] Log in (password reveal works); wrong password shows "Vale e-post või parool."
- [ ] Log out; the back button then a reload sends you to the login page

**E-mail (2 min)**
- [ ] "Unustasid parooli?" with your own address → the mail shows the **KAIDLY template**
      (green block + KAIDLY wordmark), not Supabase's default; the link opens kaidly.ee
- [ ] Konto → Teavitused: "Tähtaegade e-posti teavitused" shows your setting

**App (5 min)**
- [ ] Overview shows the trial banner and real items
- [ ] Open a site → installation → add a log entry with a photo from the phone
- [ ] Add a deficiency from the installation's quick actions; resolve it
- [ ] Complete a plan activity → "Järgmine tähtaeg: …" appears
- [ ] Bell → notification → "Vaata tegevust" opens the activity
- [ ] Search for the installation identifier

**Files and reports (2 min)**
- [ ] Open and download a document
- [ ] Reports → Käidupäevik → PDF and CSV download and open

**Import (1 min)**
- [ ] Seaded → Andmete import → objects template → 1-row file → imported

**Admin (1 min)**
- [ ] `/admin` overview, companies, deadlines load

**Mobile (1 min, phone)**
- [ ] Overview and the new-entry form fit the screen; the save button is reachable

**Logs**
- [ ] Vercel → Production logs: no errors or 5xx since the release
