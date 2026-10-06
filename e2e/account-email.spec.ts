import type { Page } from "@playwright/test";
import { createUser, expect, expectNoHorizontalScroll, field, login, sql, test, type TestUser } from "./support/fixtures";

type Mail = { ID: string; Subject: string; HTML: string; Text: string };

/** Newest local Mailpit message to `to` whose subject matches (null if none yet). */
async function newestMail(to: string, subject: RegExp): Promise<Mail | null> {
  const mailpit = process.env.E2E_MAILPIT_URL;
  if (!mailpit) throw new Error("Mailpit URL missing");
  const search = await (await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json();
  const hit = search.messages?.find((m: { Subject: string }) => subject.test(m.Subject));
  return hit ? (await fetch(`${mailpit}/api/v1/message/${hit.ID}`)).json() : null;
}

const CODE_SUBJECT = /^(\d{6}) on sinu KAIDLY kinnituskood$/;

/** Waits for a reauthentication e-mail other than `previous` and returns its code. */
async function reauthCode(to: string, previous?: string): Promise<{ id: string; code: string }> {
  let found: Mail | null = null;
  await expect
    .poll(async () => {
      found = await newestMail(to, CODE_SUBJECT);
      return found && found.ID !== previous ? found.ID : null;
    })
    .not.toBeNull();
  const mail = found as unknown as Mail;
  const code = CODE_SUBJECT.exec(mail.Subject)![1];
  expect(mail.HTML).toContain(code); // the code is in the body, not only the subject
  return { id: mail.ID, code };
}

/** Submits the code step and waits for the server action's answer (not just for any text). */
async function submitCode(page: Page) {
  const answered = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/konto");
  await page.getByRole("button", { name: "Kinnita" }).click();
  await answered;
}

/** Secure password change asks for a code once the session is older than 24 hours. */
function ageSessions(user: TestUser) {
  sql(`update auth.sessions set created_at = now() - interval '25 hours' where user_id = '${user.id}'`);
}

async function fillPasswords(page: Page, current: string, next: string) {
  await field(page, "currentPassword").fill(current);
  await field(page, "newPassword").fill(next);
  await field(page, "confirmPassword").fill(next);
}

test.describe("Parooli muutmine kinnituskoodiga", () => {
  test("old session: code e-mailed, wrong and expired codes refused, right code changes the password @responsive @cross-browser", async ({
    page,
  }) => {
    const user = await createUser("Koodiga Kinnitaja");
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.clock.install();
    await login(page, user, "/konto");
    ageSessions(user);
    const newPassword = "Uus-Kinnitatud-Parool-2026";

    await fillPasswords(page, user.password, newPassword);
    await page.getByRole("button", { name: "Muuda parooli" }).click();
    await expect(page.getByRole("heading", { name: "Kinnita, et see oled sina" })).toBeFocused();
    await expect(page.getByText("Saatsime sinu e-posti aadressile kinnituskoodi.")).toBeVisible();
    await expectNoHorizontalScroll(page);
    const first = await reauthCode(user.email);

    // Nothing changed yet; the typed passwords stay for the second step.
    await expect(field(page, "newPassword")).toHaveValue(newPassword);
    await expect(page.getByRole("button", { name: "Saada uus kood" })).toBeDisabled();
    await expect(page.getByText(/Uue koodi saad küsida \d+ sekundi pärast\./)).toBeVisible();

    // Wrong code.
    const wrong = first.code === "000000" ? "111111" : "000000";
    await field(page, "nonce").fill(wrong);
    await submitCode(page);
    await expect(page.getByText("Kood on vale või aegunud. Kontrolli koodi või küsi uus kood.")).toBeVisible();

    // Expired code (sent more than the OTP lifetime ago).
    sql(`update auth.users set reauthentication_sent_at = now() - interval '2 hours' where id = '${user.id}'`);
    await field(page, "nonce").fill(first.code);
    // The same message is already on screen from the wrong code: wait for this submit's answer.
    await submitCode(page);
    await expect(page.getByText("Kood on vale või aegunud. Kontrolli koodi või küsi uus kood.")).toBeVisible();
    expect(await newPasswordWorks(user, newPassword)).toBe(false);

    // After the cooldown a new code can be requested.
    await page.clock.runFor(61_000);
    await page.getByRole("button", { name: "Saada uus kood" }).click();
    await expect(page.getByText("Saatsime uue koodi.")).toBeVisible();
    const second = await reauthCode(user.email, first.id);

    // Keyboard only: type the code and submit with Enter.
    await field(page, "nonce").fill(second.code);
    await field(page, "nonce").press("Enter");
    await expect(page.getByText(/Parool muudetud\./)).toBeVisible();
    await expect(field(page, "newPassword")).toHaveValue("");
    expect(await newPasswordWorks(user, newPassword)).toBe(true);

    // Codes and passwords never travel in a URL or land in KAIDLY tables.
    for (const secret of [first.code, second.code, newPassword, user.password]) {
      expect(requests.filter((url) => url.includes(secret))).toEqual([]);
      expect(sql(`select count(*) from public.profiles p where p::text like '%${secret}%'`)).toBe("0");
    }
  });

  test("a recent session changes the password without a code; cancel leaves the code step", async ({ page }) => {
    const user = await createUser("Värske Seanss");
    await login(page, user, "/konto");
    await fillPasswords(page, user.password, "Kohe-Muudetud-Parool-1");
    await page.getByRole("button", { name: "Muuda parooli" }).click();
    await expect(page.getByText(/Parool muudetud\./)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Kinnita, et see oled sina" })).toHaveCount(0);

    ageSessions(user);
    await fillPasswords(page, "Kohe-Muudetud-Parool-1", "Teine-Uus-Parool-22");
    await page.getByRole("button", { name: "Muuda parooli" }).click();
    await expect(page.getByRole("heading", { name: "Kinnita, et see oled sina" })).toBeVisible();
    await page.getByRole("button", { name: "Katkesta" }).click();
    await expect(page.getByRole("heading", { name: "Kinnita, et see oled sina" })).toHaveCount(0);
    await expect(field(page, "newPassword")).toHaveValue("");
  });

  test("code step in English and Russian", async ({ page, context }) => {
    const user = await createUser("Code Language");
    // Profile language set before signing in: otherwise the app saves "en" to the profile
    // after sign-in, which can land after the "ru" update below (race in the test, not the app).
    sql(`update public.profiles set preferred_locale = 'en' where id = '${user.id}'`);
    await context.addCookies([{ name: "kaidly_locale", value: "en", url: "http://localhost:3100" }]);
    await login(page, user, "/konto");
    ageSessions(user);
    await fillPasswords(page, user.password, "English-Password-123");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByRole("heading", { name: "Confirm it's you" })).toBeVisible();
    await expect(page.getByLabel("Verification code")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send a new code" })).toBeVisible();

    // After sign-in the profile language wins over the cookie (lib/actions/locale.ts).
    sql(`update public.profiles set preferred_locale = 'ru' where id = '${user.id}'`);
    await context.addCookies([{ name: "kaidly_locale", value: "ru", url: "http://localhost:3100" }]);
    await page.reload();
    await fillPasswords(page, user.password, "Russian-Password-123");
    await page.getByRole("button", { name: "Сменить пароль" }).click();
    await expect(page.getByRole("heading", { name: "Подтвердите, что это вы" })).toBeVisible();
    await expect(page.getByLabel("Код подтверждения")).toBeVisible();
  });
});

/** Signs in through the local Auth API with a throw-away request. */
async function newPasswordWorks(user: TestUser, password: string): Promise<boolean> {
  const response = await fetch(`${process.env.E2E_API_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: process.env.E2E_PUBLISHABLE_KEY ?? "" },
    body: JSON.stringify({ email: user.email, password }),
  });
  return response.ok;
}

test.describe("Tähtaegade e-posti teavitused", () => {
  test("on by default, the user switches it off and on; it stays after signing in again @responsive @cross-browser", async ({ page }) => {
    const user = await createUser("Teavituste Valija");
    await login(page, user, "/konto");
    const toggle = page.getByRole("switch", { name: "Tähtaegade e-posti teavitused" });
    await expect(page.getByRole("heading", { name: "Teavitused" })).toBeVisible();
    await expect(toggle).toBeChecked();
    await expect(page.getByText("Saada mulle e-post, kui KAIDLYs tekib uus tähtajaga seotud teavitus.")).toBeVisible();
    await expect(page.getByText(/Konto ja turvalisusega seotud kirjad/)).toBeVisible();
    expect(sql(`select count(*) from public.notification_preferences where user_id = '${user.id}'`)).toBe("0");

    // Keyboard: Space toggles the switch.
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(page.getByText("E-posti teavitused on välja lülitatud. Teavitused jäävad KAIDLYs endiselt nähtavaks.")).toBeVisible();
    await expect(toggle).toBeEnabled();
    await expect
      .poll(() => sql(`select email_deadline_reminders from public.notification_preferences where user_id = '${user.id}'`))
      .toBe("f");
    await expectNoHorizontalScroll(page);

    await page.reload();
    await expect(page.getByRole("switch", { name: "Tähtaegade e-posti teavitused" })).not.toBeChecked();
    await page.getByRole("button", { name: "Logi välja" }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
    await login(page, user, "/konto");
    const again = page.getByRole("switch", { name: "Tähtaegade e-posti teavitused" });
    await expect(again).not.toBeChecked();

    await again.click();
    await expect(again).toBeChecked();
    await expect(page.getByText("Salvestatud.").last()).toBeVisible();
    expect(sql(`select email_deadline_reminders from public.notification_preferences where user_id = '${user.id}'`)).toBe("t");
  });

  test("labels in English and Russian", async ({ page, context }) => {
    const user = await createUser("Preference Language");
    sql(`update public.profiles set preferred_locale = 'en' where id = '${user.id}'`); // see "code step in English and Russian"
    await context.addCookies([{ name: "kaidly_locale", value: "en", url: "http://localhost:3100" }]);
    await login(page, user, "/konto");
    await expect(page.getByRole("switch", { name: "Deadline email notifications" })).toBeChecked();
    await expect(page.getByText("Send me an email when KAIDLY creates a new deadline-related notification for me.")).toBeVisible();
    sql(`update public.profiles set preferred_locale = 'ru' where id = '${user.id}'`);
    await context.addCookies([{ name: "kaidly_locale", value: "ru", url: "http://localhost:3100" }]);
    await page.reload();
    await expect(page.getByRole("switch", { name: "Напоминания о сроках по эл. почте" })).toBeChecked();
    await page.getByRole("switch", { name: "Напоминания о сроках по эл. почте" }).click();
    await expect(page.getByText("Письма о сроках отключены. Уведомления по-прежнему доступны в KAIDLY.")).toBeVisible();
  });
});
