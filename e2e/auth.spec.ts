import { createOrg, createUser, expect, field, login, test, uniqueId } from "./support/fixtures";

/** Latest email to `to` in the local Mailpit inbox. */
async function confirmationLink(to: string): Promise<string> {
  const mailpit = process.env.E2E_MAILPIT_URL;
  if (!mailpit) throw new Error("Mailpit URL missing");
  for (let i = 0; i < 40; i++) {
    const search = await (await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json();
    if (search.messages?.length) {
      const message = await (await fetch(`${mailpit}/api/v1/message/${search.messages[0].ID}`)).json();
      const link = /https?:\/\/[^"'\s<>]+\/auth\/v1\/verify[^"'\s<>]+/.exec(message.HTML ?? message.Text)?.[0];
      if (link) return link.replaceAll("&amp;", "&");
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`no confirmation email for ${to}`);
}

test.describe("Autentimine", () => {
  test("sign up, confirm by email, land in the app @responsive", async ({ page }) => {
    const email = `${uniqueId("signup")}@example.ee`;
    await page.goto("/auth/sign-up");
    await field(page, "fullName").fill("Uus Kasutaja");
    await field(page, "email").fill(email);
    await field(page, "password").fill("Pikk-parool-123");
    await field(page, "repeatPassword").fill("Pikk-parool-123");
    await page.getByRole("button", { name: "Loo konto" }).click();
    await expect(page.getByRole("heading", { name: "Kontrolli oma e-posti" })).toBeVisible();

    // The confirmation link works in the same browser (PKCE).
    await page.goto(await confirmationLink(email));
    await expect(page).toHaveURL(/\/o(\?.*)?$/);
    await expect(page.getByText("Sa ei kuulu veel ühtegi organisatsiooni")).toBeVisible();
  });

  test("short password and mismatched passwords are caught before sign-up", async ({ page }) => {
    await page.goto("/auth/sign-up");
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
