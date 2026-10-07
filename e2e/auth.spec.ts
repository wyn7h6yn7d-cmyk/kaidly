import { createOrg, createUser, expect, field, login, test, uniqueId } from "./support/fixtures";

type Mail = { Subject: string; HTML: string; Text: string };

/** Latest email to `to` in the local Mailpit inbox (optionally: whose subject matches). */
async function latestMail(to: string, subject?: RegExp): Promise<Mail> {
  const mailpit = process.env.E2E_MAILPIT_URL;
  if (!mailpit) throw new Error("Mailpit URL missing");
  for (let i = 0; i < 120; i++) { // up to 30 s: Mailpit is slower under parallel load
    const search = await (await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json();
    const hit = search.messages?.find((m: { Subject: string }) => !subject || subject.test(m.Subject));
    if (hit) return (await fetch(`${mailpit}/api/v1/message/${hit.ID}`)).json();
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`no email for ${to}`);
}

/**
 * The KAIDLY link in the email (supabase/templates: {{ .SiteURL }}/auth/confirm?token_hash=…).
 * The local Site URL is the :3000 dev server; the test server runs elsewhere, so keep only
 * the path and query.
 */
async function confirmationLink(to: string): Promise<string> {
  const mail = await latestMail(to);
  const link = /https?:\/\/[^"'\s<>]+\/auth\/confirm\?token_hash=[^"'\s<>]+/.exec(mail.HTML)?.[0];
  if (!link) throw new Error(`no KAIDLY confirmation link for ${to}`);
  const url = new URL(link.replaceAll("&amp;", "&"));
  return url.pathname + url.search;
}

test.describe("Autentimine", () => {
  test("sign up, confirm by email, land in the app @responsive", async ({ page }) => {
    const email = `${uniqueId("signup")}@example.ee`;
    await page.goto("/auth/sign-up");
    // The form is controlled: type only once React is interactive (dev hydration can lag under load).
    await page.waitForLoadState("networkidle");
    await field(page, "fullName").fill("Uus Kasutaja");
    await field(page, "email").fill(email);
    await field(page, "password").fill("Pikk-parool-123");
    await field(page, "repeatPassword").fill("Pikk-parool-123");
    await page.getByRole("button", { name: "Loo konto" }).click();
    await expect(page.getByRole("heading", { name: "Kontrolli oma e-posti" })).toBeVisible();

    // The confirmation link works in the same browser (PKCE).
    await page.goto(await confirmationLink(email));
    await expect(page).toHaveURL(/\/o(\?.*)?$/);
    await expect(page.getByText("Sul pole aktiivset ettevõtet")).toBeVisible();
  });

  test("the confirmation email follows the language chosen at sign-up", async ({ page }) => {
    const email = `${uniqueId("signup-en")}@example.ee`;
    await page.context().addCookies([{ name: "kaidly_locale", value: "en", url: "http://localhost:3100" }]);
    await page.goto("/auth/sign-up");
    // The form is controlled: type only once React is interactive (dev hydration can lag under load).
    await page.waitForLoadState("networkidle");
    await field(page, "fullName").fill("New User");
    await field(page, "email").fill(email);
    await field(page, "password").fill("Long-password-123");
    await field(page, "repeatPassword").fill("Long-password-123");
    await page.getByRole("button", { name: "Create account" }).click();

    const mail = await latestMail(email);
    expect(mail.Subject).toBe("Confirm your KAIDLY account");
    expect(mail.HTML).toContain("Confirm email");
    expect(mail.HTML).not.toContain("Kinnita e-post");
    await page.goto(await confirmationLink(email));
    await expect(page).toHaveURL(/\/o(\?.*)?$/);
  });

  test("short password and mismatched passwords are caught before sign-up", async ({ page }) => {
    await page.goto("/auth/sign-up");
    // The form is controlled: type only once React is interactive (dev hydration can lag under load).
    await page.waitForLoadState("networkidle");
    await field(page, "fullName").fill("Test");
    await field(page, "email").fill(`${uniqueId("x")}@example.ee`);
    await field(page, "password").fill("lyhike");
    await field(page, "repeatPassword").fill("lyhike");
    await page.getByRole("button", { name: "Loo konto" }).click();
    // The browser blocks the submit (minlength=10) and the hint explains the rule.
    expect(await field(page, "password").evaluate((input: HTMLInputElement) => input.validity.tooShort)).toBe(true);
    await expect(page.getByText("Vähemalt 10 tähemärki.")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/sign-up$/);

    await field(page, "password").fill("Pikk-parool-123");
    await field(page, "repeatPassword").fill("Pikk-parool-124");
    await page.getByRole("button", { name: "Loo konto" }).click();
    await expect(page.getByText("Paroolid ei kattu.")).toBeVisible();
  });

  test("login, wrong password, logout", async ({ page }) => {
    const user = await createUser("Mari Maasikas");
    await page.goto("/auth/login");
    await field(page, "email").fill(user.email);
    await field(page, "password").fill("vale-parool-123");
    await page.getByRole("button", { name: "Logi sisse" }).click();
    await expect(page.getByText("Vale e-post või parool.")).toBeVisible();

    await login(page, user);
    await expect(page).toHaveURL(/\/o/);
    await page.getByRole("button", { name: "Konto" }).first().click();
    await page.getByRole("menuitem", { name: "Logi välja" }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
    await page.goto("/o");
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fo/);
  });

  test("protected pages redirect to login and return after it", async ({ page }) => {
    const org = await createOrg();
    await page.goto(`/o/${org.slug}/objektid`);
    await expect(page).toHaveURL(new RegExp(`/auth/login\\?next=%2Fo%2F${org.slug}%2Fobjektid`));
    await field(page, "email").fill(org.users.viewer.email);
    await field(page, "password").fill(org.users.viewer.password);
    await page.getByRole("button", { name: "Logi sisse" }).click();
    await expect(page).toHaveURL(new RegExp(`/o/${org.slug}/objektid$`));
  });

  test("off-site redirects are refused", async ({ page }) => {
    const user = await createUser("Mati");
    await login(page, user, "https://evil.example/o");
    await expect(page).toHaveURL(/localhost:3100\/o/);
  });
});

test("credentials never end up in the URL, even if submitted before the page is interactive", async ({ page }) => {
  await page.route("**/_next/static/**", (route) => route.abort()); // no JavaScript
  await page.goto("/auth/login");
  for (const form of await page.locator("form").all()) {
    await expect(form).toHaveAttribute("method", "post");
  }
  await page.locator('input[name="email"]:visible').fill("someone@example.ee");
  await page.locator('input[name="password"]:visible').fill("secret-password-123");
  await page.locator('form button[type="submit"]:visible').click();
  await page.waitForLoadState();
  expect(page.url()).not.toContain("secret-password-123");
  expect(page.url()).not.toContain("password");
});
