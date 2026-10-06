import { createUser, expect, field, login, sql, test } from "./support/fixtures";

// Account-security e-mails end to end on the local stack (real Supabase Auth, KAIDLY
// templates from supabase/templates via config.toml, Mailpit), with Secure password change
// ON as intended for Production: password recovery, e-mail change with both
// confirmations, and the two security notifications.

type Mail = { ID: string; Subject: string; HTML: string; Text: string; To: { Address: string }[] };

async function mailTo(to: string, subject: RegExp): Promise<Mail> {
  const mailpit = process.env.E2E_MAILPIT_URL;
  if (!mailpit) throw new Error("Mailpit URL missing");
  let found: Mail | null = null;
  await expect
    .poll(async () => {
      const search = await (await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json();
      // Exact recipient: a search for a@x also matches new-a@x.
      const hit = search.messages?.find(
        (m: { Subject: string; To: { Address: string }[] }) => subject.test(m.Subject) && m.To.some((t) => t.Address === to),
      );
      found = hit ? await (await fetch(`${mailpit}/api/v1/message/${hit.ID}`)).json() : null;
      return found !== null;
    })
    .toBe(true);
  return found as unknown as Mail;
}

/** KAIDLY template checks shared by every account-security mail. */
function expectKaidlyMail(mail: Mail) {
  expect(mail.HTML).toContain(">KAIDLY<");
  expect(mail.HTML).not.toMatch(/\{\{|<no value>|<img\b|utm_|track|pixel/i);
  // Local Site URL is the :3000 dev server; Production renders https://kaidly.ee.
  for (const [, host] of mail.HTML.matchAll(/https?:\/\/([^/"'\s<>]+)/g)) expect(["localhost:3000", "kaidly.ee"]).toContain(host);
}

/** The KAIDLY /auth/confirm link of a mail, as a path on the test server. */
function confirmPath(mail: Mail): string {
  const link = /https?:\/\/[^"'\s<>]+\/auth\/confirm\?token_hash=[^"'\s<>]+/.exec(mail.HTML)?.[0];
  if (!link) throw new Error("no /auth/confirm link");
  const url = new URL(link.replaceAll("&amp;", "&"));
  return url.pathname + url.search;
}

test.describe("Konto turvakirjad", () => {
  test("password recovery: KAIDLY mail, link sets a new password, then the security notification", async ({ page }) => {
    const user = await createUser("Parooli Taastaja");
    await page.goto("/auth/forgot-password");
    await page.waitForLoadState("networkidle");
    await field(page, "email").fill(user.email);
    await page.getByRole("button", { name: "Saada link" }).click();
    await expect(page.getByText("Kontrolli oma e-posti")).toBeVisible();

    const recovery = await mailTo(user.email, /^KAIDLY parooli taastamine$/);
    expectKaidlyMail(recovery);
    expect(recovery.HTML).toContain("Muuda parooli");
    const path = confirmPath(recovery);
    expect(path).toMatch(/^\/auth\/confirm\?token_hash=[^&]+&type=recovery&next=\/auth\/update-password$/);

    await page.goto(path);
    await expect(page).toHaveURL(/\/auth\/update-password$/);
    const newPassword = "Taastatud-Parool-2026";
    await field(page, "password").fill(newPassword);
    await page.getByRole("button", { name: "Salvesta parool" }).click();
    await expect(page).toHaveURL(/\/o(\?.*)?$/);

    const notice = await mailTo(user.email, /^Sinu KAIDLY parool muudeti$/);
    expectKaidlyMail(notice);
    expect(notice.HTML).toContain(user.email);
    expect(notice.HTML).not.toContain(newPassword);

    // The recovery link is single-use.
    await page.goto(path);
    await expect(page).toHaveURL(/\/auth\/error\?code=/);
  });

  test("e-mail change: both addresses confirm, the old one is notified, in the user's language", async ({ page }) => {
    const user = await createUser("Address Changer");
    sql(`update auth.users set raw_user_meta_data = raw_user_meta_data || '{"locale":"en"}' where id = '${user.id}'`);
    await login(page, user, "/konto");
    const next = `new-${user.email}`;
    await field(page, "email").fill(next);
    await page.getByRole("button", { name: "Muuda e-posti aadressi" }).click();
    await expect(page.getByText(/Uus e-posti aadress tuleb kinnitada\./)).toBeVisible();

    // Secure e-mail change: a confirmation to the current and to the new address.
    const subject = /^Confirm your new KAIDLY email address$/;
    const [toOld, toNew] = [await mailTo(user.email, subject), await mailTo(next, subject)];
    for (const mail of [toOld, toNew]) {
      expectKaidlyMail(mail);
      expect(mail.HTML).toContain(next); // {{ .NewEmail }}
      expect(confirmPath(mail)).toMatch(/&type=email_change&next=\/konto$/);
    }

    await page.goto(confirmPath(toOld));
    expect(sql(`select email from auth.users where id = '${user.id}'`)).toBe(user.email); // one of two
    await page.goto(confirmPath(toNew));
    await expect.poll(() => sql(`select email from auth.users where id = '${user.id}'`)).toBe(next);

    const notice = await mailTo(user.email, /^Your KAIDLY email address was changed$/);
    expectKaidlyMail(notice);
    expect(notice.HTML).toContain(user.email);
    expect(notice.HTML).toContain(next);
  });

  test("password change after the reauthentication code triggers the security notification", async ({ page }) => {
    const user = await createUser("Koodi Teavitus");
    await login(page, user, "/konto");
    sql(`update auth.sessions set created_at = now() - interval '25 hours' where user_id = '${user.id}'`);
    await field(page, "currentPassword").fill(user.password);
    await field(page, "newPassword").fill("Koodiga-Muudetud-2026");
    await field(page, "confirmPassword").fill("Koodiga-Muudetud-2026");
    await page.getByRole("button", { name: "Muuda parooli" }).click();

    const codeMail = await mailTo(user.email, /^\d{6} on sinu KAIDLY kinnituskood$/);
    expectKaidlyMail(codeMail);
    const code = /^(\d{6})/.exec(codeMail.Subject)![1];
    expect(codeMail.HTML).toContain(code);
    expect(codeMail.HTML).not.toContain("/auth/confirm"); // a code, no link

    await field(page, "nonce").fill(code);
    await page.getByRole("button", { name: "Kinnita" }).click();
    await expect(page.getByText(/Parool muudetud\./)).toBeVisible();
    const notice = await mailTo(user.email, /^Sinu KAIDLY parool muudeti$/);
    expectKaidlyMail(notice);
  });
});
